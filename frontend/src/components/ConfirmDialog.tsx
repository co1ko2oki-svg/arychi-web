import React from 'react';
import { Dialog } from './ui';

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
  const resolvedConfirm = confirmText || confirmLabel || 'Xác nhận';
  const resolvedCancel = cancelText || cancelLabel || 'Hủy';
  const isDanger = isDestructive || variant === 'danger';

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <button type="button" onClick={onCancel} className="btn-ghost">
            {resolvedCancel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={isDanger ? 'btn bg-rose-600 text-white hover:bg-rose-500' : 'btn-primary'}
            autoFocus
          >
            {resolvedConfirm}
          </button>
        </>
      }
    >
      <p className="text-[13px] text-slate-300 leading-relaxed break-words">{message}</p>
    </Dialog>
  );
};

export default ConfirmDialog;
