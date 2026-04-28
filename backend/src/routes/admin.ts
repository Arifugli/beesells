import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db.js";
import {
  usersTable, branchesTable, branchManagersTable,
  branchOperatorsTable, kpiCategoriesTable, tariffsTable
} from "../schema.js";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import { z } from "zod";

const router = Router();
const adminOnly = requireAuth("admin");

function wrap(fn: (req: any, res: any) => Promise<void>) {
  return async (req: any, res: any, next: any) => {
    try { await fn(req, res); }
    catch (err: any) {
      console.error(`[admin] ${req.method} ${req.path}:`, err?.message);
      if (!res.headersSent) res.status(500).json({ error: err?.message || "Server error" });
    }
  };
}

// ── Branches ──────────────────────────────────────────────────────────────────
router.get("/admin/branches", adminOnly, wrap(async (_req, res) => {
  const branches = await db.select().from(branchesTable).orderBy(branchesTable.name);
  const result = [];
  for (const b of branches) {
    const managers = await db
      .select({ id: usersTable.id, name: usersTable.name })
      .from(branchManagersTable)
      .innerJoin(usersTable, eq(branchManagersTable.managerId, usersTable.id))
      .where(eq(branchManagersTable.branchId, b.id));
    const operators = await db
      .select({ id: branchOperatorsTable.operatorId })
      .from(branchOperatorsTable)
      .where(eq(branchOperatorsTable.branchId, b.id));
    result.push({ ...b, managers, operatorCount: operators.length });
  }
  res.json(result);
}));

router.post("/admin/branches", adminOnly, wrap(async (req, res) => {
  const parsed = z.object({ name: z.string().min(1), address: z.string().optional() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [branch] = await db.insert(branchesTable).values(parsed.data).returning();
  res.status(201).json(branch);
}));

router.put("/admin/branches/:id", adminOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const parsed = z.object({ name: z.string().min(1).optional(), address: z.string().optional(), isActive: z.boolean().optional() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [branch] = await db.update(branchesTable).set(parsed.data).where(eq(branchesTable.id, id)).returning();
  if (!branch) { res.status(404).json({ error: "Not found" }); return; }
  res.json(branch);
}));

router.delete("/admin/branches/:id", adminOnly, wrap(async (req, res) => {
  await db.delete(branchesTable).where(eq(branchesTable.id, Number(req.params.id)));
  res.status(204).send();
}));

router.post("/admin/branches/:branchId/managers/:managerId", adminOnly, wrap(async (req, res) => {
  const branchId = Number(req.params.branchId);
  const managerId = Number(req.params.managerId);
  const existing = await db.select().from(branchManagersTable)
    .where(and(eq(branchManagersTable.branchId, branchId), eq(branchManagersTable.managerId, managerId)));
  if (existing.length > 0) { res.status(200).json(existing[0]); return; }
  const [row] = await db.insert(branchManagersTable).values({ branchId, managerId }).returning();
  res.status(201).json(row);
}));

router.delete("/admin/branches/:branchId/managers/:managerId", adminOnly, wrap(async (req, res) => {
  await db.delete(branchManagersTable).where(
    and(eq(branchManagersTable.branchId, Number(req.params.branchId)), eq(branchManagersTable.managerId, Number(req.params.managerId)))
  );
  res.status(204).send();
}));

// ── Managers ──────────────────────────────────────────────────────────────────
router.get("/admin/managers", adminOnly, wrap(async (_req, res) => {
  const managers = await db.select({
    id: usersTable.id, name: usersTable.name, email: usersTable.email,
    createdAt: usersTable.createdAt, hasPassword: usersTable.passwordHash,
  }).from(usersTable).where(eq(usersTable.role, "manager")).orderBy(usersTable.name);
  res.json(managers.map(m => ({ ...m, hasPassword: !!m.hasPassword })));
}));

router.post("/admin/managers", adminOnly, wrap(async (req, res) => {
  const parsed = z.object({
    name: z.string().min(1),
    email: z.string().email().optional(),
    password: z.string().min(6).optional(),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }
  const passwordHash = parsed.data.password ? await bcrypt.hash(parsed.data.password, 10) : undefined;
  const [user] = await db.insert(usersTable).values({
    name: parsed.data.name,
    role: "manager",
    email: parsed.data.email,
    passwordHash,
  }).returning();
  res.status(201).json({ ...user, passwordHash: undefined });
}));

router.put("/admin/managers/:id", adminOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const parsed = z.object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional().nullable(),
    password: z.string().min(6).optional(),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }
  const update: any = {};
  if (parsed.data.name) update.name = parsed.data.name;
  if (parsed.data.email !== undefined) update.email = parsed.data.email;
  if (parsed.data.password) update.passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const [user] = await db.update(usersTable).set(update).where(eq(usersTable.id, id)).returning();
  if (!user) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...user, passwordHash: undefined });
}));

router.delete("/admin/managers/:id", adminOnly, wrap(async (req, res) => {
  await db.delete(usersTable).where(eq(usersTable.id, Number(req.params.id)));
  res.status(204).send();
}));

// ── KPI Categories ─────────────────────────────────────────────────────────────
router.get("/admin/kpi-categories", adminOnly, wrap(async (_req, res) => {
  res.json(await db.select().from(kpiCategoriesTable).orderBy(kpiCategoriesTable.name));
}));

router.post("/admin/kpi-categories", adminOnly, wrap(async (req, res) => {
  const parsed = z.object({ name: z.string().min(1), unit: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [cat] = await db.insert(kpiCategoriesTable).values(parsed.data).returning();
  res.status(201).json(cat);
}));

router.put("/admin/kpi-categories/:id", adminOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const parsed = z.object({ name: z.string().min(1).optional(), unit: z.string().min(1).optional(), isActive: z.boolean().optional() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [cat] = await db.update(kpiCategoriesTable).set(parsed.data).where(eq(kpiCategoriesTable.id, id)).returning();
  if (!cat) { res.status(404).json({ error: "Not found" }); return; }
  res.json(cat);
}));

router.delete("/admin/kpi-categories/:id", adminOnly, wrap(async (req, res) => {
  await db.delete(kpiCategoriesTable).where(eq(kpiCategoriesTable.id, Number(req.params.id)));
  res.status(204).send();
}));

// ── Tariffs ────────────────────────────────────────────────────────────────────
router.get("/admin/tariffs", adminOnly, wrap(async (_req, res) => {
  res.json(await db.select().from(tariffsTable).orderBy(tariffsTable.name));
}));

router.post("/admin/tariffs", adminOnly, wrap(async (req, res) => {
  const parsed = z.object({ name: z.string().min(1), price: z.number().int().min(0) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }
  const [tariff] = await db.insert(tariffsTable).values(parsed.data).returning();
  res.status(201).json(tariff);
}));

router.put("/admin/tariffs/:id", adminOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const parsed = z.object({ name: z.string().min(1).optional(), price: z.number().int().min(0).optional(), isActive: z.boolean().optional() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [tariff] = await db.update(tariffsTable).set(parsed.data).where(eq(tariffsTable.id, id)).returning();
  if (!tariff) { res.status(404).json({ error: "Not found" }); return; }
  res.json(tariff);
}));

router.delete("/admin/tariffs/:id", adminOnly, wrap(async (req, res) => {
  await db.delete(tariffsTable).where(eq(tariffsTable.id, Number(req.params.id)));
  res.status(204).send();
}));

// ── Admin password ─────────────────────────────────────────────────────────────
router.put("/admin/password", adminOnly, wrap(async (req, res) => {
  const parsed = z.object({ password: z.string().min(6) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Минимум 6 символов" }); return; }
  const hash = await bcrypt.hash(parsed.data.password, 10);
  await db.update(usersTable).set({ passwordHash: hash }).where(eq(usersTable.role, "admin"));
  res.json({ ok: true });
}));

export default router;
