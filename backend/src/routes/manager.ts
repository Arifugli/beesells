import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db.js";
import {
  usersTable, branchesTable, branchManagersTable,
  branchOperatorsTable, kpiCategoriesTable, kpiTargetsTable, kpiEntriesTable,
  tariffsTable, tariffTargetsTable, tariffSalesTable
} from "../schema.js";
import { eq, and, sql, inArray } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import { z } from "zod";

const router = Router();
const managerOnly = requireAuth("manager", "admin");

function wrap(fn: (req: any, res: any) => Promise<void>) {
  return async (req: any, res: any, next: any) => {
    try { await fn(req, res); }
    catch (err: any) {
      console.error(`[manager] ${req.method} ${req.path}:`, err?.message);
      if (!res.headersSent) res.status(500).json({ error: err?.message || "Server error" });
    }
  };
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function getManagerBranchIds(managerId: number): Promise<number[]> {
  const rows = await db.select({ branchId: branchManagersTable.branchId })
    .from(branchManagersTable).where(eq(branchManagersTable.managerId, managerId));
  return rows.map(r => r.branchId);
}

// ── Branches ──────────────────────────────────────────────────────────────────
router.get("/manager/branches", managerOnly, wrap(async (req, res) => {
  const branchIds = await getManagerBranchIds(req.user!.id);
  if (branchIds.length === 0) { res.json([]); return; }
  res.json(await db.select().from(branchesTable).where(inArray(branchesTable.id, branchIds)));
}));

// ── Operators ─────────────────────────────────────────────────────────────────
router.get("/manager/operators", managerOnly, wrap(async (req, res) => {
  const branchIds = await getManagerBranchIds(req.user!.id);
  if (branchIds.length === 0) { res.json([]); return; }
  const scope = req.query.branchId ? [Number(req.query.branchId)] : branchIds;
  const rows = await db
    .select({ id: usersTable.id, name: usersTable.name, role: usersTable.role, email: usersTable.email, branchId: branchOperatorsTable.branchId, createdAt: usersTable.createdAt, hasPassword: usersTable.passwordHash })
    .from(branchOperatorsTable)
    .innerJoin(usersTable, eq(branchOperatorsTable.operatorId, usersTable.id))
    .where(inArray(branchOperatorsTable.branchId, scope));
  res.json(rows.map(r => ({ ...r, hasPassword: !!r.hasPassword })));
}));

router.post("/manager/operators", managerOnly, wrap(async (req, res) => {
  const parsed = z.object({
    name: z.string().min(1),
    branchId: z.number().int(),
    email: z.string().email().optional(),
    password: z.string().min(6).optional(),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }

  const branchIds = await getManagerBranchIds(req.user!.id);
  if (!branchIds.includes(parsed.data.branchId)) { res.status(403).json({ error: "Branch not in scope" }); return; }

  const passwordHash = parsed.data.password ? await bcrypt.hash(parsed.data.password, 10) : undefined;
  const [user] = await db.insert(usersTable).values({ name: parsed.data.name, role: "operator", email: parsed.data.email, passwordHash }).returning();
  await db.insert(branchOperatorsTable).values({ branchId: parsed.data.branchId, operatorId: user.id });
  res.status(201).json({ ...user, passwordHash: undefined });
}));

router.put("/manager/operators/:id", managerOnly, wrap(async (req, res) => {
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

router.delete("/manager/operators/:id", managerOnly, wrap(async (req, res) => {
  await db.delete(usersTable).where(eq(usersTable.id, Number(req.params.id)));
  res.status(204).send();
}));

// ── KPI ───────────────────────────────────────────────────────────────────────
router.get("/manager/kpi-categories", managerOnly, wrap(async (_req, res) => {
  res.json(await db.select().from(kpiCategoriesTable).where(eq(kpiCategoriesTable.isActive, true)));
}));

router.get("/manager/targets", managerOnly, wrap(async (req, res) => {
  const conditions = [];
  if (req.query.operatorId) conditions.push(eq(kpiTargetsTable.operatorId, Number(req.query.operatorId)));
  if (req.query.month) conditions.push(eq(kpiTargetsTable.month, req.query.month as string));
  const q = db.select().from(kpiTargetsTable);
  res.json(conditions.length ? await q.where(and(...conditions)) : await q);
}));

router.post("/manager/targets", managerOnly, wrap(async (req, res) => {
  const parsed = z.object({ operatorId: z.number().int(), categoryId: z.number().int(), month: z.string(), target: z.number().int().min(0) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const existing = await db.select().from(kpiTargetsTable).where(and(eq(kpiTargetsTable.operatorId, parsed.data.operatorId), eq(kpiTargetsTable.categoryId, parsed.data.categoryId), eq(kpiTargetsTable.month, parsed.data.month)));
  if (existing.length > 0) {
    const [u] = await db.update(kpiTargetsTable).set({ target: parsed.data.target }).where(eq(kpiTargetsTable.id, existing[0].id)).returning();
    res.json(u);
  } else {
    const [c] = await db.insert(kpiTargetsTable).values(parsed.data).returning();
    res.status(201).json(c);
  }
}));

// ── Tariffs ────────────────────────────────────────────────────────────────────
router.get("/manager/tariffs", managerOnly, wrap(async (_req, res) => {
  res.json(await db.select().from(tariffsTable).where(eq(tariffsTable.isActive, true)));
}));

// GET /manager/tariff-targets?operatorId=&month=
router.get("/manager/tariff-targets", managerOnly, wrap(async (req, res) => {
  const conditions = [];
  if (req.query.operatorId) conditions.push(eq(tariffTargetsTable.operatorId, Number(req.query.operatorId)));
  if (req.query.month) conditions.push(eq(tariffTargetsTable.month, req.query.month as string));
  const q = db.select().from(tariffTargetsTable);
  res.json(conditions.length ? await q.where(and(...conditions)) : await q);
}));

// POST /manager/tariff-targets
router.post("/manager/tariff-targets", managerOnly, wrap(async (req, res) => {
  const parsed = z.object({ operatorId: z.number().int(), tariffId: z.number().int(), month: z.string(), target: z.number().int().min(0) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const existing = await db.select().from(tariffTargetsTable).where(and(eq(tariffTargetsTable.operatorId, parsed.data.operatorId), eq(tariffTargetsTable.tariffId, parsed.data.tariffId), eq(tariffTargetsTable.month, parsed.data.month)));
  if (existing.length > 0) {
    const [u] = await db.update(tariffTargetsTable).set({ target: parsed.data.target }).where(eq(tariffTargetsTable.id, existing[0].id)).returning();
    res.json(u);
  } else {
    const [c] = await db.insert(tariffTargetsTable).values(parsed.data).returning();
    res.status(201).json(c);
  }
}));

// ── Dashboard ─────────────────────────────────────────────────────────────────
router.get("/manager/dashboard", managerOnly, wrap(async (req, res) => {
  const managerId = req.user!.id;
  const month = (req.query.month as string) || currentMonth();
  const branchIds = await getManagerBranchIds(managerId);
  const categories = await db.select().from(kpiCategoriesTable).where(eq(kpiCategoriesTable.isActive, true));
  const tariffs = await db.select().from(tariffsTable).where(eq(tariffsTable.isActive, true));

  if (branchIds.length === 0) { res.json({ month, branches: [], categories, tariffs }); return; }

  const branches = await db.select().from(branchesTable).where(inArray(branchesTable.id, branchIds));

  const branchStats = [];
  for (const branch of branches) {
    const opRows = await db
      .select({ id: usersTable.id, name: usersTable.name, role: usersTable.role })
      .from(branchOperatorsTable)
      .innerJoin(usersTable, eq(branchOperatorsTable.operatorId, usersTable.id))
      .where(eq(branchOperatorsTable.branchId, branch.id));

    const operatorStats = [];
    for (const op of opRows) {
      // KPI
      const targets = await db.select().from(kpiTargetsTable).where(and(eq(kpiTargetsTable.operatorId, op.id), eq(kpiTargetsTable.month, month)));
      const entries = await db.select().from(kpiEntriesTable).where(and(eq(kpiEntriesTable.operatorId, op.id), sql`${kpiEntriesTable.date} LIKE ${month + "%"}`));
      const kpis = categories.map(cat => {
        const target = targets.find(t => t.categoryId === cat.id)?.target ?? 0;
        const actual = entries.filter(e => e.categoryId === cat.id).reduce((s, e) => s + e.value, 0);
        return { category: cat, target, actual, percent: target > 0 ? Math.round((actual / target) * 100) : 0 };
      });

      // Tariffs
      const tariffTgts = await db.select().from(tariffTargetsTable).where(and(eq(tariffTargetsTable.operatorId, op.id), eq(tariffTargetsTable.month, month)));
      const tariffSales = await db.select().from(tariffSalesTable).where(and(eq(tariffSalesTable.operatorId, op.id), sql`${tariffSalesTable.date} LIKE ${month + "%"}`));
      const tariffStats = tariffs.map(t => {
        const target = tariffTgts.find(x => x.tariffId === t.id)?.target ?? 0;
        const qty = tariffSales.filter(s => s.tariffId === t.id).reduce((s, x) => s + x.quantity, 0);
        const revenue = qty * t.price;
        return { tariff: t, target, quantity: qty, revenue, percent: target > 0 ? Math.round((qty / target) * 100) : 0 };
      });
      const totalRevenue = tariffStats.reduce((s, t) => s + t.revenue, 0);

      const withTargets = kpis.filter(k => k.target > 0);
      const avgPercent = withTargets.length > 0 ? Math.round(withTargets.reduce((s, k) => s + k.percent, 0) / withTargets.length) : 0;

      operatorStats.push({ operator: op, kpis, tariffStats, totalRevenue, avgPercent });
    }

    operatorStats.sort((a, b) => b.avgPercent - a.avgPercent);
    operatorStats.forEach((s, i) => Object.assign(s, { rank: i + 1 }));
    branchStats.push({ branch, operators: operatorStats });
  }

  // Compute totals across all branches
  const allOps = branchStats.flatMap(b => b.operators);
  const totalSummary = categories.map(cat => {
    const totalPlan = allOps.reduce((s, op) => {
      const kpi = op.kpis.find((k: any) => k.category.id === cat.id);
      return s + (kpi?.target ?? 0);
    }, 0);
    const totalFact = allOps.reduce((s, op) => {
      const kpi = op.kpis.find((k: any) => k.category.id === cat.id);
      return s + (kpi?.actual ?? 0);
    }, 0);
    const percent = totalPlan > 0 ? Math.round((totalFact / totalPlan) * 100) : 0;
    return { categoryId: cat.id, categoryName: cat.name, unit: cat.unit, totalPlan, totalFact, percent };
  });

  res.json({ month, branches: branchStats, categories, tariffs, totalSummary });
}));

export default router;
