import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { getToken } from "@/lib/api";
import { currentMonth, formatMonth } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  Upload, FileSpreadsheet, ChevronRight,
  Check, Loader2, AlertCircle, RefreshCw
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

type Step = "upload" | "preview" | "done";

interface KpiRow {
  name: string;
  unit: string;
  plan: number | null;
  fact: number | null;
  categoryId: number | null;
  categoryName: string | null;
}

interface EmployeeRow {
  rawName: string;
  operatorId: number | null;
  operatorName: string | null;
  matched: boolean;
  kpis: KpiRow[];
  resolvedOperatorId?: number | null;
  skip?: boolean;
}

interface PreviewData {
  employees: EmployeeRow[];
  allOperators: { id: number; name: string }[];
  allCategories: { id: number; name: string; unit: string }[];
  month: string;
  sheet: string;
}

function fmt(n: number | null) {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("ru-RU");
}

async function apiUpload(path: string, formData: FormData) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}` },
    body: formData,
  });
  if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
  return res.json();
}

async function apiJson(path: string, body: any) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
  return res.json();
}

export default function ImportPage() {
  const [step, setStep] = useState<Step>("upload");
  const [sheets, setSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [month, setMonth] = useState(currentMonth());
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [result, setResult] = useState<{ plansSaved: number; factsSaved: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const sheetsMutation = useMutation({
    mutationFn: async (f: File) => {
      const fd = new FormData(); fd.append("file", f);
      return apiUpload("/import/sheets", fd);
    },
    onSuccess: (data) => { setSheets(data.sheets); setSelectedSheet(data.sheets[0] ?? ""); },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const previewMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append("file", file!);
      fd.append("sheet", selectedSheet);
      fd.append("month", month);
      return apiUpload("/import/preview", fd);
    },
    onSuccess: (data: PreviewData) => {
      setPreview(data);
      setEmployees(data.employees.map(e => ({ ...e, resolvedOperatorId: e.operatorId, skip: false })));
      setStep("preview");
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const entries: any[] = [];
      for (const emp of employees) {
        if (emp.skip) continue;
        const opId = emp.resolvedOperatorId;
        if (!opId) continue;
        for (const kpi of emp.kpis) {
          if (!kpi.categoryId) continue;
          if ((kpi.plan ?? 0) > 0 || (kpi.fact ?? 0) > 0) {
            entries.push({ operatorId: opId, categoryId: kpi.categoryId, plan: kpi.plan, fact: kpi.fact });
          }
        }
      }
      if (entries.length === 0) throw new Error("Нет данных для импорта");
      return apiJson("/import/confirm", { month, entries });
    },
    onSuccess: (data) => { setResult(data); setStep("done"); toast("Данные импортированы!", "success"); },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const handleFile = (f: File) => {
    setFile(f); setSheets([]); setSelectedSheet("");
    sheetsMutation.mutate(f);
  };

  const setEmp = (i: number, patch: Partial<EmployeeRow>) =>
    setEmployees(prev => prev.map((e, idx) => idx === i ? { ...e, ...patch } : e));

  const unmatched = employees.filter(e => !e.resolvedOperatorId && !e.skip).length;
  const totalKpis = employees
    .filter(e => !e.skip && e.resolvedOperatorId)
    .reduce((s, e) => s + e.kpis.filter(k => k.categoryId && ((k.plan ?? 0) > 0 || (k.fact ?? 0) > 0)).length, 0);

  const steps = [
    { key: "upload", label: "Загрузка" },
    { key: "preview", label: "Проверка" },
    { key: "done", label: "Готово" },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in">
      <div>
        <h1 className="text-3xl font-bold">Импорт из Excel</h1>
        <p className="text-gray-500 mt-1 text-sm">Загрузите файл с планами и фактами — система считает данные автоматически.</p>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2 text-sm">
        {steps.map((s, i) => {
          const done = (step === "preview" && i === 0) || (step === "done" && i <= 1);
          const active = step === s.key;
          return (
            <div key={s.key} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                done ? "bg-emerald-500 text-white" : active ? "text-white" : "bg-gray-200 text-gray-500"
              }`} style={active ? { background: "hsl(var(--primary))" } : {}}>
                {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={active ? "font-medium text-gray-900" : "text-gray-400"}>{s.label}</span>
              {i < 2 && <ChevronRight className="w-4 h-4 text-gray-300" />}
            </div>
          );
        })}
      </div>

      {/* STEP 1 */}
      {step === "upload" && (
        <div className="space-y-4">
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            className="card p-12 border-2 border-dashed border-gray-200 hover:border-indigo-400 transition-colors cursor-pointer text-center"
          >
            <FileSpreadsheet className="w-14 h-14 text-gray-300 mx-auto mb-3" />
            {file ? (
              <>
                <p className="font-semibold text-gray-800">{file.name}</p>
                <p className="text-sm text-gray-400 mt-1">{(file.size / 1024).toFixed(0)} KB</p>
              </>
            ) : (
              <>
                <p className="font-medium text-gray-700">Нажмите или перетащите Excel файл</p>
                <p className="text-sm text-gray-400 mt-1">.xlsx с планами и фактами операторов</p>
              </>
            )}
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>

          {sheetsMutation.isPending && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />Читаем листы файла...
            </div>
          )}

          {sheets.length > 0 && (
            <div className="card p-6 space-y-5 shadow-sm">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Лист (месяц из файла)</label>
                <select value={selectedSheet} onChange={e => setSelectedSheet(e.target.value)} className="select">
                  {sheets.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Месяц в системе</label>
                <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="input" />
                <p className="text-xs text-gray-400">Данные будут записаны за {formatMonth(month)}</p>
              </div>
              <button onClick={() => previewMutation.mutate()}
                disabled={!selectedSheet || !month || previewMutation.isPending}
                className="btn-primary w-full">
                {previewMutation.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Анализируем...</>
                  : <><Upload className="w-4 h-4" />Проанализировать данные</>}
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP 2 */}
      {step === "preview" && preview && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="card p-4 shadow-sm flex flex-wrap gap-6 text-sm">
            <span><span className="text-gray-400">Сотрудников:</span> <strong>{employees.length}</strong></span>
            <span><span className="text-gray-400">Совпали:</span> <strong className="text-emerald-600">{employees.filter(e => e.matched).length}</strong></span>
            {unmatched > 0 && <span><span className="text-gray-400">Требуют уточнения:</span> <strong className="text-amber-500">{unmatched}</strong></span>}
            <span><span className="text-gray-400">Записей KPI:</span> <strong>{totalKpis}</strong></span>
          </div>

          {unmatched > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-sm text-amber-800">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Некоторые сотрудники не найдены в базе</p>
                <p className="mt-0.5">Выберите соответствие вручную или отметьте «Пропустить».</p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {employees.map((emp, ei) => (
              <div key={ei} className={`card overflow-hidden shadow-sm ${emp.skip ? "opacity-40" : ""}`}>
                <div className={`px-5 py-3 flex flex-wrap items-center justify-between gap-3 ${
                  emp.skip ? "bg-gray-50"
                  : emp.matched ? "bg-emerald-50"
                  : emp.resolvedOperatorId ? "bg-blue-50"
                  : "bg-amber-50"
                }`}>
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      emp.matched ? "bg-emerald-500" : emp.resolvedOperatorId ? "bg-blue-500" : "bg-amber-400"
                    }`} />
                    <span className="text-xs text-gray-500 truncate max-w-xs">{emp.rawName}</span>
                    {emp.resolvedOperatorId && (
                      <span className="text-xs font-medium text-indigo-600">
                        → {preview.allOperators.find(o => o.id === emp.resolvedOperatorId)?.name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <select
                      value={emp.resolvedOperatorId ?? ""}
                      onChange={e => setEmp(ei, { resolvedOperatorId: e.target.value ? Number(e.target.value) : null, skip: false })}
                      disabled={emp.skip}
                      className="select text-xs h-8 min-w-[160px]"
                    >
                      <option value="">— не найден —</option>
                      {preview.allOperators.map(op => (
                        <option key={op.id} value={op.id}>{op.name}</option>
                      ))}
                    </select>
                    <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer whitespace-nowrap">
                      <input type="checkbox" checked={emp.skip ?? false}
                        onChange={e => setEmp(ei, { skip: e.target.checked })} />
                      Пропустить
                    </label>
                  </div>
                </div>

                {!emp.skip && (
                  <div className="divide-y divide-gray-50">
                    {emp.kpis.map((kpi, ki) => (
                      <div key={ki} className="px-5 py-2 flex items-center gap-4 text-xs">
                        <div className="flex-1 min-w-0">
                          <span className={kpi.categoryId ? "text-gray-700" : "text-red-400"}>
                            {kpi.name}
                          </span>
                          {kpi.categoryId
                            ? <span className="ml-2 text-indigo-400">→ {kpi.categoryName}</span>
                            : <span className="ml-2 text-red-400">— категория не найдена</span>
                          }
                        </div>
                        <div className="flex gap-4 text-gray-500 shrink-0">
                          <span>План: <strong className="text-gray-800">{fmt(kpi.plan)}</strong> {kpi.unit}</span>
                          <span>Факт: <strong className="text-gray-800">{fmt(kpi.fact)}</strong> {kpi.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button onClick={() => { setStep("upload"); setPreview(null); }} className="btn-outline gap-2">
              <RefreshCw className="w-4 h-4" />Назад
            </button>
            <button onClick={() => confirmMutation.mutate()}
              disabled={confirmMutation.isPending || totalKpis === 0}
              className="btn-primary flex-1">
              {confirmMutation.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" />Импортируем...</>
                : <><Upload className="w-4 h-4" />Импортировать {totalKpis} записей за {formatMonth(month)}</>}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 */}
      {step === "done" && result && (
        <div className="card p-16 text-center space-y-5 shadow-sm">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
            <Check className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold">Импорт завершён!</h2>
          <div className="flex justify-center gap-10 text-sm">
            <div className="text-center">
              <p className="text-3xl font-bold text-indigo-600">{result.plansSaved}</p>
              <p className="text-gray-400 mt-1">планов сохранено</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-emerald-600">{result.factsSaved}</p>
              <p className="text-gray-400 mt-1">фактов сохранено</p>
            </div>
          </div>
          <button onClick={() => { setStep("upload"); setFile(null); setSheets([]); setResult(null); }}
            className="btn-outline mx-auto">
            Импортировать ещё файл
          </button>
        </div>
      )}
    </div>
  );
}
