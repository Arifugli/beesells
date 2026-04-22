import { Router } from "express";
import { db } from "../db.js";
import {
  branchManagersTable, branchOperatorsTable, kpiTargetsTable, kpiEntriesTable
} from "../schema.js";
import { eq, and, sql, inArray } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

function wrap(handler: (req: any, res: any) => Promise<void> | void) {
  return async (req: any, res: any, next: any) => {
    try { await handler(req, res); }
    catch (err: any) {
      console.error(`[archive] ${req.method} ${req.path} error:`, err);
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

const monthExpr = sql<string>`substring(${kpiEntriesTable.date}, 1, 7)`;

// GET /archive/months — distinct months that have entries OR targets (scoped by role)
router.get("/archive/months", requireAuth("admin", "manager", "operator"), wrap(async (req, res) => {
  const user = req.user!;
  const set = new Set<string>();
  set.add(currentMonth());

  // Scope operator IDs for queries
  let opIds: number[] | null = null; // null = no filter (admin), [] = empty
  if (user.role === "operator") {
    opIds = [user.id];
  } else if (user.role === "manager") {
    const brs = await db.select({ id: branchManagersTable.branchId })
      .from(branchManagersTable).where(eq(branchManagersTable.managerId, user.id));
    const branchIds = brs.map(b => b.id);
    if (branchIds.length === 0) {
      res.json(Array.from(set).sort().reverse());
      return;
    }
    const ops = await db.select({ id: branchOperatorsTable.operatorId })
      .from(branchOperatorsTable)
      .where(inArray(branchOperatorsTable.branchId, branchIds));
    opIds = ops.map(o => o.id);
    if (opIds.length === 0) {
      res.json(Array.from(set).sort().reverse());
      return;
    }
  }

  // Distinct months from entries
  let entryRows: { month: string | null }[];
  if (opIds === null) {
    entryRows = await db.selectDistinct({ month: monthExpr }).from(kpiEntriesTable);
  } else {
    entryRows = await db.selectDistinct({ month: monthExpr }).from(kpiEntriesTable)
      .where(inArray(kpiEntriesTable.operatorId, opIds));
  }
  for (const r of entryRows) if (r.month) set.add(String(r.month));

  // Distinct months from targets
  let targetRows: { month: string }[];
  if (opIds === null) {
    targetRows = await db.selectDistinct({ month: kpiTargetsTable.month }).from(kpiTargetsTable);
  } else {
    targetRows = await db.selectDistinct({ month: kpiTargetsTable.month }).from(kpiTargetsTable)
      .where(inArray(kpiTargetsTable.operatorId, opIds));
  }
  for (const r of targetRows) if (r.month) set.add(String(r.month));

  res.json(Array.from(set).sort().reverse());
}));

export default router;
