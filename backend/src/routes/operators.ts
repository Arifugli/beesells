import { Router } from "express";
import { db } from "../db.js";
import { operatorsTable } from "../schema.js";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const CreateOperatorBody = z.object({
  name: z.string().min(1),
  role: z.enum(["operator", "manager"]).default("operator"),
  simTarget: z.number().int().min(0).default(250),
  deviceTarget: z.number().int().min(0).default(50),
});

const UpdateOperatorBody = CreateOperatorBody.partial();

router.get("/operators", async (_req, res) => {
  const operators = await db.select().from(operatorsTable).orderBy(operatorsTable.name);
  res.json(operators);
});

router.post("/operators", async (req, res): Promise<void> => {
  const parsed = CreateOperatorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [operator] = await db.insert(operatorsTable).values(parsed.data).returning();
  res.status(201).json(operator);
});

router.get("/operators/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [operator] = await db.select().from(operatorsTable).where(eq(operatorsTable.id, id));
  if (!operator) { res.status(404).json({ error: "Not found" }); return; }
  res.json(operator);
});

router.put("/operators/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateOperatorBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [operator] = await db.update(operatorsTable).set(parsed.data).where(eq(operatorsTable.id, id)).returning();
  if (!operator) { res.status(404).json({ error: "Not found" }); return; }
  res.json(operator);
});

router.delete("/operators/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(operatorsTable).where(eq(operatorsTable.id, id));
  res.status(204).send();
});

export default router;
