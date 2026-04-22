import { Router } from "express";
import { db } from "../db.js";
import {
  usersTable, branchesTable, branchManagersTable,
  branchOperatorsTable, kpiCategoriesTable, kpiTargetsTable, kpiEntriesTable
} from "../schema.js";
import { eq, and, sql, inArray } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import { z } from "zod";

const router = Router();
const managerOnly = requireAuth("manager", "admin");

function wrap(handler: (req: any, res: any) => Promise<void> | void) {
  return async (req: any, res: any, next: any) => {
    try { await handler(req, res); }
    catch (err: any) {
      console.error(`[manager] ${req.method} ${req.path} error:`, err);
      if (!res.headersSent) {
        res.status(500).json({ error: err?.message || "Internal server error" });
      }
      next();
    }
  };
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// helper: get all branch IDs this manager manages
async function getManagerBranchIds(managerId: number): Promise<number[]> {
  const rows = await db.select({ branchId: branchManagersTable.branchId })
    .from(branchManagersTable)
    .where(eq(branchManagersTable.managerId, managerId));
  return rows.map(r => r.branchId);
}

// GET /manager/branches — branches this manager manages
router.get("/manager/branches", managerOnly, wrap(async (req, res) => {
  const managerId = req.user!.id;
  const branchIds = await getManagerBranchIds(managerId);
  if (branchIds.length === 0) { res.json([]); return; }
  const branches = await db.select().from(branchesTable).where(inArray(branchesTable.id, branchIds));
  res.json(branches);
}));

// GET /manager/operators?branchId=  — operators in manager's branches
router.get("/manager/operators", managerOnly, wrap(async (req, res) => {
  const managerId = req.user!.id;
  const branchIds = await getManagerBranchIds(managerId);
  if (branchIds.length === 0) { res.json([]); return; }

  const requestedBranchId = req.query.branchId ? Number(req.query.branchId) : null;
  const scope = requestedBranchId ? [requestedBranchId] : branchIds;

  const rows = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      role: usersTable.role,
      branchId: branchOperatorsTable.branchId,
      createdAt: usersTable.createdAt,
    })
    .from(branchOperatorsTable)
    .innerJoin(usersTable, eq(branchOperatorsTable.operatorId, usersTable.id))
    .where(inArray(branchOperatorsTable.branchId, scope));

  res.json(rows);
}));

// POST /manager/operators — create operator and assign to branch
router.post("/manager/operators", managerOnly, wrap(async (req, res) => {
  const parsed = z.object({
    name: z.string().min(1),
    branchId: z.number().int(),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const managerId = req.user!.id;
  const branchIds = await getManagerBranchIds(managerId);
  if (!branchIds.includes(parsed.data.branchId)) {
    res.status(403).json({ error: "Branch not in your scope" }); return;
  }

  const [user] = await db.insert(usersTable).values({ name: parsed.data.name, role: "operator" }).returning();
  await db.insert(branchOperatorsTable).values({ branchId: parsed.data.branchId, operatorId: user.id });
  res.status(201).json(user);
}));

router.put("/manager/operators/:id", managerOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = z.object({ name: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [user] = await db.update(usersTable).set({ name: parsed.data.name }).where(eq(usersTable.id, id)).returning();
  if (!user) { res.status(404).json({ error: "Not found" }); return; }
  res.json(user);
}));

router.delete("/manager/operators/:id", managerOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.status(204).send();
}));

// GET /manager/kpi-categories — all active categories
router.get("/manager/kpi-categories", managerOnly, wrap(async (_req, res) => {
  const cats = await db.select().from(kpiCategoriesTable).where(eq(kpiCategoriesTable.isActive, true));
  res.json(cats);
}));

// GET /manager/targets?operatorId=&month=
router.get("/manager/targets", managerOnly, wrap(async (req, res) => {
  const operatorId = req.query.operatorId ? Number(req.query.operatorId) : null;
  const month = req.query.month as string | undefined;

  const conditions = [];
  if (operatorId) conditions.push(eq(kpiTargetsTable.operatorId, operatorId));
  if (month) conditions.push(eq(kpiTargetsTable.month, month));

  const query = db.select().from(kpiTargetsTable);
  const result = conditions.length > 0
    ? await query.where(and(...conditions))
    : await query;
  res.json(result);
}));

// POST /manager/targets  — set/update target for operator+category+month
router.post("/manager/targets", managerOnly, wrap(async (req, res) => {
  const parsed = z.object({
    operatorId: z.number().int(),
    categoryId: z.number().int(),
    month: z.string().regex(/^\d{4}-\d{2}$/),
    target: z.number().int().min(0),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const existing = await db.select().from(kpiTargetsTable).where(
    and(
      eq(kpiTargetsTable.operatorId, parsed.data.operatorId),
      eq(kpiTargetsTable.categoryId, parsed.data.categoryId),
      eq(kpiTargetsTable.month, parsed.data.month),
    )
  );

  if (existing.length > 0) {
    const [updated] = await db.update(kpiTargetsTable)
      .set({ target: parsed.data.target })
      .where(eq(kpiTargetsTable.id, existing[0].id))
      .returning();
    res.json(updated);
  } else {
    const [created] = await db.insert(kpiTargetsTable).values(parsed.data).returning();
    res.status(201).json(created);
  }
}));

// GET /manager/dashboard?month=  — full team overview for manager
router.get("/manager/dashboard", managerOnly, wrap(async (req, res) => {
  const managerId = req.user!.id;
  const month = (req.query.month as string) || currentMonth();
  const branchIds = await getManagerBranchIds(managerId);

  const categories = await db.select().from(kpiCategoriesTable).where(eq(kpiCategoriesTable.isActive, true));

  if (branchIds.length === 0) {
    res.json({ month, branches: [], categories });
    return;
  }

  const branches = await db.select().from(branchesTable).where(inArray(branchesTable.id, branchIds));

  // Sequential loops instead of Promise.all to avoid overwhelming Neon
  const branchStats = [];
  for (const branch of branches) {
    const opRows = await db
      .select({ id: usersTable.id, name: usersTable.name, role: usersTable.role })
      .from(branchOperatorsTable)
      .innerJoin(usersTable, eq(branchOperatorsTable.operatorId, usersTable.id))
      .where(eq(branchOperatorsTable.branchId, branch.id));

    const operatorStats = [];
    for (const op of opRows) {
      const targets = await db.select().from(kpiTargetsTable).where(
        and(eq(kpiTargetsTable.operatorId, op.id), eq(kpiTargetsTable.month, month))
      );
      const entries = await db.select().from(kpiEntriesTable).where(
        and(eq(kpiEntriesTable.operatorId, op.id), sql`${kpiEntriesTable.date} LIKE ${month + "%"}`)
      );

      const kpis = categories.map(cat => {
        const target = targets.find(t => t.categoryId === cat.id)?.target ?? 0;
        const actual = entries.filter(e => e.categoryId === cat.id).reduce((s, e) => s + e.value, 0);
        return { category: cat, target, actual, percent: target > 0 ? Math.round((actual / target) * 100) : 0 };
      });

      const withTargets = kpis.filter(k => k.target > 0);
      const avgPercent = withTargets.length > 0
        ? Math.round(withTargets.reduce((s, k) => s + k.percent, 0) / withTargets.length)
        : 0;

      operatorStats.push({ operator: op, kpis, avgPercent });
    }

    operatorStats.sort((a, b) => b.avgPercent - a.avgPercent);
    operatorStats.forEach((s, i) => Object.assign(s, { rank: i + 1 }));

    branchStats.push({ branch, operators: operatorStats });
  }

  res.json({ month, branches: branchStats, categories });
}));

export default router;
