import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db.js";
import { usersTable } from "../schema.js";
import { eq } from "drizzle-orm";
import { signToken } from "../middleware/auth.js";
import { z } from "zod";

const router = Router();

function wrap(handler: (req: any, res: any) => Promise<void> | void) {
  return async (req: any, res: any, next: any) => {
    try { await handler(req, res); }
    catch (err: any) {
      console.error(`[auth] ${req.method} ${req.path} error:`, err);
      if (!res.headersSent) {
        res.status(500).json({ error: err?.message || "Internal server error" });
      }
      next();
    }
  };
}

// POST /auth/login/admin
router.post("/auth/login/admin", wrap(async (req, res) => {
  const parsed = z.object({ password: z.string() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Password required" }); return; }

  const [admin] = await db.select().from(usersTable).where(eq(usersTable.role, "admin"));
  if (!admin || !admin.passwordHash) { res.status(401).json({ error: "Admin not configured" }); return; }

  const ok = await bcrypt.compare(parsed.data.password, admin.passwordHash);
  if (!ok) { res.status(401).json({ error: "Wrong password" }); return; }

  const token = signToken({ id: admin.id, role: "admin", name: admin.name });
  res.json({ token, user: { id: admin.id, role: "admin", name: admin.name } });
}));

// POST /auth/login/select
router.post("/auth/login/select", wrap(async (req, res) => {
  const parsed = z.object({ userId: z.number().int() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "userId required" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, parsed.data.userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (user.role === "admin") { res.status(403).json({ error: "Use admin login" }); return; }

  const token = signToken({ id: user.id, role: user.role as "manager" | "operator", name: user.name });
  res.json({ token, user: { id: user.id, role: user.role, name: user.name } });
}));

// GET /auth/users?role=
router.get("/auth/users", wrap(async (req, res) => {
  const role = req.query.role as string | undefined;
  const users = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    role: usersTable.role,
  }).from(usersTable).orderBy(usersTable.name);

  const filtered = role
    ? users.filter(u => u.role === role)
    : users.filter(u => u.role !== "admin");
  res.json(filtered);
}));

export default router;
