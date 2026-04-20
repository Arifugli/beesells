import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Operator } from "@/lib/api";
import { Plus, Edit2, Trash2, ShieldCheck, ShieldAlert, X, Loader2 } from "lucide-react";

type FormData = {
  name: string;
  role: "operator" | "manager";
  simTarget: string;
  deviceTarget: string;
};

const defaultForm: FormData = { name: "", role: "operator", simTarget: "250", deviceTarget: "50" };

export default function ManagerOperators() {
  const queryClient = useQueryClient();
  const { data: operators, isLoading } = useQuery({
    queryKey: ["operators"],
    queryFn: api.operators.list,
  });

  const createMutation = useMutation({ mutationFn: api.operators.create });
  const updateMutation = useMutation({ mutationFn: ({ id, data }: { id: number; data: Partial<Omit<Operator, "id" | "createdAt">> }) => api.operators.update(id, data) });
  const deleteMutation = useMutation({ mutationFn: api.operators.delete });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<FormData>(defaultForm);
  const [formError, setFormError] = useState("");

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["operators"] });

  const openAdd = () => { setEditingId(null); setFormData(defaultForm); setFormError(""); setIsFormOpen(true); };
  const openEdit = (op: Operator) => {
    setEditingId(op.id);
    setFormData({ name: op.name, role: op.role, simTarget: String(op.simTarget), deviceTarget: String(op.deviceTarget) });
    setFormError("");
    setIsFormOpen(true);
  };
  const openDelete = (id: number) => { setDeletingId(id); setIsDeleteOpen(true); };

  const handleSave = () => {
    if (!formData.name.trim()) { setFormError("Введите имя"); return; }
    const payload = {
      name: formData.name.trim(),
      role: formData.role,
      simTarget: parseInt(formData.simTarget) || 0,
      deviceTarget: parseInt(formData.deviceTarget) || 0,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload }, {
        onSuccess: () => { refresh(); setIsFormOpen(false); },
        onError: (e: Error) => setFormError(e.message),
      });
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => { refresh(); setIsFormOpen(false); },
        onError: (e: Error) => setFormError(e.message),
      });
    }
  };

  const handleDelete = () => {
    if (!deletingId) return;
    deleteMutation.mutate(deletingId, {
      onSuccess: () => { refresh(); setIsDeleteOpen(false); },
    });
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Управление командой</h1>
          <p className="text-muted-foreground mt-1">Добавляйте и редактируйте операторов и их цели.</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 h-10 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Добавить сотрудника
        </button>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/40">
              <th className="text-left px-5 py-3 font-medium text-muted-foreground">Имя</th>
              <th className="text-left px-5 py-3 font-medium text-muted-foreground">Роль</th>
              <th className="text-right px-5 py-3 font-medium text-muted-foreground">SIM цель/мес</th>
              <th className="text-right px-5 py-3 font-medium text-muted-foreground">Устройства цель/мес</th>
              <th className="w-24 px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              Array(5).fill(0).map((_, i) => (
                <tr key={i}>
                  {[1,2,3,4,5].map(j => (
                    <td key={j} className="px-5 py-4">
                      <div className="h-4 bg-secondary rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : operators?.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-muted-foreground">
                  Нет сотрудников. Добавьте первого!
                </td>
              </tr>
            ) : (
              operators?.map((op) => (
                <tr key={op.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-4 font-medium">{op.name}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${
                      op.role === "manager"
                        ? "bg-primary/10 text-primary"
                        : "bg-secondary text-muted-foreground"
                    }`}>
                      {op.role === "manager"
                        ? <><ShieldCheck className="w-3 h-3" />Менеджер</>
                        : <><ShieldAlert className="w-3 h-3" />Оператор</>}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right font-mono text-muted-foreground">{op.simTarget}</td>
                  <td className="px-5 py-4 text-right font-mono text-muted-foreground">{op.deviceTarget}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(op)}
                        className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openDelete(op.id)}
                        className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsFormOpen(false)} />
          <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editingId ? "Редактировать сотрудника" : "Добавить сотрудника"}
              </h2>
              <button onClick={() => setIsFormOpen(false)} className="p-1.5 hover:bg-secondary rounded-md">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Имя</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                  placeholder="Иван Иванов"
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Роль</label>
                <select
                  value={formData.role}
                  onChange={e => setFormData(p => ({ ...p, role: e.target.value as "operator" | "manager" }))}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="operator">Оператор продаж</option>
                  <option value="manager">Менеджер</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Цель SIM / мес</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.simTarget}
                    onChange={e => setFormData(p => ({ ...p, simTarget: e.target.value }))}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Цель устройства / мес</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.deviceTarget}
                    onChange={e => setFormData(p => ({ ...p, deviceTarget: e.target.value }))}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              {formError && (
                <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{formError}</p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setIsFormOpen(false)}
                className="flex-1 h-10 border border-border rounded-md text-sm font-medium hover:bg-secondary transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleSave}
                disabled={isPending}
                className="flex-1 h-10 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingId ? "Сохранить" : "Добавить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {isDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsDeleteOpen(false)} />
          <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold">Вы уверены?</h2>
            <p className="text-sm text-muted-foreground">
              Этот сотрудник и все его данные о продажах будут удалены безвозвратно.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setIsDeleteOpen(false)}
                className="flex-1 h-10 border border-border rounded-md text-sm font-medium hover:bg-secondary transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="flex-1 h-10 bg-destructive text-destructive-foreground rounded-md text-sm font-medium hover:bg-destructive/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
