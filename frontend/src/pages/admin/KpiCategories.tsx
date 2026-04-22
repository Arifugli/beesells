import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type KpiCategory } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Plus, Edit2, Trash2, Loader2, Tag, ToggleLeft, ToggleRight, KeyRound } from "lucide-react";

function PasswordModal({ onClose }: { onClose: () => void }) {
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const mutation = useMutation({ mutationFn: (p: string) => api.admin.changePassword(p) });
  const handleSave = () => {
    if (pwd.length < 6) { toast("Минимум 6 символов", "error"); return; }
    if (pwd !== confirm) { toast("Пароли не совпадают", "error"); return; }
    mutation.mutate(pwd, {
      onSuccess: () => { toast("Пароль изменён", "success"); onClose(); },
      onError: (e: Error) => toast(e.message, "error"),
    });
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Изменить пароль администратора"
      footer={<>
        <button onClick={onClose} className="btn-outline flex-1">Отмена</button>
        <button onClick={handleSave} disabled={mutation.isPending} className="btn-primary flex-1">
          {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Сохранить
        </button>
      </>}
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Новый пароль</label>
          <input type="password" value={pwd} onChange={e => setPwd(e.target.value)} placeholder="Минимум 6 символов" className="input" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Повторите пароль</label>
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Повторите пароль" className="input" />
        </div>
      </div>
    </Modal>
  );
}

export default function AdminKpi() {
  const qc = useQueryClient();
  const { data: categories = [], isLoading } = useQuery({ queryKey: ["admin-kpi"], queryFn: api.admin.kpiCategories });

  const createMutation = useMutation({ mutationFn: (d: { name: string; unit: string }) => api.admin.createCategory(d) });
  const updateMutation = useMutation({ mutationFn: ({ id, ...d }: { id: number } & Partial<KpiCategory>) => api.admin.updateCategory(id, d) });
  const deleteMutation = useMutation({ mutationFn: (id: number) => api.admin.deleteCategory(id) });

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formUnit, setFormUnit] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-kpi"] });

  const openAdd = () => { setEditingId(null); setFormName(""); setFormUnit(""); setFormOpen(true); };
  const openEdit = (c: KpiCategory) => { setEditingId(c.id); setFormName(c.name); setFormUnit(c.unit); setFormOpen(true); };

  const handleSave = () => {
    if (!formName.trim() || !formUnit.trim()) { toast("Заполните все поля", "error"); return; }
    if (editingId) {
      updateMutation.mutate({ id: editingId, name: formName.trim(), unit: formUnit.trim() }, {
        onSuccess: () => { refresh(); setFormOpen(false); toast("Категория обновлена", "success"); },
        onError: (e: Error) => toast(e.message, "error"),
      });
    } else {
      createMutation.mutate({ name: formName.trim(), unit: formUnit.trim() }, {
        onSuccess: () => { refresh(); setFormOpen(false); toast("Категория создана", "success"); },
        onError: (e: Error) => toast(e.message, "error"),
      });
    }
  };

  const toggleActive = (c: KpiCategory) => {
    updateMutation.mutate({ id: c.id, isActive: !c.isActive }, {
      onSuccess: () => { refresh(); toast(c.isActive ? "Категория деактивирована" : "Категория активирована", "success"); },
      onError: (e: Error) => toast(e.message, "error"),
    });
  };

  const handleDelete = () => {
    if (!deletingId) return;
    deleteMutation.mutate(deletingId, {
      onSuccess: () => { refresh(); setDeletingId(null); toast("Категория удалена", "success"); },
      onError: (e: Error) => toast(e.message, "error"),
    });
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6 animate-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">KPI Категории</h1>
          <p className="text-gray-500 text-sm mt-1">Создавайте показатели, по которым операторы будут выставлять планы.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setPwdOpen(true)} className="btn-outline gap-2">
            <KeyRound className="w-4 h-4" />Пароль
          </button>
          <button onClick={openAdd} className="btn-primary">
            <Plus className="w-4 h-4" />Новая категория
          </button>
        </div>
      </div>

      <div className="card shadow-sm overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Название</th>
              <th>Единица измерения</th>
              <th>Статус</th>
              <th className="w-28"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array(4).fill(0).map((_, i) => (
                <tr key={i}>
                  {[1,2,3,4].map(j => <td key={j}><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}
                </tr>
              ))
            ) : categories.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-16 text-center text-gray-400">
                  <Tag className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>Нет категорий. Создайте первую!</p>
                  <p className="text-xs mt-1">Примеры: SIM-карты (шт), Выручка (сум), Звонки (мин)</p>
                </td>
              </tr>
            ) : categories.map(c => (
              <tr key={c.id} className={!c.isActive ? "opacity-50" : ""}>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: c.isActive ? "hsl(var(--primary))" : "#d1d5db" }} />
                    <span className="font-medium">{c.name}</span>
                  </div>
                </td>
                <td>
                  <span className="badge badge-muted font-mono">{c.unit}</span>
                </td>
                <td>
                  <span className={`badge ${c.isActive ? "badge-success" : "badge-muted"}`}>
                    {c.isActive ? "Активна" : "Неактивна"}
                  </span>
                </td>
                <td>
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => toggleActive(c)} className="btn-ghost" title={c.isActive ? "Деактивировать" : "Активировать"}>
                      {c.isActive ? <ToggleRight className="w-4 h-4 text-emerald-500" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>
                    <button onClick={() => openEdit(c)} className="btn-ghost"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => setDeletingId(c.id)} className="btn-ghost hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-medium mb-1">💡 Подсказка</p>
        <p>Создайте нужные KPI-показатели. Менеджеры смогут выставлять планы только по активным категориям. Примеры единиц: <strong>шт</strong>, <strong>сум</strong>, <strong>мин</strong>, <strong>%</strong>.</p>
      </div>

      {/* Add/Edit */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? "Редактировать категорию" : "Новая KPI категория"}
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
            <label className="text-sm font-medium">Название</label>
            <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="SIM-карты" className="input" autoFocus />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Единица измерения</label>
            <input value={formUnit} onChange={e => setFormUnit(e.target.value)} placeholder="шт" className="input" />
            <p className="text-xs text-gray-400">Примеры: шт, сум, мин, звонок, %</p>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deletingId}
        title="Удалить категорию?"
        description="Все планы и записи по этой категории будут удалены. Действие необратимо."
        onConfirm={handleDelete}
        onCancel={() => setDeletingId(null)}
        loading={deleteMutation.isPending}
      />

      {pwdOpen && <PasswordModal onClose={() => setPwdOpen(false)} />}
    </div>
  );
}
