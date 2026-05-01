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
      <div className={`modal ${maxWidth} w-full flex flex-col`}
        style={{ maxHeight: "min(90vh, 700px)" }}
        onClick={e => e.stopPropagation()}>
        {/* Header with yellow accent */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#F0F0F0] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-1 h-5 rounded-full" style={{ background: "#FFD200" }} />
            <h2 className="text-base font-bold text-[#1A1A1A]">{title}</h2>
          </div>
          <button onClick={onClose} className="btn-ghost"><X className="w-4 h-4" /></button>
        </div>
        {/* Body */}
        <div className="overflow-y-auto flex-1 min-h-0 px-6 py-5">
          {children}
        </div>
        {/* Footer */}
        {footer && (
          <div className="flex gap-3 px-6 pb-5 pt-4 border-t border-[#F0F0F0] shrink-0 bg-white rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function ModalFooter({ children }: { children: ReactNode }) {
  return <div className="flex gap-3 pt-4 mt-4 border-t border-[#F0F0F0]">{children}</div>;
}
