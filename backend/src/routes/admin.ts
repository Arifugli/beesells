import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db.js";
import { usersTable, branchesTable, branchManagersTable, branchOperatorsTable, kpiCategoriesTable } from "../schema.js";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import { z } from "zod";

const router = Router();
const adminOnly = requireAuth("admin");

// Wrapper: catches exceptions and logs them
function wrap(handler: (req: any, res: any) => Promise<void> | void) {
  return async (req: any, res: any, next: any) => {
    try { await handler(req, res); }
    catch (err: any) {
      console.error(`[admin] ${req.method} ${req.path} error:`, err);
      if (!res.headersSent) {
        res.status(500).json({ error: err?.message || "Internal server error" });
      }
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
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = z.object({
    name: z.string().min(1).optional(),
    address: z.string().optional(),
    isActive: z.boolean().optional(),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [branch] = await db.update(branchesTable).set(parsed.data).where(eq(branchesTable.id, id)).returning();
  if (!branch) { res.status(404).json({ error: "Not found" }); return; }
  res.json(branch);
}));

router.delete("/admin/branches/:id", adminOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(branchesTable).where(eq(branchesTable.id, id));
  res.status(204).send();
}));

// ── Branch ↔ Manager assignments ──────────────────────────────────────────────
router.post("/admin/branches/:branchId/managers/:managerId", adminOnly, wrap(async (req, res) => {
  const branchId = Number(req.params.branchId);
  const managerId = Number(req.params.managerId);
  if (isNaN(branchId) || isNaN(managerId)) { res.status(400).json({ error: "Invalid ids" }); return; }

  // Check existence before insert to avoid FK errors
  const [branch] = await db.select().from(branchesTable).where(eq(branchesTable.id, branchId));
  if (!branch) { res.status(404).json({ error: "Branch not found" }); return; }
  const [manager] = await db.select().from(usersTable)
    .where(and(eq(usersTable.id, managerId), eq(usersTable.role, "manager")));
  if (!manager) { res.status(404).json({ error: "Manager not found" }); return; }

  // Check if already assigned (avoid unique constraint error)
  const existing = await db.select().from(branchManagersTable)
    .where(and(eq(branchManagersTable.branchId, branchId), eq(branchManagersTable.managerId, managerId)));
  if (existing.length > 0) { res.status(200).json(existing[0]); return; }

  const [row] = await db.insert(branchManagersTable).values({ branchId, managerId }).returning();
  res.status(201).json(row);
}));

router.delete("/admin/branches/:branchId/managers/:managerId", adminOnly, wrap(async (req, res) => {
  const branchId = Number(req.params.branchId);
  const managerId = Number(req.params.managerId);
  if (isNaN(branchId) || isNaN(managerId)) { res.status(400).json({ error: "Invalid ids" }); return; }
  await db.delete(branchManagersTable).where(
    and(
      eq(branchManagersTable.branchId, branchId),
      eq(branchManagersTable.managerId, managerId)
    )
  );
  res.status(204).send();
}));

// ── Managers ──────────────────────────────────────────────────────────────────
router.get("/admin/managers", adminOnly, wrap(async (_req, res) => {
  const managers = await db.select({ id: usersTable.id, name: usersTable.name, createdAt: usersTable.createdAt })
    .from(usersTable).where(eq(usersTable.role, "manager")).orderBy(usersTable.name);
  res.json(managers);
}));

router.post("/admin/managers", adminOnly, wrap(async (req, res) => {
  const parsed = z.object({ name: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [user] = await db.insert(usersTable).values({ name: parsed.data.name, role: "manager" }).returning();
  res.status(201).json(user);
}));

router.put("/admin/managers/:id", adminOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = z.object({ name: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [user] = await db.update(usersTable).set({ name: parsed.data.name }).where(eq(usersTable.id, id)).returning();
  if (!user) { res.status(404).json({ error: "Not found" }); return; }
  res.json(user);
}));

router.delete("/admin/managers/:id", adminOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.status(204).send();
}));

// ── KPI Categories ─────────────────────────────────────────────────────────────
router.get("/admin/kpi-categories", adminOnly, wrap(async (_req, res) => {
  const cats = await db.select().from(kpiCategoriesTable).orderBy(kpiCategoriesTable.name);
  res.json(cats);
}));

router.post("/admin/kpi-categories", adminOnly, wrap(async (req, res) => {
  const parsed = z.object({ name: z.string().min(1), unit: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [cat] = await db.insert(kpiCategoriesTable).values(parsed.data).returning();
  res.status(201).json(cat);
}));

router.put("/admin/kpi-categories/:id", adminOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = z.object({
    name: z.string().min(1).optional(),
    unit: z.string().min(1).optional(),
    isActive: z.boolean().optional(),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [cat] = await db.update(kpiCategoriesTable).set(parsed.data).where(eq(kpiCategoriesTable.id, id)).returning();
  if (!cat) { res.status(404).json({ error: "Not found" }); return; }
  res.json(cat);
}));

router.delete("/admin/kpi-categories/:id", adminOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(kpiCategoriesTable).where(eq(kpiCategoriesTable.id, id));
  res.status(204).send();
}));

// ── Admin: change own password ─────────────────────────────────────────────────
router.put("/admin/password", adminOnly, wrap(async (req, res) => {
  const parsed = z.object({ password: z.string().min(6) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Min 6 characters" }); return; }
  const hash = await bcrypt.hash(parsed.data.password, 10);
  await db.update(usersTable).set({ passwordHash: hash }).where(eq(usersTable.role, "admin"));
  res.json({ ok: true });
}));

export default router;
