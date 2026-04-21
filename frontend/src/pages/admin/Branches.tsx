import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type User } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Plus, Edit2, Trash2, Loader2, Building2, UserMinus, UserPlus, Users } from "lucide-react";

export default function AdminBranches() {
  const qc = useQueryClient();
  const { data: branches = [], isLoading } = useQuery({ queryKey: ["admin-branches"], queryFn: api.admin.branches });
  const { data: allManagers = [] } = useQuery({ queryKey: ["admin-managers"], queryFn: api.admin.managers });

  const createMutation = useMutation({ mutationFn: (d: { name: string; address?: string }) => api.admin.createBranch(d) });
  const updateMutation = useMutation({ mutationFn: ({ id, ...d }: { id: number; name: string; address?: string }) => api.admin.updateBranch(id, d) });
  const deleteMutation = useMutation({ mutationFn: (id: number) => api.admin.deleteBranch(id) });
  const assignMutation = useMutation({ mutationFn: ({ bId, mId }: { bId: number; mId: number }) => api.admin.assignManager(bId, mId) });
  const removeMutation = useMutation({ mutationFn: ({ bId, mId }: { bId: number; mId: number }) => api.admin.removeManager(bId, mId) });

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [managersOpen, setManagersOpen] = useState<number | null>(null);
  const [formName, setFormName] = useState("");
  const [formAddress, setFormAddress] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-branches"] });

  const openAdd = () => { setEditingId(null); setFormName(""); setFormAddress(""); setFormOpen(true); };
  const openEdit = (b: { id: number; name: string; address?: string | null }) => {
    setEditingId(b.id); setFormName(b.name); setFormAddress(b.address ?? ""); setFormOpen(true);
  };

  const handleSave = () => {
    if (!formName.trim()) { toast("Введите название", "error"); return; }
    const data = { name: formName.trim(), address: formAddress.trim() || undefined };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...data }, {
        onSuccess: () => { refresh(); setFormOpen(false); toast("Отделение обновлено", "success"); },
        onError: (e: Error) => toast(e.message, "error"),
      });
    } else {
      createMutation.mutate(data, {
        onSuccess: () => { refresh(); setFormOpen(false); toast("Отделение создано", "success"); },
        onError: (e: Error) => toast(e.message, "error"),
      });
    }
  };

  const handleDelete = () => {
    if (!deletingId) return;
    deleteMutation.mutate(deletingId, {
      onSuccess: () => { refresh(); setDeletingId(null); toast("Отделение удалено", "success"); },
      onError: (e: Error) => toast(e.message, "error"),
    });
  };

  const currentBranch = branches.find(b => b.id === managersOpen);
  const assignedIds = currentBranch?.managers.map(m => m.id) ?? [];
  const unassigned = allManagers.filter((m: User) => !assignedIds.includes(m.id));

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6 animate-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Отделения</h1>
          <p className="text-gray-500 text-sm mt-1">Создавайте отделения и назначайте менеджеров.</p>
        </div>
        <button onClick={openAdd} className="btn-primary">
          <Plus className="w-4 h-4" />Новое отделение
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : branches.length === 0 ? (
        <div className="card p-16 text-center text-gray-400">
          <Building2 className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="font-medium">Нет отделений</p>
          <p className="text-sm mt-1">Создайте первое отделение, чтобы начать работу.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {branches.map(b => (
            <div key={b.id} className="card p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-lg">{b.name}</h3>
                  {b.address && <p className="text-sm text-gray-400 mt-0.5">{b.address}</p>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(b)} className="btn-ghost"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => setDeletingId(b.id)} className="btn-ghost hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-500 mt-3 pt-3 border-t border-gray-100">
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  {b.operatorCount} операторов
                </span>
                <button onClick={() => setManagersOpen(b.id)}
                  className="flex items-center gap-1.5 text-indigo-500 hover:text-indigo-700 font-medium transition-colors">
                  <UserPlus className="w-3.5 h-3.5" />
                  Менеджеры ({b.managers.length})
                </button>
              </div>

              {b.managers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {b.managers.map(m => (
                    <span key={m.id} className="badge badge-primary text-xs">{m.name}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editingId ? "Редактировать отделение" : "Новое отделение"}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Название</label>
            <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Филиал Юнусабад" className="input" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Адрес <span className="text-gray-400 font-normal">(необязательно)</span></label>
            <input value={formAddress} onChange={e => setFormAddress(e.target.value)} placeholder="ул. Амира Темура 15" className="input" />
          </div>
        </div>
        <ModalFooter>
          <button onClick={() => setFormOpen(false)} className="btn-outline flex-1">Отмена</button>
          <button onClick={handleSave} disabled={isPending} className="btn-primary flex-1">
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {editingId ? "Сохранить" : "Создать"}
          </button>
        </ModalFooter>
      </Modal>

      {/* Managers assignment Modal */}
      <Modal open={!!managersOpen} onClose={() => setManagersOpen(null)}
        title={`Менеджеры — ${currentBranch?.name ?? ""}`} maxWidth="max-w-lg">
        <div className="space-y-4">
          {/* Assigned */}
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Назначены</p>
            {assignedIds.length === 0 ? (
              <p className="text-sm text-gray-400">Нет назначенных менеджеров</p>
            ) : (
              <div className="space-y-2">
                {currentBranch?.managers.map(m => (
                  <div key={m.id} className="flex items-center justify-between bg-indigo-50 rounded-lg px-3 py-2">
                    <span className="text-sm font-medium">{m.name}</span>
                    <button
                      onClick={() => {
                        if (!managersOpen) return;
                        removeMutation.mutate({ bId: managersOpen, mId: m.id }, {
                          onSuccess: () => { refresh(); toast("Менеджер откреплён", "success"); },
                          onError: (e: Error) => toast(e.message, "error"),
                        });
                      }}
                      className="btn-ghost hover:text-red-500 text-red-400"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Unassigned */}
          {unassigned.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Доступные менеджеры</p>
              <div className="space-y-2">
                {unassigned.map((m: User) => (
                  <div key={m.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-sm">{m.name}</span>
                    <button
                      onClick={() => {
                        if (!managersOpen) return;
                        assignMutation.mutate({ bId: managersOpen, mId: m.id }, {
                          onSuccess: () => { refresh(); toast("Менеджер назначен", "success"); },
                          onError: (e: Error) => toast(e.message, "error"),
                        });
                      }}
                      className="btn-ghost text-indigo-500 hover:text-indigo-700"
                    >
                      <UserPlus className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {allManagers.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">Сначала создайте менеджеров.</p>
          )}
        </div>
        <ModalFooter>
          <button onClick={() => setManagersOpen(null)} className="btn-primary flex-1">Готово</button>
        </ModalFooter>
      </Modal>

      <ConfirmDialog
        open={!!deletingId}
        title="Удалить отделение?"
        description="Все операторы этого отделения будут откреплены. Действие необратимо."
        onConfirm={handleDelete}
        onCancel={() => setDeletingId(null)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
