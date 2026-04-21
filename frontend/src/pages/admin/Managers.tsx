import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Plus, Edit2, Trash2, Loader2, Users } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

export default function AdminManagers() {
  const qc = useQueryClient();
  const { data: managers = [], isLoading } = useQuery({ queryKey: ["admin-managers"], queryFn: api.admin.managers });

  const createMutation = useMutation({ mutationFn: (name: string) => api.admin.createManager(name) });
  const updateMutation = useMutation({ mutationFn: ({ id, name }: { id: number; name: string }) => api.admin.updateManager(id, name) });
  const deleteMutation = useMutation({ mutationFn: (id: number) => api.admin.deleteManager(id) });

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [formName, setFormName] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-managers"] });

  const openAdd = () => { setEditingId(null); setFormName(""); setFormOpen(true); };
  const openEdit = (m: { id: number; name: string }) => { setEditingId(m.id); setFormName(m.name); setFormOpen(true); };

  const handleSave = () => {
    if (!formName.trim()) { toast("Введите имя", "error"); return; }
    if (editingId) {
      updateMutation.mutate({ id: editingId, name: formName.trim() }, {
        onSuccess: () => { refresh(); setFormOpen(false); toast("Менеджер обновлён", "success"); },
        onError: (e: Error) => toast(e.message, "error"),
      });
    } else {
      createMutation.mutate(formName.trim(), {
        onSuccess: () => { refresh(); setFormOpen(false); toast("Менеджер создан", "success"); },
        onError: (e: Error) => toast(e.message, "error"),
      });
    }
  };

  const handleDelete = () => {
    if (!deletingId) return;
    deleteMutation.mutate(deletingId, {
      onSuccess: () => { refresh(); setDeletingId(null); toast("Менеджер удалён", "success"); },
      onError: (e: Error) => toast(e.message, "error"),
    });
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6 animate-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Менеджеры</h1>
          <p className="text-gray-500 text-sm mt-1">Создавайте профили менеджеров и назначайте их на отделения.</p>
        </div>
        <button onClick={openAdd} className="btn-primary">
          <Plus className="w-4 h-4" />Добавить менеджера
        </button>
      </div>

      <div className="card shadow-sm overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Имя</th>
              <th>Дата создания</th>
              <th className="w-24"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array(4).fill(0).map((_, i) => (
                <tr key={i}>
                  <td><div className="h-4 bg-gray-100 rounded animate-pulse w-40" /></td>
                  <td><div className="h-4 bg-gray-100 rounded animate-pulse w-24" /></td>
                  <td></td>
                </tr>
              ))
            ) : managers.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-16 text-center text-gray-400">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>Нет менеджеров. Добавьте первого!</p>
                </td>
              </tr>
            ) : managers.map(m => (
              <tr key={m.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
                      style={{ background: "hsl(var(--primary))" }}>
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium">{m.name}</span>
                  </div>
                </td>
                <td className="text-gray-400 text-sm">
                  {m.createdAt ? format(new Date(m.createdAt), "d MMM yyyy", { locale: ru }) : "—"}
                </td>
                <td>
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => openEdit(m)} className="btn-ghost"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => setDeletingId(m.id)} className="btn-ghost hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editingId ? "Редактировать менеджера" : "Новый менеджер"}>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Имя</label>
          <input type="text" value={formName} onChange={e => setFormName(e.target.value)}
            placeholder="Умид Хасанов" className="input"
            onKeyDown={e => e.key === "Enter" && handleSave()} autoFocus />
        </div>
        <ModalFooter>
          <button onClick={() => setFormOpen(false)} className="btn-outline flex-1">Отмена</button>
          <button onClick={handleSave} disabled={isPending} className="btn-primary flex-1">
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {editingId ? "Сохранить" : "Создать"}
          </button>
        </ModalFooter>
      </Modal>

      <ConfirmDialog
        open={!!deletingId}
        title="Удалить менеджера?"
        description="Менеджер будет откреплён от всех отделений и удалён из системы."
        onConfirm={handleDelete}
        onCancel={() => setDeletingId(null)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
