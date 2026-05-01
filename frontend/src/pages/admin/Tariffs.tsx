import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Tariff } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Plus, Edit2, Trash2, Loader2, Tag, ToggleLeft, ToggleRight, FileSpreadsheet, Check } from "lucide-react";

function formatPrice(p: number) {
  return p.toLocaleString("ru-RU") + " сум";
}

export default function AdminTariffs() {
  const qc = useQueryClient();
  const { data: tariffs = [], isLoading } = useQuery({ queryKey: ["admin-tariffs"], queryFn: api.admin.tariffs });

  const createMutation = useMutation({ mutationFn: (d: { name: string; price: number }) => api.admin.createTariff(d) });
  const updateMutation = useMutation({ mutationFn: ({ id, ...d }: { id: number } & Partial<Tariff>) => api.admin.updateTariff(id, d) });
  const deleteMutation = useMutation({ mutationFn: (id: number) => api.admin.deleteTariff(id) });

  const importMutation = useMutation({
    mutationFn: (file: File) => api.import.tariffs(file),
    onSuccess: (data) => {
      refresh();
      setImportResult(data.results);
      toast(`Импортировано ${data.results.length} тарифов`, "success");
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [formName, setFormName] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [importResult, setImportResult] = useState<{ name: string; price: number; action: string }[] | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-tariffs"] });

  const openAdd = () => { setEditingId(null); setFormName(""); setFormPrice(""); setFormOpen(true); };
  const openEdit = (t: Tariff) => { setEditingId(t.id); setFormName(t.name); setFormPrice(String(t.price)); setFormOpen(true); };

  const handleSave = () => {
    if (!formName.trim()) { toast("Введите название", "error"); return; }
    const price = parseInt(formPrice) || 0;
    if (price < 0) { toast("Цена не может быть отрицательной", "error"); return; }
    if (editingId) {
      updateMutation.mutate({ id: editingId, name: formName.trim(), price }, {
        onSuccess: () => { refresh(); setFormOpen(false); toast("Тариф обновлён", "success"); },
        onError: (e: Error) => toast(e.message, "error"),
      });
    } else {
      createMutation.mutate({ name: formName.trim(), price }, {
        onSuccess: () => { refresh(); setFormOpen(false); toast("Тариф создан", "success"); },
        onError: (e: Error) => toast(e.message, "error"),
      });
    }
  };

  const toggleActive = (t: Tariff) => {
    updateMutation.mutate({ id: t.id, isActive: !t.isActive }, {
      onSuccess: () => { refresh(); toast(t.isActive ? "Тариф деактивирован" : "Тариф активирован", "success"); },
      onError: (e: Error) => toast(e.message, "error"),
    });
  };

  const handleDelete = () => {
    if (!deletingId) return;
    deleteMutation.mutate(deletingId, {
      onSuccess: () => { refresh(); setDeletingId(null); toast("Тариф удалён", "success"); },
      onError: (e: Error) => toast(e.message, "error"),
    });
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6 animate-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Тарифы</h1>
          <p className="text-gray-500 text-sm mt-1">Создавайте тарифы с ценой — операторы будут фиксировать подключения по ним.</p>
        </div>
        <div className="flex gap-2">
          <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) { importMutation.mutate(f); if (importRef.current) importRef.current.value = ""; } }} />
          <button onClick={() => importRef.current?.click()} disabled={importMutation.isPending}
            className="btn-outline flex items-center gap-2">
            {importMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            Из Excel
          </button>
          <button onClick={openAdd} className="btn-primary">
            <Plus className="w-4 h-4" />Новый тариф
          </button>
        </div>
      </div>

      <div className="card shadow-sm overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Название тарифа</th>
              <th className="text-right">Цена</th>
              <th>Статус</th>
              <th className="w-28"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array(3).fill(0).map((_, i) => (
                <tr key={i}>
                  {[1,2,3,4].map(j => <td key={j}><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}
                </tr>
              ))
            ) : tariffs.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-16 text-center text-gray-400">
                  <Tag className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>Нет тарифов. Создайте первый!</p>
                  <p className="text-xs mt-1">Примеры: «Старт 29 000», «Оптимум 49 000», «Максимум 89 000»</p>
                </td>
              </tr>
            ) : tariffs.map(t => (
              <tr key={t.id} className={!t.isActive ? "opacity-50" : ""}>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: t.isActive ? "hsl(var(--primary))" : "#d1d5db" }} />
                    <span className="font-medium">{t.name}</span>
                  </div>
                </td>
                <td className="text-right font-mono font-semibold">{formatPrice(t.price)}</td>
                <td>
                  <span className={`badge ${t.isActive ? "badge-success" : "badge-muted"}`}>
                    {t.isActive ? "Активен" : "Неактивен"}
                  </span>
                </td>
                <td>
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => toggleActive(t)} className="btn-ghost" title={t.isActive ? "Деактивировать" : "Активировать"}>
                      {t.isActive ? <ToggleRight className="w-4 h-4 text-emerald-500" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>
                    <button onClick={() => openEdit(t)} className="btn-ghost"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => setDeletingId(t.id)} className="btn-ghost hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {importResult && (
        <div className="card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Результат импорта</h3>
            <button onClick={() => setImportResult(null)} className="btn-ghost text-xs">Закрыть</button>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {importResult.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2">
                  <Check className={`w-3.5 h-3.5 ${r.action === "created" ? "text-emerald-500" : "text-blue-500"}`} />
                  <span>{r.name}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>{r.price.toLocaleString("ru-RU")} сум</span>
                  <span className={`badge ${r.action === "created" ? "badge-success" : "badge-primary"}`}>
                    {r.action === "created" ? "Создан" : "Обновлён"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-medium mb-1">💡 Как работают тарифы</p>
        <p>Администратор создаёт тарифы с ценой. Менеджер может опционально ставить план оператору по каждому тарифу. Оператор ежедневно вносит количество подключений — система автоматически считает выручку (количество × цена).</p>
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? "Редактировать тариф" : "Новый тариф"}
        footer={<>
          <button onClick={() => setFormOpen(false)} className="btn-outline flex-1">Отмена</button>
          <button onClick={handleSave} disabled={isPending} className="btn-primary flex-1">
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {editingId ? "Сохранить" : "Создать"}
          </button>
        </>}
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Название тарифа</label>
            <input value={formName} onChange={e => setFormName(e.target.value)}
              placeholder="Старт 29 000" className="input" autoFocus />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Цена (в сумах)</label>
            <input type="number" min="0" value={formPrice} onChange={e => setFormPrice(e.target.value)}
              placeholder="29000" className="input" />
            {formPrice && parseInt(formPrice) > 0 && (
              <p className="text-xs text-gray-400">{formatPrice(parseInt(formPrice))}</p>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deletingId}
        title="Удалить тариф?"
        description="Все записи продаж по этому тарифу будут удалены. Действие необратимо."
        onConfirm={handleDelete}
        onCancel={() => setDeletingId(null)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
