import { Router } from "express";
import { db } from "../db.js";
import {
  usersTable, branchesTable, branchManagersTable,
  branchOperatorsTable, kpiCategoriesTable, kpiTargetsTable, kpiEntriesTable
} from "../schema.js";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import { z } from "zod";

const router = Router();
const managerOnly = requireAuth("manager", "admin");

// helper: get all branch IDs this manager manages
async function getManagerBranchIds(managerId: number): Promise<number[]> {
  const rows = await db.select({ branchId: branchManagersTable.branchId })
    .from(branchManagersTable)
    .where(eq(branchManagersTable.managerId, managerId));
  return rows.map(r => r.branchId);
}

// GET /manager/branches — branches this manager manages
router.get("/manager/branches", managerOnly, async (req, res) => {
  const managerId = req.user!.id;
  const branchIds = await getManagerBranchIds(managerId);
  if (branchIds.length === 0) { res.json([]); return; }

  const branches = await db.select().from(branchesTable)
    .where(sql`${branchesTable.id} = ANY(${branchIds})`);
  res.json(branches);
});

// GET /manager/operators?branchId=  — operators in manager's branches
router.get("/manager/operators", managerOnly, async (req, res) => {
  const managerId = req.user!.id;
  const branchIds = await getManagerBranchIds(managerId);
  if (branchIds.length === 0) { res.json([]); return; }

  const branchIdFilter = req.query.branchId
    ? [Number(req.query.branchId)]
    : branchIds;

  const operators = await Promise.all(branchIdFilter.map(async (branchId) => {
    const rows = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        branchId: branchOperatorsTable.branchId,
        createdAt: usersTable.createdAt,
      })
      .from(branchOperatorsTable)
      .innerJoin(usersTable, eq(branchOperatorsTable.operatorId, usersTable.id))
      .where(eq(branchOperatorsTable.branchId, branchId));
    return rows;
  }));

  res.json(operators.flat());
});

// POST /manager/operators — create operator and assign to branch
router.post("/manager/operators", managerOnly, async (req, res): Promise<void> => {
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
});

router.put("/manager/operators/:id", managerOnly, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const parsed = z.object({ name: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [user] = await db.update(usersTable).set({ name: parsed.data.name }).where(eq(usersTable.id, id)).returning();
  if (!user) { res.status(404).json({ error: "Not found" }); return; }
  res.json(user);
});

router.delete("/manager/operators/:id", managerOnly, async (req, res): Promise<void> => {
  await db.delete(usersTable).where(eq(usersTable.id, Number(req.params.id)));
  res.status(204).send();
});

// GET /manager/kpi-categories — all active categories
router.get("/manager/kpi-categories", managerOnly, async (_req, res) => {
  const cats = await db.select().from(kpiCategoriesTable).where(eq(kpiCategoriesTable.isActive, true));
  res.json(cats);
});

// GET /manager/targets?operatorId=&month=
router.get("/manager/targets", managerOnly, async (req, res) => {
  const { operatorId, month } = req.query;
  let query = db.select().from(kpiTargetsTable).$dynamic();
  const conditions = [];
  if (operatorId) conditions.push(eq(kpiTargetsTable.operatorId, Number(operatorId)));
  if (month) conditions.push(eq(kpiTargetsTable.month, month as string));
  if (conditions.length) query = query.where(and(...conditions));
  res.json(await query);
});

// POST /manager/targets  — set/update target for operator+category+month
router.post("/manager/targets", managerOnly, async (req, res): Promise<void> => {
  const parsed = z.object({
    operatorId: z.number().int(),
    categoryId: z.number().int(),
    month: z.string().regex(/^\d{4}-\d{2}$/),
    target: z.number().int().min(0),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // upsert
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
});

// GET /manager/dashboard?month=  — full team overview for manager
router.get("/manager/dashboard", managerOnly, async (req, res) => {
  const managerId = req.user!.id;
  const month = (req.query.month as string) || currentMonth();
  const branchIds = await getManagerBranchIds(managerId);

  const branches = await db.select().from(branchesTable)
    .where(sql`${branchesTable.id} = ANY(${branchIds})`);

  const categories = await db.select().from(kpiCategoriesTable).where(eq(kpiCategoriesTable.isActive, true));

  const branchStats = await Promise.all(branches.map(async (branch) => {
    const opRows = await db
      .select({ id: usersTable.id, name: usersTable.name })
      .from(branchOperatorsTable)
      .innerJoin(usersTable, eq(branchOperatorsTable.operatorId, usersTable.id))
      .where(eq(branchOperatorsTable.branchId, branch.id));

    const operatorStats = await Promise.all(opRows.map(async (op) => {
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

      const avgPercent = kpis.length > 0
        ? Math.round(kpis.filter(k => k.target > 0).reduce((s, k) => s + k.percent, 0) / Math.max(kpis.filter(k => k.target > 0).length, 1))
        : 0;

      return { operator: op, kpis, avgPercent };
    }));

    operatorStats.sort((a, b) => b.avgPercent - a.avgPercent);
    operatorStats.forEach((s, i) => Object.assign(s, { rank: i + 1 }));

    return { branch, operators: operatorStats };
  }));

  res.json({ month, branches: branchStats, categories });
});

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default router;
