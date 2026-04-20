import { Router } from "express";
import { db } from "../db.js";
import { salesEntriesTable } from "../schema.js";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const CreateSalesBody = z.object({
  operatorId: z.number().int(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  simSold: z.number().int().min(0).default(0),
  devicesSold: z.number().int().min(0).default(0),
});

router.get("/sales", async (req, res) => {
  const { operatorId, month } = req.query;
  let query = db.select().from(salesEntriesTable).$dynamic();

  const conditions = [];
  if (operatorId) conditions.push(eq(salesEntriesTable.operatorId, Number(operatorId)));
  if (month) conditions.push(sql`${salesEntriesTable.date} LIKE ${month + "%"}`);

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const entries = await query.orderBy(salesEntriesTable.date);
  res.json(entries);
});

router.post("/sales", async (req, res): Promise<void> => {
  const parsed = CreateSalesBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    // Upsert: if entry exists for this operator+date, update it
    const existing = await db.select().from(salesEntriesTable)
      .where(and(
        eq(salesEntriesTable.operatorId, parsed.data.operatorId),
        eq(salesEntriesTable.date, parsed.data.date)
      ));

    if (existing.length > 0) {
      const [updated] = await db.update(salesEntriesTable)
        .set({ simSold: parsed.data.simSold, devicesSold: parsed.data.devicesSold })
        .where(eq(salesEntriesTable.id, existing[0].id))
        .returning();
      res.status(200).json(updated);
    } else {
      const [entry] = await db.insert(salesEntriesTable).values(parsed.data).returning();
      res.status(201).json(entry);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/sales/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const parsed = z.object({
    simSold: z.number().int().min(0).optional(),
    devicesSold: z.number().int().min(0).optional(),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [entry] = await db.update(salesEntriesTable).set(parsed.data).where(eq(salesEntriesTable.id, id)).returning();
  if (!entry) { res.status(404).json({ error: "Not found" }); return; }
  res.json(entry);
});

router.delete("/sales/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  await db.delete(salesEntriesTable).where(eq(salesEntriesTable.id, id));
  res.status(204).send();
});

export default router;
