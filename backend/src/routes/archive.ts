import { Router } from "express";
import { db } from "../db.js";
import {
  usersTable, branchesTable, branchManagersTable,
  branchOperatorsTable, kpiCategoriesTable, kpiTargetsTable, kpiEntriesTable
} from "../schema.js";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Substr to YYYY-MM from a YYYY-MM-DD date stored in text column
const monthExpr = sql`substring(${kpiEntriesTable.date}, 1, 7)`;

// GET /archive/months  — distinct months that have any entries OR targets
// (plus always include the current month so fresh deployments aren't empty)
router.get("/archive/months", requireAuth("admin", "manager", "operator"), async (req, res) => {
  const user = req.user!;

  // scope: operator only their own; manager only their branches; admin all
  const conditions = [];
  if (user.role === "operator") {
    conditions.push(eq(kpiEntriesTable.operatorId, user.id));
  } else if (user.role === "manager") {
    // collect branch IDs this manager manages, then all operator IDs
    const brs = await db.select({ id: branchManagersTable.branchId })
      .from(branchManagersTable).where(eq(branchManagersTable.managerId, user.id));
    const branchIds = brs.map(b => b.id);
    if (branchIds.length === 0) { res.json([currentMonth()]); return; }
    const ops = await db.select({ id: branchOperatorsTable.operatorId })
      .from(branchOperatorsTable)
      .where(sql`${branchOperatorsTable.branchId} = ANY(${branchIds})`);
    const opIds = ops.map(o => o.id);
    if (opIds.length === 0) { res.json([currentMonth()]); return; }
    conditions.push(sql`${kpiEntriesTable.operatorId} = ANY(${opIds})`);
  }

  let q = db.selectDistinct({ month: monthExpr }).from(kpiEntriesTable).$dynamic();
  if (conditions.length > 0) q = q.where(and(...conditions));
  const rows = await q;

  // Also pull distinct months from targets (in case plans are set but no entries yet)
  let tq = db.selectDistinct({ month: kpiTargetsTable.month }).from(kpiTargetsTable).$dynamic();
  if (user.role === "operator") {
    tq = tq.where(eq(kpiTargetsTable.operatorId, user.id));
  } else if (user.role === "manager") {
    const brs = await db.select({ id: branchManagersTable.branchId })
      .from(branchManagersTable).where(eq(branchManagersTable.managerId, user.id));
    const branchIds = brs.map(b => b.id);
    if (branchIds.length > 0) {
      const ops = await db.select({ id: branchOperatorsTable.operatorId })
        .from(branchOperatorsTable)
        .where(sql`${branchOperatorsTable.branchId} = ANY(${branchIds})`);
      const opIds = ops.map(o => o.id);
      if (opIds.length > 0) {
        tq = tq.where(sql`${kpiTargetsTable.operatorId} = ANY(${opIds})`);
      } else {
        tq = tq.where(sql`false`);
      }
    } else {
      tq = tq.where(sql`false`);
    }
  }
  const tRows = await tq;

  const set = new Set<string>();
  for (const r of rows) if (r.month) set.add(String(r.month));
  for (const r of tRows) if (r.month) set.add(String(r.month));
  set.add(currentMonth());

  const sorted = Array.from(set).sort().reverse();
  res.json(sorted);
});

export default router;
