import React, { useEffect, useId } from 'react';
import { X } from 'lucide-react';

type Tone = 'ok' | 'warn' | 'error' | 'idle' | 'brand';

const toneDot: Record<Tone, string> = {
  ok: 'bg-emerald-400',
  warn: 'bg-amber-400',
  error: 'bg-rose-500',
  idle: 'bg-zinc-600',
  brand: 'bg-brand',
};

const toneBar: Record<Tone, string> = {
  ok: 'bg-emerald-400',
  warn: 'bg-amber-400',
  error: 'bg-rose-500',
  idle: 'bg-zinc-500',
  brand: 'bg-brand',
};

export const StatusDot: React.FC<{ tone: Tone; className?: string }> = ({ tone, className = '' }) => (
  <span aria-hidden className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${toneDot[tone]} ${className}`} />
);

export const ProgressBar: React.FC<{ value: number; tone?: Tone; label?: string }> = ({
  value,
  tone = 'brand',
  label,
}) => {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      aria-label={label}
      className="h-1.5 w-full bg-white/[0.08] rounded-full overflow-hidden"
    >
      <div
        className={`h-full w-full origin-left rounded-full transition-transform duration-500 ${toneBar[tone]}`}
        style={{ transform: `scaleX(${clamped / 100})` }}
      />
    </div>
  );
};

interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, meta, actions }) => (
  <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between pb-6 border-b border-line">
    <div className="min-w-0 space-y-1.5">
      <h1 className="text-[22px] sm:text-2xl font-semibold tracking-tight text-white">{title}</h1>
      {description && <p className="text-sm text-zinc-300 max-w-2xl leading-relaxed">{description}</p>}
      {meta && <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-zinc-400">{meta}</div>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
  </header>
);

interface SectionProps {
  id?: string;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const Section: React.FC<SectionProps> = ({ id, title, description, action, children, className = '' }) => (
  <section id={id} className={className}>
    <div className="flex items-baseline justify-between gap-4 mb-3">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-white">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-zinc-400">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
    {children}
  </section>
);

interface SwitchProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label: string;
}

export const Switch: React.FC<SwitchProps> = ({ checked, onChange, disabled, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={onChange}
    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
      checked ? 'bg-brand' : 'bg-white/[0.14]'
    }`}
  >
    <span
      className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
        checked ? 'translate-x-[18px]' : 'translate-x-0.5'
      }`}
    />
  </button>
);

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface SegmentedControlProps<T extends string> {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}

export function SegmentedControl<T extends string>({ options, value, onChange, ariaLabel }: SegmentedControlProps<T>) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="flex items-center gap-0.5 overflow-x-auto">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`h-8 px-3 rounded-md text-[13px] font-medium whitespace-nowrap transition-colors ${
              active ? 'bg-white/[0.1] text-white' : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.05]'
            }`}
          >
            {opt.label}
            {opt.count !== undefined && (
              <span className={`ml-1.5 tabular-nums ${active ? 'text-zinc-300' : 'text-zinc-600'}`}>{opt.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, description, action, icon }) => (
  <div className="py-14 px-6 text-center">
    {icon && <div className="mx-auto mb-3 flex justify-center text-zinc-600">{icon}</div>}
    <p className="text-sm font-medium text-zinc-200">{title}</p>
    {description && <p className="mt-1 text-[13px] text-zinc-400 max-w-sm mx-auto leading-relaxed">{description}</p>}
    {action && <div className="mt-5 flex justify-center">{action}</div>}
  </div>
);

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md';
}

export const Dialog: React.FC<DialogProps> = ({ isOpen, onClose, title, description, children, footer, size = 'md' }) => {
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative w-full ${size === 'sm' ? 'sm:max-w-sm' : 'sm:max-w-md'} bg-overlay border border-line-strong rounded-t-xl sm:rounded-xl shadow-2xl shadow-black`}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-5">
          <div>
            <h2 id={titleId} className="text-[15px] font-semibold text-white">
              {title}
            </h2>
            {description && <p className="mt-1 text-[13px] text-zinc-400 leading-relaxed">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="btn-ghost btn-sm -mr-2 -mt-1 px-1.5" aria-label="Đóng">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-line">{footer}</div>}
      </div>
    </div>
  );
};
