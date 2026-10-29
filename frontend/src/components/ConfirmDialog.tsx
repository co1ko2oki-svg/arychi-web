import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmText?: string;
  cancelLabel?: string;
  cancelText?: string;
  isDestructive?: boolean;
  variant?: 'warning' | 'danger' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  confirmText,
  cancelLabel,
  cancelText,
  isDestructive = false,
  variant,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const resolvedConfirm = confirmText || confirmLabel || 'Xác Nhận';
  const resolvedCancel = cancelText || cancelLabel || 'Hủy Bỏ';
  const isDanger = isDestructive || variant === 'danger';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-panel-elevated rounded-2xl max-w-sm w-full overflow-hidden">
        <div className="p-5 space-y-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  isDanger ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm text-white">{title}</h3>
            </div>
            <button
              onClick={onCancel}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/[0.06] transition-colors"
              aria-label="Đóng hộp thoại"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed pl-12">{message}</p>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-white/[0.08]">
            <button onClick={onCancel} className="btn-secondary py-2 px-3.5 text-xs">
              {resolvedCancel}
            </button>
            <button
              onClick={onConfirm}
              className={isDanger ? 'btn-danger py-2 px-3.5 text-xs' : 'btn-primary py-2 px-3.5 text-xs'}
            >
              {resolvedConfirm}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
