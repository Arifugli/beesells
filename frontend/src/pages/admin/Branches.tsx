import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type User, type BranchDetail } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Plus, Edit2, Trash2, Loader2, Building2, Users, Check } from "lucide-react";

export default function AdminBranches() {
  const qc = useQueryClient();
  const { data: branches = [], isLoading } = useQuery({
    queryKey: ["admin-branches"],
    queryFn: api.admin.branches,
  });
  const { data: allManagers = [] } = useQuery({
    queryKey: ["admin-managers"],
    queryFn: api.admin.managers,
  });

  // ─── Mutations ────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (d: { name: string; address?: string }) => api.admin.createBranch(d),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, ...d }: { id: number; name: string; address?: string }) =>
      api.admin.updateBranch(id, d),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.admin.deleteBranch(id),
  });
  const assignMutation = useMutation({
    mutationFn: ({ bId, mId }: { bId: number; mId: number }) => api.admin.assignManager(bId, mId),
  });
  const removeMutation = useMutation({
    mutationFn: ({ bId, mId }: { bId: number; mId: number }) => api.admin.removeManager(bId, mId),
  });

  // ─── State ────────────────────────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BranchDetail | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [formName, setFormName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [selectedManagerIds, setSelectedManagerIds] = useState<Set<number>>(new Set());

  // Reset form when opening
  useEffect(() => {
    if (!formOpen) return;
    if (editingBranch) {
      setFormName(editingBranch.name);
      setFormAddress(editingBranch.address ?? "");
      setSelectedManagerIds(new Set(editingBranch.managers.map(m => m.id)));
    } else {
      setFormName("");
      setFormAddress("");
      setSelectedManagerIds(new Set());
    }
  }, [formOpen, editingBranch]);

  const refreshAll = async () => {
    await qc.invalidateQueries({ queryKey: ["admin-branches"] });
    await qc.refetchQueries({ queryKey: ["admin-branches"] });
  };

  const openAdd = () => { setEditingBranch(null); setFormOpen(true); };
  const openEdit = (b: BranchDetail) => { setEditingBranch(b); setFormOpen(true); };

  const toggleManager = (id: number) => {
    setSelectedManagerIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ─── Sync selected managers with branch (used in both create and edit) ────
  const syncManagers = async (branchId: number, currentAssigned: number[]) => {
    const wanted = Array.from(selectedManagerIds);
    const toAdd = wanted.filter(id => !currentAssigned.includes(id));
    const toRemove = currentAssigned.filter(id => !wanted.includes(id));

    await Promise.all([
      ...toAdd.map(mId => assignMutation.mutateAsync({ bId: branchId, mId })),
      ...toRemove.map(mId => removeMutation.mutateAsync({ bId: branchId, mId })),
    ]);
  };

  const handleSave = async () => {
    if (!formName.trim()) { toast("Введите название", "error"); return; }
    const data = { name: formName.trim(), address: formAddress.trim() || undefined };

    try {
      if (editingBranch) {
        await updateMutation.mutateAsync({ id: editingBranch.id, ...data });
        await syncManagers(editingBranch.id, editingBranch.managers.map(m => m.id));
        toast("Отделение обновлено", "success");
      } else {
        const created = await createMutation.mutateAsync(data);
        // No managers assigned yet on a new branch
        await syncManagers(created.id, []);
        toast("Отделение создано", "success");
      }
      await refreshAll();
      setFormOpen(false);
    } catch (e: unknown) {
      const err = e as Error;
      toast(err.message || "Ошибка", "error");
    }
  };

  const handleDelete = () => {
    if (!deletingId) return;
    deleteMutation.mutate(deletingId, {
      onSuccess: async () => {
        await refreshAll();
        setDeletingId(null);
        toast("Отделение удалено", "success");
      },
      onError: (e: Error) => toast(e.message, "error"),
    });
  };

  const isPending = createMutation.isPending || updateMutation.isPending
    || assignMutation.isPending || removeMutation.isPending;

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
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-lg truncate">{b.name}</h3>
                  {b.address && <p className="text-sm text-gray-400 mt-0.5 truncate">{b.address}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(b)} className="btn-ghost" title="Редактировать">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDeletingId(b.id)} className="btn-ghost hover:text-red-500" title="Удалить">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-500 mt-3 pt-3 border-t border-gray-100">
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  {b.operatorCount} операторов
                </span>
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  {b.managers.length} менеджеров
                </span>
              </div>

              {b.managers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {b.managers.map(m => (
                    <span key={m.id} className="badge badge-primary text-xs">{m.name}</span>
                  ))}
                </div>
              )}

              {b.managers.length === 0 && (
                <p className="text-xs text-amber-600 mt-3 italic">⚠ Менеджер не назначен</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─── Add / Edit Modal (with manager multi-select) ─── */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingBranch ? "Редактировать отделение" : "Новое отделение"}
        maxWidth="max-w-lg"
        footer={<>
          <button onClick={() => setFormOpen(false)} className="btn-outline flex-1" disabled={isPending}>
            Отмена
          </button>
          <button onClick={handleSave} disabled={isPending} className="btn-primary flex-1">
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {editingBranch ? "Сохранить" : "Создать отделение"}
          </button>
        </>}
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Название <span className="text-red-500">*</span></label>
            <input
              value={formName}
              onChange={e => setFormName(e.target.value)}
              placeholder="Филиал Юнусабад"
              className="input"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Адрес <span className="text-gray-400 font-normal">(необязательно)</span>
            </label>
            <input
              value={formAddress}
              onChange={e => setFormAddress(e.target.value)}
              placeholder="ул. Амира Темура 15"
              className="input"
            />
          </div>

          <div className="space-y-2 pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Менеджеры отделения</label>
              <span className="text-xs text-gray-400">
                Выбрано: {selectedManagerIds.size}
              </span>
            </div>

            {allManagers.length === 0 ? (
              <p className="text-sm text-gray-400 bg-gray-50 rounded-lg p-3 text-center">
                Нет менеджеров. Создайте их в разделе «Менеджеры».
              </p>
            ) : (
              <div className="space-y-1 max-h-56 overflow-y-auto border border-gray-100 rounded-lg p-1">
                {allManagers.map((m: User) => {
                  const isSelected = selectedManagerIds.has(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleManager(m.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left text-sm transition-all ${
                        isSelected
                          ? "bg-indigo-50 text-indigo-900"
                          : "hover:bg-gray-50 text-gray-700"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                        isSelected
                          ? "border-indigo-500 bg-indigo-500"
                          : "border-gray-300"
                      }`}>
                        {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <span className="flex-1 truncate font-medium">{m.name}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <p className="text-xs text-gray-400">
              Одно и то же отделение может управляться несколькими менеджерами. Один менеджер может управлять несколькими отделениями.
            </p>
          </div>
        </div>


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
