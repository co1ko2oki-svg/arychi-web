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
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="panel bg-[#101116] border border-white/[0.12] rounded-xl max-w-sm w-full overflow-hidden shadow-elevated">
        <div className="p-4 sm:p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  isDanger ? 'bg-rose-500/15 text-rose-400' : 'bg-amber-500/15 text-amber-400'
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm text-slate-100">{title}</h3>
            </div>
            <button
              onClick={onCancel}
              className="text-slate-400 hover:text-slate-100 p-1 rounded-lg hover:bg-surface-2 transition-colors"
              aria-label="Đóng hộp thoại"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed pl-10">{message}</p>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.06]">
            <button onClick={onCancel} className="btn-secondary py-1.5 px-3 text-xs">
              {resolvedCancel}
            </button>
            <button
              onClick={onConfirm}
              className={isDanger ? 'btn-danger py-1.5 px-3 text-xs' : 'btn-primary py-1.5 px-3 text-xs'}
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
