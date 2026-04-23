import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db.js";
import { usersTable } from "../schema.js";
import { eq, or, ilike } from "drizzle-orm";
import { signToken } from "../middleware/auth.js";
import { z } from "zod";

const router = Router();

function wrap(fn: (req: any, res: any) => Promise<void>) {
  return async (req: any, res: any, next: any) => {
    try { await fn(req, res); }
    catch (err: any) {
      console.error(`[auth] ${req.method} ${req.path}:`, err?.message);
      if (!res.headersSent) res.status(500).json({ error: err?.message || "Server error" });
    }
  };
}

// POST /auth/login — universal login
// - If user has passwordHash: requires password
// - If user has no passwordHash: allows login by name/id only (transitional)
router.post("/auth/login", wrap(async (req, res) => {
  const parsed = z.object({
    login: z.string().min(1),
    password: z.string().optional(),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Введите имя или email" }); return; }

  const { login, password } = parsed.data;

  // Search by email exact OR name case-insensitive
  const users = await db.select().from(usersTable).where(
    or(
      eq(usersTable.email, login),
      ilike(usersTable.name, login),
    )
  );

  // Also try by id (for backward compat with userId-based select)
  const numericId = parseInt(login);
  let found = users;
  if (found.length === 0 && !isNaN(numericId)) {
    found = await db.select().from(usersTable).where(eq(usersTable.id, numericId));
  }

  if (found.length === 0) {
    res.status(401).json({ error: "Пользователь не найден" });
    return;
  }

  // Prefer email match
  const user = found.find(u => u.email === login) ?? found[0];

  if (user.passwordHash) {
    // User has a password — must verify it
    if (!password) {
      res.status(401).json({ error: "Введите пароль" });
      return;
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      res.status(401).json({ error: "Неверный пароль" });
      return;
    }
  }
  // If no passwordHash — allow login without password (transitional period)

  const token = signToken({ id: user.id, role: user.role as any, name: user.name });
  res.json({ token, user: { id: user.id, role: user.role, name: user.name } });
}));

// POST /auth/login/admin — admin only with password
router.post("/auth/login/admin", wrap(async (req, res) => {
  const parsed = z.object({ password: z.string() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Password required" }); return; }

  const [admin] = await db.select().from(usersTable).where(eq(usersTable.role, "admin"));
  if (!admin || !admin.passwordHash) { res.status(401).json({ error: "Admin not configured" }); return; }

  const ok = await bcrypt.compare(parsed.data.password, admin.passwordHash);
  if (!ok) { res.status(401).json({ error: "Неверный пароль" }); return; }

  const token = signToken({ id: admin.id, role: "admin", name: admin.name });
  res.json({ token, user: { id: admin.id, role: "admin", name: admin.name } });
}));

// POST /auth/login/select — passwordless select by userId (for users without password)
router.post("/auth/login/select", wrap(async (req, res) => {
  const parsed = z.object({ userId: z.number().int() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "userId required" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, parsed.data.userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (user.role === "admin") { res.status(403).json({ error: "Use admin login" }); return; }

  if (user.passwordHash) {
    res.status(403).json({ error: "Этот пользователь использует пароль. Войдите через форму входа." });
    return;
  }

  const token = signToken({ id: user.id, role: user.role as any, name: user.name });
  res.json({ token, user: { id: user.id, role: user.role, name: user.name } });
}));

// GET /auth/users?role=
router.get("/auth/users", wrap(async (req, res) => {
  const role = req.query.role as string | undefined;
  const users = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    role: usersTable.role,
    hasPassword: usersTable.passwordHash,
  }).from(usersTable).orderBy(usersTable.name);

  const filtered = role
    ? users.filter(u => u.role === role)
    : users.filter(u => u.role !== "admin");

  res.json(filtered.map(u => ({
    id: u.id,
    name: u.name,
    role: u.role,
    hasPassword: !!u.hasPassword,
  })));
}));

export default router;
