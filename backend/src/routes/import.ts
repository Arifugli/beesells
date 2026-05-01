import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { db } from "../db.js";
import {
  usersTable, kpiCategoriesTable, kpiTargetsTable, kpiEntriesTable, tariffsTable
} from "../schema.js";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import { z } from "zod";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
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

// Normalize: lowercase, trim, collapse spaces, remove extra punctuation
function norm(s: string): string {
  return s.toLowerCase().replace(/[«»"'()\[\]]/g, "").replace(/\s+/g, " ").trim();
}

// Calculate similarity: what % of words from needle appear in haystack
function wordSimilarity(a: string, b: string): number {
  const wa = norm(a).split(" ").filter(w => w.length > 2);
  const nb = norm(b);
  if (wa.length === 0) return 0;
  const matched = wa.filter(w => nb.includes(w)).length;
  return matched / wa.length;
}

// Extract ФИО from employee row: remove job title parts
function extractPersonName(raw: string): string {
  // Remove common job title words
  const cleaned = raw
    .replace(/^(Старший|специалист|руководитель|менеджер|директор|начальник|заместитель)/gi, "")
    .replace(/специалист продаж и обслуживания/gi, "")
    .replace(/\(Е\d+\)/gi, "")
    .replace(/\(М\)/gi, "")
    .replace(/ОПиО/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned;
}

// Is this row an employee name row?
// Employee rows: col A = long string with name, col B = null/empty
function isNameRow(row: any[]): boolean {
  const a = row[0], b = row[1];
  return (
    typeof a === "string" &&
    a.trim().length > 5 &&
    (b === null || b === undefined || b === "")
  );
}

// Is this a KPI data row?
// KPI rows: col A = KPI name, col B = unit (шт, %, мин, сум)
const KPI_UNITS = ["шт", "шт.", "%", "мин", "сум", "млн", "раз", "звонок"];
function isKpiRow(row: any[]): boolean {
  const a = row[0], b = row[1];
  return (
    typeof a === "string" &&
    a.trim().length > 3 &&
    typeof b === "string" &&
    KPI_UNITS.includes(b.trim().toLowerCase())
  );
}

function parseSheet(ws: XLSX.WorkSheet): {
  employees: Array<{ rawName: string; cleanName: string; kpis: Array<{ name: string; unit: string; plan: number | null; fact: number | null }> }>;
} {
  const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null });
  const employees: any[] = [];
  let current: any = null;

  for (const row of data) {
    if (!row || row.every((v: any) => v === null || v === undefined)) continue;

    if (isNameRow(row)) {
      if (current) employees.push(current);
      const rawName = String(row[0]).replace(/\s+/g, " ").trim();
      current = {
        rawName,
        cleanName: extractPersonName(rawName),
        kpis: [],
      };
    } else if (isKpiRow(row) && current) {
      // Plan is in column D (index 3), Fact is in column E (index 4)
      const plan = typeof row[3] === "number" ? row[3] : null;
      const fact = typeof row[4] === "number" ? row[4] : null;
      current.kpis.push({
        name: String(row[0]).trim(),
        unit: String(row[1]).trim(),
        plan,
        fact,
      });
    }
  }
  if (current) employees.push(current);
  return { employees };
}

// Match employee to operator in DB
function matchOperator(emp: { rawName: string; cleanName: string }, operators: { id: number; name: string }[]): { id: number; name: string } | null {
  const raw = norm(emp.rawName);
  const clean = norm(emp.cleanName);

  // 1. Exact match on full raw name
  let match = operators.find(op => norm(op.name) === raw);
  if (match) return match;

  // 2. Exact match on cleaned name
  match = operators.find(op => norm(op.name) === clean);
  if (match) return match;

  // 3. Raw contains operator name or operator name contains raw
  match = operators.find(op => {
    const opNorm = norm(op.name);
    return raw.includes(opNorm) || opNorm.includes(raw);
  });
  if (match) return match;

  // 4. Word similarity — all parts of operator name appear in raw
  match = operators.find(op => {
    const opWords = norm(op.name).split(" ").filter(w => w.length > 2);
    if (opWords.length === 0) return false;
    return opWords.every(w => raw.includes(w));
  });
  if (match) return match;

  // 5. High word similarity (>= 60% of words match)
  let bestScore = 0;
  let bestMatch: { id: number; name: string } | null = null;
  for (const op of operators) {
    const score = Math.max(
      wordSimilarity(op.name, emp.rawName),
      wordSimilarity(emp.cleanName, op.name),
    );
    if (score > bestScore) { bestScore = score; bestMatch = op; }
  }
  if (bestScore >= 0.6) return bestMatch;

  return null;
}

// Match KPI name to category in DB
function matchCategory(kpiName: string, categories: { id: number; name: string; unit: string }[]): { id: number; name: string } | null {
  const nKpi = norm(kpiName);

  // 1. Exact
  let match = categories.find(c => norm(c.name) === nKpi);
  if (match) return match;

  // 2. Contains each other
  match = categories.find(c => {
    const nCat = norm(c.name);
    return nKpi.includes(nCat) || nCat.includes(nKpi);
  });
  if (match) return match;

  // 3. Word similarity
  let bestScore = 0;
  let bestMatch: { id: number; name: string; unit: string } | null = null;
  for (const cat of categories) {
    const score = Math.max(
      wordSimilarity(cat.name, kpiName),
      wordSimilarity(kpiName, cat.name),
    );
    if (score > bestScore) { bestScore = score; bestMatch = cat; }
  }
  if (bestScore >= 0.5) return bestMatch;

  return null;
}

// ── Routes ────────────────────────────────────────────────────────────────────

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
    const opMatch = matchOperator(emp, allOperators);

    const kpisMatched = emp.kpis.map((kpi: any) => {
      const catMatch = matchCategory(kpi.name, allCategories);
      return {
        ...kpi,
        categoryId: catMatch?.id ?? null,
        categoryName: catMatch?.name ?? null,
      };
    });

    return {
      rawName: emp.rawName,
      operatorId: opMatch?.id ?? null,
      operatorName: opMatch?.name ?? null,
      matched: !!opMatch,
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

// POST /import/tariffs
router.post("/import/tariffs", canImport, upload.single("file"), wrap(async (req, res) => {
  if (!req.file) { res.status(400).json({ error: "Файл не загружен" }); return; }

  const wb = XLSX.read(req.file.buffer, { type: "buffer" });
  const results: { name: string; price: number; action: "created" | "updated" }[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null });

    for (const row of rows) {
      if (!row || row.length < 2) continue;
      let name: string | null = null;
      let price: number | null = null;
      for (const cell of row) {
        if (typeof cell === "string" && cell.trim().length > 1 && !name) name = cell.trim();
        else if (typeof cell === "number" && cell > 0 && !price) price = cell;
      }
      if (!name || price === null) continue;
      if (norm(name).includes("назван") || norm(name).includes("тариф")) continue;

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
