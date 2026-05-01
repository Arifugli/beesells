import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { db } from "../db.js";
import {
  usersTable, kpiCategoriesTable, kpiTargetsTable, kpiEntriesTable, tariffsTable
} from "../schema.js";
import { eq, and, ilike, or } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import { z } from "zod";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const canImport = requireAuth("admin", "manager");

function wrap(fn: (req: any, res: any) => Promise<void>) {
  return async (req: any, res: any, next: any) => {
    try { await fn(req, res); }
    catch (err: any) {
      console.error(`[import] ${req.method} ${req.path}:`, err?.message);
      if (!res.headersSent) res.status(500).json({ error: err?.message || "Server error" });
    }
  };
}

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function isNameRow(row: any[]): boolean {
  const a = row[0], b = row[1];
  return (
    typeof a === "string" && a.trim().length > 3 &&
    (b === null || b === undefined || b === "")
  );
}

function isKpiRow(row: any[]): boolean {
  const a = row[0], b = row[1];
  return (
    typeof a === "string" && a.trim().length > 3 &&
    typeof b === "string" &&
    ["шт", "%", "мин", "сум", "шт."].includes(b.trim().toLowerCase())
  );
}

function parseSheet(ws: XLSX.WorkSheet) {
  const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null });
  const employees: any[] = [];
  const sheetKpis = new Set<string>();
  let current: any = null;

  for (const row of data) {
    if (!row || row.every((v: any) => v === null || v === undefined)) continue;
    if (isNameRow(row)) {
      if (current) employees.push(current);
      current = { rawName: String(row[0]).replace(/\s+/g, " ").trim(), kpis: [] };
    } else if (isKpiRow(row) && current) {
      const name = String(row[0]).trim();
      const unit = String(row[1]).trim();
      const plan = typeof row[3] === "number" ? row[3] : null;
      const fact = typeof row[4] === "number" ? row[4] : null;
      current.kpis.push({ name, unit, plan, fact });
      sheetKpis.add(name);
    }
  }
  if (current) employees.push(current);
  return { employees, sheetKpis };
}

// POST /import/sheets
router.post("/import/sheets", canImport, upload.single("file"), wrap(async (req, res) => {
  if (!req.file) { res.status(400).json({ error: "Файл не загружен" }); return; }
  const wb = XLSX.read(req.file.buffer, { type: "buffer" });
  res.json({ sheets: wb.SheetNames });
}));

// POST /import/preview
router.post("/import/preview", canImport, upload.single("file"), wrap(async (req, res) => {
  if (!req.file) { res.status(400).json({ error: "Файл не загружен" }); return; }
  const { sheet, month } = req.body;
  if (!sheet || !month) { res.status(400).json({ error: "Укажите sheet и month" }); return; }

  const wb = XLSX.read(req.file.buffer, { type: "buffer" });
  if (!wb.SheetNames.includes(sheet)) { res.status(400).json({ error: "Лист не найден" }); return; }

  const { employees } = parseSheet(wb.Sheets[sheet]);

  const allOperators = await db.select({ id: usersTable.id, name: usersTable.name })
    .from(usersTable).where(eq(usersTable.role, "operator"));
  const allCategories = await db.select().from(kpiCategoriesTable);

  const matched = employees.map(emp => {
    const nName = norm(emp.rawName);
    let match = allOperators.find(op => norm(op.name) === nName);
    if (!match) {
      match = allOperators.find(op => {
        const opNorm = norm(op.name);
        const nameParts = opNorm.split(" ");
        return nameParts.filter(p => p.length > 2).every(p => nName.includes(p));
      });
    }

    const kpisMatched = emp.kpis.map((kpi: any) => {
      const nKpi = norm(kpi.name);
      const catMatch = allCategories.find(cat => {
        const nCat = norm(cat.name);
        return nCat === nKpi || nKpi.includes(nCat) || nCat.split(" ").slice(0, 3).every((w: string) => w.length < 3 || nKpi.includes(w));
      });
      return { ...kpi, categoryId: catMatch?.id ?? null, categoryName: catMatch?.name ?? null };
    });

    return {
      rawName: emp.rawName,
      operatorId: match?.id ?? null,
      operatorName: match?.name ?? null,
      matched: !!match,
      kpis: kpisMatched,
    };
  });

  res.json({
    employees: matched,
    allOperators: allOperators.map(op => ({ id: op.id, name: op.name })),
    allCategories: allCategories.map(c => ({ id: c.id, name: c.name, unit: c.unit })),
    month,
    sheet,
  });
}));

// POST /import/confirm
router.post("/import/confirm", canImport, wrap(async (req, res) => {
  const parsed = z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/),
    entries: z.array(z.object({
      operatorId: z.number().int(),
      categoryId: z.number().int(),
      plan: z.number().nullable(),
      fact: z.number().nullable(),
    })),
  }).safeParse(req.body);

  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }
  const { month, entries } = parsed.data;

  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const factDate = `${month}-${String(lastDay).padStart(2, "0")}`;

  let plansSaved = 0, factsSaved = 0;

  for (const entry of entries) {
    if (entry.plan !== null && entry.plan > 0) {
      const ex = await db.select().from(kpiTargetsTable).where(
        and(eq(kpiTargetsTable.operatorId, entry.operatorId), eq(kpiTargetsTable.categoryId, entry.categoryId), eq(kpiTargetsTable.month, month))
      );
      if (ex.length > 0) {
        await db.update(kpiTargetsTable).set({ target: Math.round(entry.plan) }).where(eq(kpiTargetsTable.id, ex[0].id));
      } else {
        await db.insert(kpiTargetsTable).values({ operatorId: entry.operatorId, categoryId: entry.categoryId, month, target: Math.round(entry.plan) });
      }
      plansSaved++;
    }

    if (entry.fact !== null && entry.fact > 0) {
      const ex = await db.select().from(kpiEntriesTable).where(
        and(eq(kpiEntriesTable.operatorId, entry.operatorId), eq(kpiEntriesTable.categoryId, entry.categoryId), eq(kpiEntriesTable.date, factDate))
      );
      if (ex.length > 0) {
        await db.update(kpiEntriesTable).set({ value: Math.round(entry.fact) }).where(eq(kpiEntriesTable.id, ex[0].id));
      } else {
        await db.insert(kpiEntriesTable).values({ operatorId: entry.operatorId, categoryId: entry.categoryId, date: factDate, value: Math.round(entry.fact) });
      }
      factsSaved++;
    }
  }

  res.json({ ok: true, plansSaved, factsSaved });
}));

// POST /import/tariffs — parse Excel file and create/update tariffs
router.post("/import/tariffs", canImport, upload.single("file"), wrap(async (req, res) => {
  if (!req.file) { res.status(400).json({ error: "Файл не загружен" }); return; }

  const wb = XLSX.read(req.file.buffer, { type: "buffer" });
  const results: { name: string; price: number; action: "created" | "updated" | "skipped" }[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null });

    for (const row of rows) {
      if (!row || row.length < 2) continue;

      // Look for rows with string name + numeric price anywhere in row
      let name: string | null = null;
      let price: number | null = null;

      for (const cell of row) {
        if (typeof cell === "string" && cell.trim().length > 1) {
          if (!name) name = cell.trim();
        } else if (typeof cell === "number" && cell > 0) {
          if (!price) price = cell;
        }
      }

      if (!name || price === null) continue;
      // Skip header-like rows
      if (name.toLowerCase().includes("назван") || name.toLowerCase().includes("тариф") && price < 100) continue;

      // Check if tariff already exists by name
      const existing = await db.select().from(tariffsTable).where(eq(tariffsTable.name, name));
      if (existing.length > 0) {
        await db.update(tariffsTable).set({ price: Math.round(price) }).where(eq(tariffsTable.id, existing[0].id));
        results.push({ name, price: Math.round(price), action: "updated" });
      } else {
        await db.insert(tariffsTable).values({ name, price: Math.round(price) });
        results.push({ name, price: Math.round(price), action: "created" });
      }
    }
  }

  res.json({ ok: true, results });
}));

export default router;
