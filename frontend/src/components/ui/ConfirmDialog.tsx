import { Loader2 } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  danger?: boolean;
}

export function ConfirmDialog({ open, title, description, onConfirm, onCancel, loading, danger = true }: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal max-w-sm" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-2">{title}</h2>
        <p className="text-sm text-gray-500 mb-6">{description}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="btn-outline flex-1">Отмена</button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 flex items-center justify-center gap-2 ${danger ? "btn-danger" : "btn-primary"}`}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Удалить
          </button>
        </div>
      </div>
    </div>
  );
}
