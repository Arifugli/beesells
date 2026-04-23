import { Router } from "express";
import { db } from "../db.js";
import {
  usersTable, branchesTable, branchOperatorsTable,
  kpiCategoriesTable, kpiTargetsTable, kpiEntriesTable,
  tariffsTable, tariffTargetsTable, tariffSalesTable
} from "../schema.js";
import { eq, and, sql, inArray } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import { z } from "zod";

const router = Router();

function wrap(fn: (req: any, res: any) => Promise<void>) {
  return async (req: any, res: any, next: any) => {
    try { await fn(req, res); }
    catch (err: any) {
      console.error(`[operator] ${req.method} ${req.path}:`, err?.message);
      if (!res.headersSent) res.status(500).json({ error: err?.message || "Server error" });
    }
  };
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function daysLeft(month: string): number {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const today = new Date();
  const cur = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  if (month !== cur) return 0;
  return Math.max(0, lastDay - today.getDate());
}

// GET /operator/dashboard?month=
router.get("/operator/dashboard", requireAuth("operator"), wrap(async (req, res) => {
  const operatorId = req.user!.id;
  const month = (req.query.month as string) || currentMonth();

  const [operator] = await db.select().from(usersTable).where(eq(usersTable.id, operatorId));
  if (!operator) { res.status(404).json({ error: "Not found" }); return; }

  const [branchRow] = await db
    .select({ id: branchesTable.id, name: branchesTable.name, isActive: branchesTable.isActive, createdAt: branchesTable.createdAt, address: branchesTable.address })
    .from(branchOperatorsTable)
    .innerJoin(branchesTable, eq(branchOperatorsTable.branchId, branchesTable.id))
    .where(eq(branchOperatorsTable.operatorId, operatorId));

  const categories = await db.select().from(kpiCategoriesTable).where(eq(kpiCategoriesTable.isActive, true));
  const targets = await db.select().from(kpiTargetsTable).where(and(eq(kpiTargetsTable.operatorId, operatorId), eq(kpiTargetsTable.month, month)));
  const entries = await db.select().from(kpiEntriesTable).where(and(eq(kpiEntriesTable.operatorId, operatorId), sql`${kpiEntriesTable.date} LIKE ${month + "%"}`));

  const dl = daysLeft(month);
  const kpis = categories.map(cat => {
    const target = targets.find(t => t.categoryId === cat.id)?.target ?? 0;
    const dailyEntries = entries.filter(e => e.categoryId === cat.id);
    const actual = dailyEntries.reduce((s, e) => s + e.value, 0);
    const percent = target > 0 ? Math.round((actual / target) * 100) : 0;
    const needed = dl > 0 ? Math.ceil(Math.max(0, target - actual) / dl) : 0;
    return { category: cat, target, actual, percent, neededPerDay: needed, dailyEntries };
  });

  // Tariffs
  const tariffs = await db.select().from(tariffsTable).where(eq(tariffsTable.isActive, true));
  const tariffTgts = await db.select().from(tariffTargetsTable).where(and(eq(tariffTargetsTable.operatorId, operatorId), eq(tariffTargetsTable.month, month)));
  const tariffSales = await db.select().from(tariffSalesTable).where(and(eq(tariffSalesTable.operatorId, operatorId), sql`${tariffSalesTable.date} LIKE ${month + "%"}`));

  const tariffStats = tariffs.map(t => {
    const target = tariffTgts.find(x => x.tariffId === t.id)?.target ?? 0;
    const dailySales = tariffSales.filter(s => s.tariffId === t.id);
    const quantity = dailySales.reduce((s, x) => s + x.quantity, 0);
    const revenue = quantity * t.price;
    const percent = target > 0 ? Math.round((quantity / target) * 100) : 0;
    const needed = dl > 0 ? Math.ceil(Math.max(0, target - quantity) / dl) : 0;
    return { tariff: t, target, quantity, revenue, percent, neededPerDay: needed, dailySales };
  });
  const totalRevenue = tariffStats.reduce((s, t) => s + t.revenue, 0);

  // Team rank
  let teamRank = 1, teamSize = 1;
  if (branchRow) {
    const branchOpRows = await db.select({ id: usersTable.id })
      .from(branchOperatorsTable)
      .innerJoin(usersTable, eq(branchOperatorsTable.operatorId, usersTable.id))
      .where(eq(branchOperatorsTable.branchId, branchRow.id));
    teamSize = branchOpRows.length;
    const ranks: { id: number; avg: number }[] = [];
    for (const op of branchOpRows) {
      const t = await db.select().from(kpiTargetsTable).where(and(eq(kpiTargetsTable.operatorId, op.id), eq(kpiTargetsTable.month, month)));
      const e = await db.select().from(kpiEntriesTable).where(and(eq(kpiEntriesTable.operatorId, op.id), sql`${kpiEntriesTable.date} LIKE ${month + "%"}`));
      const avgs = categories.map(cat => {
        const tgt = t.find(x => x.categoryId === cat.id)?.target ?? 0;
        const act = e.filter(x => x.categoryId === cat.id).reduce((s, x) => s + x.value, 0);
        return tgt > 0 ? (act / tgt) * 100 : 0;
      }).filter(v => v > 0);
      ranks.push({ id: op.id, avg: avgs.length ? avgs.reduce((s, v) => s + v, 0) / avgs.length : 0 });
    }
    ranks.sort((a, b) => b.avg - a.avg);
    const idx = ranks.findIndex(r => r.id === operatorId);
    teamRank = idx >= 0 ? idx + 1 : 1;
  }

  res.json({ operator, branch: branchRow ?? null, month, kpis, tariffStats, totalRevenue, daysLeft: dl, teamRank, teamSize });
}));

// GET /operator/entries?month=
router.get("/operator/entries", requireAuth("operator"), wrap(async (req, res) => {
  const operatorId = req.user!.id;
  const month = (req.query.month as string) || currentMonth();
  res.json(await db.select().from(kpiEntriesTable).where(and(eq(kpiEntriesTable.operatorId, operatorId), sql`${kpiEntriesTable.date} LIKE ${month + "%"}`)));
}));

// POST /operator/entries
router.post("/operator/entries", requireAuth("operator"), wrap(async (req, res) => {
  const operatorId = req.user!.id;
  const parsed = z.object({ categoryId: z.number().int(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), value: z.number().int().min(0) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const existing = await db.select().from(kpiEntriesTable).where(and(eq(kpiEntriesTable.operatorId, operatorId), eq(kpiEntriesTable.categoryId, parsed.data.categoryId), eq(kpiEntriesTable.date, parsed.data.date)));
  if (existing.length > 0) {
    const [u] = await db.update(kpiEntriesTable).set({ value: parsed.data.value }).where(eq(kpiEntriesTable.id, existing[0].id)).returning();
    res.json(u);
  } else {
    const [c] = await db.insert(kpiEntriesTable).values({ ...parsed.data, operatorId }).returning();
    res.status(201).json(c);
  }
}));

// GET /operator/tariff-sales?month=
router.get("/operator/tariff-sales", requireAuth("operator"), wrap(async (req, res) => {
  const operatorId = req.user!.id;
  const month = (req.query.month as string) || currentMonth();
  res.json(await db.select().from(tariffSalesTable).where(and(eq(tariffSalesTable.operatorId, operatorId), sql`${tariffSalesTable.date} LIKE ${month + "%"}`)));
}));

// POST /operator/tariff-sales
router.post("/operator/tariff-sales", requireAuth("operator"), wrap(async (req, res) => {
  const operatorId = req.user!.id;
  const parsed = z.object({ tariffId: z.number().int(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), quantity: z.number().int().min(0) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const existing = await db.select().from(tariffSalesTable).where(and(eq(tariffSalesTable.operatorId, operatorId), eq(tariffSalesTable.tariffId, parsed.data.tariffId), eq(tariffSalesTable.date, parsed.data.date)));
  if (existing.length > 0) {
    const [u] = await db.update(tariffSalesTable).set({ quantity: parsed.data.quantity }).where(eq(tariffSalesTable.id, existing[0].id)).returning();
    res.json(u);
  } else {
    const [c] = await db.insert(tariffSalesTable).values({ ...parsed.data, operatorId }).returning();
    res.status(201).json(c);
  }
}));

export default router;
