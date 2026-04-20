import { Router } from "express";
import { db } from "../db.js";
import { operatorsTable, salesEntriesTable } from "../schema.js";
import { eq, and, sql } from "drizzle-orm";

const router = Router();

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getDaysLeftInMonth(month: string): number {
  const [year, mon] = month.split("-").map(Number);
  const lastDay = new Date(year, mon, 0).getDate();
  const today = new Date();
  const currentMonth = getCurrentMonth();
  if (month !== currentMonth) return 0;
  return Math.max(0, lastDay - today.getDate());
}

// GET /dashboard/operator/:operatorId?month=YYYY-MM
router.get("/dashboard/operator/:operatorId", async (req, res): Promise<void> => {
  const operatorId = Number(req.params.operatorId);
  if (isNaN(operatorId)) { res.status(400).json({ error: "Invalid operatorId" }); return; }

  const month = (req.query.month as string) || getCurrentMonth();

  const [operator] = await db.select().from(operatorsTable).where(eq(operatorsTable.id, operatorId));
  if (!operator) { res.status(404).json({ error: "Operator not found" }); return; }

  const dailySales = await db.select().from(salesEntriesTable)
    .where(and(
      eq(salesEntriesTable.operatorId, operatorId),
      sql`${salesEntriesTable.date} LIKE ${month + "%"}`
    ))
    .orderBy(salesEntriesTable.date);

  const simSold = dailySales.reduce((s, e) => s + e.simSold, 0);
  const devicesSold = dailySales.reduce((s, e) => s + e.devicesSold, 0);
  const daysLeft = getDaysLeftInMonth(month);

  // Team rank
  const allOperators = await db.select().from(operatorsTable).where(eq(operatorsTable.role, "operator"));
  const teamSales = await Promise.all(
    allOperators.map(async (op) => {
      const entries = await db.select().from(salesEntriesTable)
        .where(and(
          eq(salesEntriesTable.operatorId, op.id),
          sql`${salesEntriesTable.date} LIKE ${month + "%"}`
        ));
      return { id: op.id, sim: entries.reduce((s, e) => s + e.simSold, 0) };
    })
  );
  teamSales.sort((a, b) => b.sim - a.sim);
  const teamRank = teamSales.findIndex((s) => s.id === operatorId) + 1;

  res.json({
    operator,
    month,
    simSold,
    devicesSold,
    simTarget: operator.simTarget,
    deviceTarget: operator.deviceTarget,
    simPercent: operator.simTarget > 0 ? Math.round((simSold / operator.simTarget) * 100) : 0,
    devicePercent: operator.deviceTarget > 0 ? Math.round((devicesSold / operator.deviceTarget) * 100) : 0,
    daysLeft,
    simNeededPerDay: daysLeft > 0 ? Math.ceil(Math.max(0, operator.simTarget - simSold) / daysLeft) : 0,
    deviceNeededPerDay: daysLeft > 0 ? Math.ceil(Math.max(0, operator.deviceTarget - devicesSold) / daysLeft) : 0,
    teamRank: teamRank || 1,
    totalOperators: allOperators.length,
    dailySales,
  });
});

// GET /dashboard/manager?month=YYYY-MM
router.get("/dashboard/manager", async (req, res) => {
  const month = (req.query.month as string) || getCurrentMonth();

  const allOperators = await db.select().from(operatorsTable).where(eq(operatorsTable.role, "operator"));

  const operatorStats = await Promise.all(
    allOperators.map(async (op) => {
      const entries = await db.select().from(salesEntriesTable)
        .where(and(
          eq(salesEntriesTable.operatorId, op.id),
          sql`${salesEntriesTable.date} LIKE ${month + "%"}`
        ));
      const simSold = entries.reduce((s, e) => s + e.simSold, 0);
      const devicesSold = entries.reduce((s, e) => s + e.devicesSold, 0);
      return {
        operator: op,
        simSold,
        devicesSold,
        simPercent: op.simTarget > 0 ? Math.round((simSold / op.simTarget) * 100) : 0,
        devicePercent: op.deviceTarget > 0 ? Math.round((devicesSold / op.deviceTarget) * 100) : 0,
        rank: 0,
      };
    })
  );

  operatorStats.sort((a, b) => {
    const avgA = (a.simPercent + a.devicePercent) / 2;
    const avgB = (b.simPercent + b.devicePercent) / 2;
    return avgB - avgA;
  });
  operatorStats.forEach((s, i) => { s.rank = i + 1; });

  res.json({
    month,
    totalSim: operatorStats.reduce((s, o) => s + o.simSold, 0),
    totalDevices: operatorStats.reduce((s, o) => s + o.devicesSold, 0),
    totalSimTarget: allOperators.reduce((s, o) => s + o.simTarget, 0),
    totalDeviceTarget: allOperators.reduce((s, o) => s + o.deviceTarget, 0),
    operatorsCount: allOperators.length,
    behindCount: operatorStats.filter(o => (o.simPercent + o.devicePercent) / 2 < 65).length,
    operators: operatorStats,
  });
});

// GET /dashboard/team-activity?month=YYYY-MM
router.get("/dashboard/team-activity", async (req, res) => {
  const month = (req.query.month as string) || getCurrentMonth();

  const entries = await db.select().from(salesEntriesTable)
    .where(sql`${salesEntriesTable.date} LIKE ${month + "%"}`)
    .orderBy(salesEntriesTable.date);

  const byDate: Record<string, { simSold: number; devicesSold: number }> = {};
  for (const entry of entries) {
    if (!byDate[entry.date]) byDate[entry.date] = { simSold: 0, devicesSold: 0 };
    byDate[entry.date].simSold += entry.simSold;
    byDate[entry.date].devicesSold += entry.devicesSold;
  }

  // Cumulative
  let cumSim = 0, cumDev = 0;
  const result = Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => {
      cumSim += vals.simSold;
      cumDev += vals.devicesSold;
      return { date, simSold: vals.simSold, devicesSold: vals.devicesSold, cumSim, cumDev };
    });

  res.json(result);
});

export default router;
