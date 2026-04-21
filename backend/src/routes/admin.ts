import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db.js";
import { usersTable, branchesTable, branchManagersTable, branchOperatorsTable, kpiCategoriesTable } from "../schema.js";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import { z } from "zod";

const router = Router();
const adminOnly = requireAuth("admin");

// ── Branches ──────────────────────────────────────────────────────────────────
router.get("/admin/branches", adminOnly, async (_req, res) => {
  const branches = await db.select().from(branchesTable).orderBy(branchesTable.name);

  // attach managers and operator count
  const result = await Promise.all(branches.map(async (b) => {
    const managers = await db
      .select({ id: usersTable.id, name: usersTable.name })
      .from(branchManagersTable)
      .innerJoin(usersTable, eq(branchManagersTable.managerId, usersTable.id))
      .where(eq(branchManagersTable.branchId, b.id));

    const operators = await db
      .select({ id: usersTable.id })
      .from(branchOperatorsTable)
      .where(eq(branchOperatorsTable.branchId, b.id));

    return { ...b, managers, operatorCount: operators.length };
  }));

  res.json(result);
});

router.post("/admin/branches", adminOnly, async (req, res): Promise<void> => {
  const parsed = z.object({ name: z.string().min(1), address: z.string().optional() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [branch] = await db.insert(branchesTable).values(parsed.data).returning();
  res.status(201).json(branch);
});

router.put("/admin/branches/:id", adminOnly, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const parsed = z.object({ name: z.string().min(1).optional(), address: z.string().optional(), isActive: z.boolean().optional() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [branch] = await db.update(branchesTable).set(parsed.data).where(eq(branchesTable.id, id)).returning();
  if (!branch) { res.status(404).json({ error: "Not found" }); return; }
  res.json(branch);
});

router.delete("/admin/branches/:id", adminOnly, async (req, res): Promise<void> => {
  await db.delete(branchesTable).where(eq(branchesTable.id, Number(req.params.id)));
  res.status(204).send();
});

// ── Branch ↔ Manager assignments ──────────────────────────────────────────────
router.post("/admin/branches/:branchId/managers/:managerId", adminOnly, async (req, res): Promise<void> => {
  const branchId = Number(req.params.branchId);
  const managerId = Number(req.params.managerId);
  try {
    const [row] = await db.insert(branchManagersTable).values({ branchId, managerId }).returning();
    res.status(201).json(row);
  } catch {
    res.status(409).json({ error: "Already assigned" });
  }
});

router.delete("/admin/branches/:branchId/managers/:managerId", adminOnly, async (req, res): Promise<void> => {
  await db.delete(branchManagersTable).where(
    and(
      eq(branchManagersTable.branchId, Number(req.params.branchId)),
      eq(branchManagersTable.managerId, Number(req.params.managerId))
    )
  );
  res.status(204).send();
});

// ── Managers ──────────────────────────────────────────────────────────────────
router.get("/admin/managers", adminOnly, async (_req, res) => {
  const managers = await db.select({ id: usersTable.id, name: usersTable.name, createdAt: usersTable.createdAt })
    .from(usersTable).where(eq(usersTable.role, "manager")).orderBy(usersTable.name);
  res.json(managers);
});

router.post("/admin/managers", adminOnly, async (req, res): Promise<void> => {
  const parsed = z.object({ name: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [user] = await db.insert(usersTable).values({ name: parsed.data.name, role: "manager" }).returning();
  res.status(201).json(user);
});

router.put("/admin/managers/:id", adminOnly, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const parsed = z.object({ name: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [user] = await db.update(usersTable).set({ name: parsed.data.name }).where(eq(usersTable.id, id)).returning();
  if (!user) { res.status(404).json({ error: "Not found" }); return; }
  res.json(user);
});

router.delete("/admin/managers/:id", adminOnly, async (req, res): Promise<void> => {
  await db.delete(usersTable).where(eq(usersTable.id, Number(req.params.id)));
  res.status(204).send();
});

// ── KPI Categories ─────────────────────────────────────────────────────────────
router.get("/admin/kpi-categories", adminOnly, async (_req, res) => {
  const cats = await db.select().from(kpiCategoriesTable).orderBy(kpiCategoriesTable.name);
  res.json(cats);
});

router.post("/admin/kpi-categories", adminOnly, async (req, res): Promise<void> => {
  const parsed = z.object({ name: z.string().min(1), unit: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [cat] = await db.insert(kpiCategoriesTable).values(parsed.data).returning();
  res.status(201).json(cat);
});

router.put("/admin/kpi-categories/:id", adminOnly, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const parsed = z.object({ name: z.string().min(1).optional(), unit: z.string().min(1).optional(), isActive: z.boolean().optional() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [cat] = await db.update(kpiCategoriesTable).set(parsed.data).where(eq(kpiCategoriesTable.id, id)).returning();
  if (!cat) { res.status(404).json({ error: "Not found" }); return; }
  res.json(cat);
});

router.delete("/admin/kpi-categories/:id", adminOnly, async (req, res): Promise<void> => {
  await db.delete(kpiCategoriesTable).where(eq(kpiCategoriesTable.id, Number(req.params.id)));
  res.status(204).send();
});

// ── Admin: change own password ─────────────────────────────────────────────────
router.put("/admin/password", adminOnly, async (req, res): Promise<void> => {
  const parsed = z.object({ password: z.string().min(6) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Min 6 characters" }); return; }
  const hash = await bcrypt.hash(parsed.data.password, 10);
  await db.update(usersTable).set({ passwordHash: hash }).where(eq(usersTable.role, "admin"));
  res.json({ ok: true });
});

export default router;
