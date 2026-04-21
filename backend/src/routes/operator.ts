import { Router } from "express";
import { db } from "../db.js";
import {
  usersTable, branchesTable, branchOperatorsTable,
  kpiCategoriesTable, kpiTargetsTable, kpiEntriesTable
} from "../schema.js";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import { z } from "zod";

const router = Router();
const operatorOnly = requireAuth("operator", "manager", "admin");

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function daysLeftInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const today = new Date();
  const cur = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  if (month !== cur) return 0;
  return Math.max(0, lastDay - today.getDate());
}

// GET /operator/dashboard?month=
router.get("/operator/dashboard", requireAuth("operator"), async (req, res): Promise<void> => {
  const operatorId = req.user!.id;
  const month = (req.query.month as string) || currentMonth();

  const [operator] = await db.select().from(usersTable).where(eq(usersTable.id, operatorId));
  if (!operator) { res.status(404).json({ error: "Not found" }); return; }

  // branch
  const [branchRow] = await db
    .select({ id: branchesTable.id, name: branchesTable.name })
    .from(branchOperatorsTable)
    .innerJoin(branchesTable, eq(branchOperatorsTable.branchId, branchesTable.id))
    .where(eq(branchOperatorsTable.operatorId, operatorId));

  const categories = await db.select().from(kpiCategoriesTable).where(eq(kpiCategoriesTable.isActive, true));
  const targets = await db.select().from(kpiTargetsTable).where(
    and(eq(kpiTargetsTable.operatorId, operatorId), eq(kpiTargetsTable.month, month))
  );
  const entries = await db.select().from(kpiEntriesTable).where(
    and(eq(kpiEntriesTable.operatorId, operatorId), sql`${kpiEntriesTable.date} LIKE ${month + "%"}`)
  );

  const daysLeft = daysLeftInMonth(month);

  const kpis = categories.map(cat => {
    const target = targets.find(t => t.categoryId === cat.id)?.target ?? 0;
    const dailyEntries = entries.filter(e => e.categoryId === cat.id);
    const actual = dailyEntries.reduce((s, e) => s + e.value, 0);
    const percent = target > 0 ? Math.round((actual / target) * 100) : 0;
    const needed = daysLeft > 0 ? Math.ceil(Math.max(0, target - actual) / daysLeft) : 0;
    return { category: cat, target, actual, percent, neededPerDay: needed, dailyEntries };
  });

  // team rank by avg percent
  const branchOpRows = branchRow
    ? await db.select({ id: usersTable.id })
        .from(branchOperatorsTable)
        .innerJoin(usersTable, eq(branchOperatorsTable.operatorId, usersTable.id))
        .where(eq(branchOperatorsTable.branchId, branchRow.id))
    : [];

  const teamRanks = await Promise.all(branchOpRows.map(async (op) => {
    const t = await db.select().from(kpiTargetsTable).where(
      and(eq(kpiTargetsTable.operatorId, op.id), eq(kpiTargetsTable.month, month))
    );
    const e = await db.select().from(kpiEntriesTable).where(
      and(eq(kpiEntriesTable.operatorId, op.id), sql`${kpiEntriesTable.date} LIKE ${month + "%"}`)
    );
    const avgs = categories.map(cat => {
      const tgt = t.find(x => x.categoryId === cat.id)?.target ?? 0;
      const act = e.filter(x => x.categoryId === cat.id).reduce((s, x) => s + x.value, 0);
      return tgt > 0 ? (act / tgt) * 100 : 0;
    }).filter(v => v > 0);
    const avg = avgs.length > 0 ? avgs.reduce((s, v) => s + v, 0) / avgs.length : 0;
    return { id: op.id, avg };
  }));

  teamRanks.sort((a, b) => b.avg - a.avg);
  const rank = teamRanks.findIndex(r => r.id === operatorId) + 1;

  res.json({
    operator,
    branch: branchRow ?? null,
    month,
    kpis,
    daysLeft,
    teamRank: rank || 1,
    teamSize: branchOpRows.length,
  });
});

// GET /operator/entries?month=
router.get("/operator/entries", requireAuth("operator"), async (req, res) => {
  const operatorId = req.user!.id;
  const month = (req.query.month as string) || currentMonth();
  const entries = await db.select().from(kpiEntriesTable).where(
    and(eq(kpiEntriesTable.operatorId, operatorId), sql`${kpiEntriesTable.date} LIKE ${month + "%"}`)
  );
  res.json(entries);
});

// POST /operator/entries  — log or update a daily value
router.post("/operator/entries", requireAuth("operator"), async (req, res): Promise<void> => {
  const operatorId = req.user!.id;
  const parsed = z.object({
    categoryId: z.number().int(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    value: z.number().int().min(0),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const existing = await db.select().from(kpiEntriesTable).where(
    and(
      eq(kpiEntriesTable.operatorId, operatorId),
      eq(kpiEntriesTable.categoryId, parsed.data.categoryId),
      eq(kpiEntriesTable.date, parsed.data.date),
    )
  );

  if (existing.length > 0) {
    const [updated] = await db.update(kpiEntriesTable)
      .set({ value: parsed.data.value })
      .where(eq(kpiEntriesTable.id, existing[0].id))
      .returning();
    res.json(updated);
  } else {
    const [created] = await db.insert(kpiEntriesTable)
      .values({ ...parsed.data, operatorId })
      .returning();
    res.status(201).json(created);
  }
});

export default router;
