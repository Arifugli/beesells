import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db.js";
import { usersTable } from "../schema.js";
import { eq, or } from "drizzle-orm";
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

// POST /auth/login — universal login for all roles
router.post("/auth/login", wrap(async (req, res) => {
  const parsed = z.object({
    login: z.string().min(1),
    password: z.string().min(1),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Введите имя/email и пароль" }); return; }

  const { login, password } = parsed.data;

  const users = await db.select().from(usersTable).where(
    or(eq(usersTable.email, login), eq(usersTable.name, login))
  );

  if (users.length === 0) {
    res.status(401).json({ error: "Пользователь не найден" });
    return;
  }

  // Prefer email match if multiple results
  const user = users.find(u => u.email === login) ?? users[0];

  if (!user.passwordHash) {
    res.status(401).json({ error: "Пароль не установлен. Обратитесь к администратору." });
    return;
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) { res.status(401).json({ error: "Неверный пароль" }); return; }

  const token = signToken({ id: user.id, role: user.role as any, name: user.name });
  res.json({ token, user: { id: user.id, role: user.role, name: user.name } });
}));

// GET /auth/users?role= — list users for display (names only)
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
