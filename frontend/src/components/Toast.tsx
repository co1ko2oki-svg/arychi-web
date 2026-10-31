import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (type: ToastType, message: string, title?: string, duration?: number) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, message: string, title?: string, duration = 4000) => {
      const id = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newToast: ToastItem = { id, type, message, title, duration };

      setToasts((prev) => [...prev.slice(-4), newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const success = useCallback(
    (message: string, title?: string) => showToast('success', message, title),
    [showToast]
  );
  const error = useCallback(
    (message: string, title?: string) => showToast('error', message, title, 5000),
    [showToast]
  );
  const warning = useCallback(
    (message: string, title?: string) => showToast('warning', message, title),
    [showToast]
  );
  const info = useCallback(
    (message: string, title?: string) => showToast('info', message, title),
    [showToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info }}>
      {children}
      <div
        className="fixed bottom-4 right-4 left-4 sm:left-auto z-[60] flex flex-col gap-2 sm:w-[360px] pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((t) => {
          const config = {
            success: { icon: CheckCircle2, text: 'text-blue-300' },
            error: { icon: AlertCircle, text: 'text-rose-300' },
            warning: { icon: AlertTriangle, text: 'text-slate-200' },
            info: { icon: Info, text: 'text-slate-300' },
          }[t.type];

          const Icon = config.icon;

          return (
            <div
              key={t.id}
              className="pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-lg bg-overlay border border-line-strong"
              role={t.type === 'error' ? 'alert' : 'status'}
            >
              <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${config.text}`} />
              <div className="flex-1 min-w-0 text-[13px] leading-5">
                {t.title && <p className="font-medium text-white">{t.title}</p>}
                <p className="text-slate-200 break-words">{t.message}</p>
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="text-slate-300 hover:text-white p-0.5 -mr-1 rounded transition-colors shrink-0"
                aria-label="Đóng thông báo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return { ...context, toast: context };
};
