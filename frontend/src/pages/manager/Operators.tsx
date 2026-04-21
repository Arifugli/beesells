import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type User, type KpiCategory, type KpiTarget, type OperatorWithBranch } from "@/lib/api";
import { currentMonth } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { MonthPicker } from "@/components/ui/MonthPicker";
import { Plus, Edit2, Trash2, Target, Loader2, ChevronDown, ChevronUp, Building2 } from "lucide-react";

function TargetsModal({
  operator, categories, initialMonth, onClose,
}: {
  operator: User; categories: KpiCategory[]; initialMonth: string; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [month, setMonth] = useState(initialMonth);
  const { data: targets = [], isLoading } = useQuery({
    queryKey: ["targets", operator.id, month],
    queryFn: () => api.manager.targets(operator.id, month),
  });

  const [values, setValues] = useState<Record<number, string>>({});

  const mutation = useMutation({
    mutationFn: (entries: { categoryId: number; target: number }[]) =>
      Promise.all(entries.map(e => api.manager.setTarget({ operatorId: operator.id, categoryId: e.categoryId, month, target: e.target }))),
    onSuccess: () => {
      toast("Планы сохранены", "success");
      qc.invalidateQueries({ queryKey: ["manager-dashboard"] });
      qc.invalidateQueries({ queryKey: ["targets", operator.id] });
      qc.invalidateQueries({ queryKey: ["archive-months"] });
      setValues({});
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const getTarget = (catId: number) => targets.find((t: KpiTarget) => t.categoryId === catId)?.target ?? 0;

  const handleSave = () => {
    const entries = Object.entries(values)
      .filter(([, v]) => v !== "")
      .map(([catId, v]) => ({ categoryId: Number(catId), target: Math.max(0, parseInt(v) || 0) }));
    if (entries.length === 0) { toast("Не изменено ни одно значение", "error"); return; }
    mutation.mutate(entries);
  };

  return (
    <Modal open onClose={onClose} title={`Планы KPI — ${operator.name}`} maxWidth="max-w-lg">
      <div className="mb-5">
        <MonthPicker value={month} onChange={(m) => { setMonth(m); setValues({}); }} />
      </div>
      {isLoading ? (
        <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : categories.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-6">Нет активных KPI категорий. Создайте их в разделе администратора.</p>
      ) : (
        <div className="space-y-4">
          {categories.map(cat => (
            <div key={cat.id} className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-sm font-medium">{cat.name}</p>
                <p className="text-xs text-gray-400">Текущий план: {getTarget(cat.id)} {cat.unit}</p>
              </div>
              <div className="w-36">
                <input
                  type="number"
                  min="0"
                  placeholder={String(getTarget(cat.id))}
                  value={values[cat.id] ?? ""}
                  onChange={e => setValues(p => ({ ...p, [cat.id]: e.target.value }))}
                  className="input text-right"
                />
              </div>
              <span className="text-xs text-gray-400 w-8">{cat.unit}</span>
            </div>
          ))}
        </div>
      )}
      <ModalFooter>
        <button onClick={onClose} className="btn-outline flex-1">Закрыть</button>
        <button onClick={handleSave} disabled={mutation.isPending || categories.length === 0} className="btn-primary flex-1">
          {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Сохранить планы
        </button>
      </ModalFooter>
    </Modal>
  );
}

export default function ManagerOperators() {
  const qc = useQueryClient();
  const month = currentMonth();

  const { data: branches = [] } = useQuery({ queryKey: ["manager-branches"], queryFn: api.manager.branches });
  const { data: operators = [], isLoading } = useQuery({ queryKey: ["manager-operators"], queryFn: () => api.manager.operators() });
  const { data: categories = [] } = useQuery({ queryKey: ["manager-kpi-categories"], queryFn: api.manager.kpiCategories });

  const createMutation = useMutation({ mutationFn: ({ name, branchId }: { name: string; branchId: number }) => api.manager.createOperator(name, branchId) });
  const updateMutation = useMutation({ mutationFn: ({ id, name }: { id: number; name: string }) => api.manager.updateOperator(id, name) });
  const deleteMutation = useMutation({ mutationFn: (id: number) => api.manager.deleteOperator(id) });

  const [formOpen, setFormOpen] = useState(false);
  const [editingOp, setEditingOp] = useState<OperatorWithBranch | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [targetsOp, setTargetsOp] = useState<User | null>(null);
  const [formName, setFormName] = useState("");
  const [formBranch, setFormBranch] = useState("");
  const [expandedBranch, setExpandedBranch] = useState<number | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["manager-operators"] });
    qc.invalidateQueries({ queryKey: ["manager-dashboard"] });
  };

  const openAdd = () => { setEditingOp(null); setFormName(""); setFormBranch(branches[0]?.id.toString() ?? ""); setFormOpen(true); };
  const openEdit = (op: OperatorWithBranch) => { setEditingOp(op); setFormName(op.name); setFormBranch(op.branchId.toString()); setFormOpen(true); };

  const handleSave = () => {
    if (!formName.trim()) { toast("Введите имя", "error"); return; }
    if (editingOp) {
      updateMutation.mutate({ id: editingOp.id, name: formName.trim() }, {
        onSuccess: () => { refresh(); setFormOpen(false); toast("Оператор обновлён", "success"); },
        onError: (e: Error) => toast(e.message, "error"),
      });
    } else {
      if (!formBranch) { toast("Выберите отделение", "error"); return; }
      createMutation.mutate({ name: formName.trim(), branchId: Number(formBranch) }, {
        onSuccess: () => { refresh(); setFormOpen(false); toast("Оператор добавлен", "success"); },
        onError: (e: Error) => toast(e.message, "error"),
      });
    }
  };

  const handleDelete = () => {
    if (!deletingId) return;
    deleteMutation.mutate(deletingId, {
      onSuccess: () => { refresh(); setDeletingId(null); toast("Оператор удалён", "success"); },
      onError: (e: Error) => toast(e.message, "error"),
    });
  };

  // Group operators by branch
  const opsByBranch = branches.map(b => ({
    branch: b,
    operators: operators.filter(o => o.branchId === b.id),
  }));

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6 animate-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Операторы</h1>
          <p className="text-gray-500 mt-1 text-sm">Управляйте операторами и их планами KPI.</p>
        </div>
        <button onClick={openAdd} className="btn-primary" disabled={branches.length === 0}>
          <Plus className="w-4 h-4" />
          Добавить оператора
        </button>
      </div>

      {branches.length === 0 && (
        <div className="card p-12 text-center text-gray-400">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>У вас пока нет отделений. Обратитесь к администратору.</p>
        </div>
      )}

      {opsByBranch.map(({ branch, operators: ops }) => (
        <div key={branch.id} className="card shadow-sm overflow-hidden">
          <button
            onClick={() => setExpandedBranch(expandedBranch === branch.id ? null : branch.id)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Building2 className="w-4 h-4 text-gray-400" />
              <span className="font-semibold">{branch.name}</span>
              <span className="badge badge-muted">{ops.length} операторов</span>
            </div>
            {expandedBranch === branch.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {(expandedBranch === branch.id || expandedBranch === null) && (
            <>
              {ops.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-400 text-sm border-t border-gray-100">
                  Нет операторов. Добавьте первого!
                </div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Имя</th>
                      <th>Планы KPI</th>
                      <th className="w-28"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      Array(3).fill(0).map((_, i) => (
                        <tr key={i}>
                          <td><div className="h-4 bg-gray-100 rounded animate-pulse w-32" /></td>
                          <td><div className="h-4 bg-gray-100 rounded animate-pulse w-24" /></td>
                          <td></td>
                        </tr>
                      ))
                    ) : ops.map(op => (
                      <tr key={op.id}>
                        <td className="font-medium">{op.name}</td>
                        <td>
                          <button onClick={() => setTargetsOp(op)}
                            className="flex items-center gap-1.5 text-sm text-indigo-500 hover:text-indigo-700 font-medium transition-colors">
                            <Target className="w-3.5 h-3.5" />
                            Выставить планы
                          </button>
                        </td>
                        <td>
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEdit(op)} className="btn-ghost"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => setDeletingId(op.id)} className="btn-ghost hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      ))}

      {/* Add/Edit Modal */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editingOp ? "Редактировать оператора" : "Добавить оператора"}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Имя</label>
            <input type="text" value={formName} onChange={e => setFormName(e.target.value)}
              placeholder="Введите имя" className="input" onKeyDown={e => e.key === "Enter" && handleSave()} />
          </div>
          {!editingOp && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Отделение</label>
              <select value={formBranch} onChange={e => setFormBranch(e.target.value)} className="select">
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}
        </div>
        <ModalFooter>
          <button onClick={() => setFormOpen(false)} className="btn-outline flex-1">Отмена</button>
          <button onClick={handleSave} disabled={isPending} className="btn-primary flex-1">
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {editingOp ? "Сохранить" : "Добавить"}
          </button>
        </ModalFooter>
      </Modal>

      {/* Targets Modal */}
      {targetsOp && (
        <TargetsModal operator={targetsOp} categories={categories} initialMonth={month} onClose={() => setTargetsOp(null)} />
      )}

      <ConfirmDialog
        open={!!deletingId}
        title="Удалить оператора?"
        description="Все данные о продажах этого оператора будут удалены безвозвратно."
        onConfirm={handleDelete}
        onCancel={() => setDeletingId(null)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
