import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db.js";
import { usersTable } from "../schema.js";
import { eq } from "drizzle-orm";
import { signToken } from "../middleware/auth.js";
import { z } from "zod";

const router = Router();

// POST /auth/login/admin  { password }
router.post("/auth/login/admin", async (req, res): Promise<void> => {
  const parsed = z.object({ password: z.string() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Password required" }); return; }

  const [admin] = await db.select().from(usersTable).where(eq(usersTable.role, "admin"));
  if (!admin || !admin.passwordHash) { res.status(401).json({ error: "Admin not configured" }); return; }

  const ok = await bcrypt.compare(parsed.data.password, admin.passwordHash);
  if (!ok) { res.status(401).json({ error: "Wrong password" }); return; }

  const token = signToken({ id: admin.id, role: "admin", name: admin.name });
  res.json({ token, user: { id: admin.id, role: "admin", name: admin.name } });
});

// POST /auth/login/select  { userId }  — for manager & operator (no password)
router.post("/auth/login/select", async (req, res): Promise<void> => {
  const parsed = z.object({ userId: z.number().int() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "userId required" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, parsed.data.userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (user.role === "admin") { res.status(403).json({ error: "Use admin login" }); return; }

  const token = signToken({ id: user.id, role: user.role as "manager" | "operator", name: user.name });
  res.json({ token, user: { id: user.id, role: user.role, name: user.name } });
});

// GET /auth/users?role=operator|manager  — list selectable users for login screen
router.get("/auth/users", async (req, res) => {
  const role = req.query.role as string;
  let query = db.select({
    id: usersTable.id,
    name: usersTable.name,
    role: usersTable.role,
  }).from(usersTable);

  const users = await query;
  const filtered = role
    ? users.filter(u => u.role === role)
    : users.filter(u => u.role !== "admin");

  res.json(filtered);
});

export default router;
