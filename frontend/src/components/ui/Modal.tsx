import { ReactNode } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
}

export function Modal({ open, onClose, title, children, footer, maxWidth = "max-w-md" }: ModalProps) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal ${maxWidth} w-full flex flex-col`}
        style={{ maxHeight: "min(90vh, 700px)", padding: 0 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="btn-ghost"><X className="w-4 h-4" /></button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 min-h-0 px-6 py-4">
          {children}
        </div>

        {/* Footer - always visible at bottom */}
        {footer && (
          <div className="flex gap-3 px-6 pb-6 pt-4 border-t border-gray-100 shrink-0 bg-white rounded-b-xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function ModalFooter({ children }: { children: ReactNode }) {
  // This is kept for backward compat but content is rendered inline in scroll area
  // Pages should migrate to using the footer prop on Modal
  return <div className="flex gap-3 pt-4 mt-4 border-t border-gray-100">{children}</div>;
}
