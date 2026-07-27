import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  title?: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
}

interface ToastContextValue {
  notify: (msg: Omit<ToastMessage, 'id'>) => string;
  success: (message: string, title?: string) => string;
  error: (message: string, title?: string) => string;
  warning: (message: string, title?: string) => string;
  info: (message: string, title?: string) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const VARIANT_STYLES: Record<
  ToastVariant,
  { ring: string; bg: string; text: string; icon: React.ElementType; iconColor: string }
> = {
  success: {
    ring: 'border-emerald-500/40',
    bg: 'bg-emerald-950/95',
    text: 'text-emerald-100',
    icon: CheckCircle2,
    iconColor: 'text-emerald-400',
  },
  error: {
    ring: 'border-rose-500/50',
    bg: 'bg-rose-950/95',
    text: 'text-rose-100',
    icon: XCircle,
    iconColor: 'text-rose-400',
  },
  warning: {
    ring: 'border-amber-500/50',
    bg: 'bg-amber-950/95',
    text: 'text-amber-100',
    icon: AlertTriangle,
    iconColor: 'text-amber-400',
  },
  info: {
    ring: 'border-sky-500/40',
    bg: 'bg-slate-900/95',
    text: 'text-slate-100',
    icon: Info,
    iconColor: 'text-sky-400',
  },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const counterRef = useRef(0);
  const timersRef = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const notify = useCallback(
    (msg: Omit<ToastMessage, 'id'>): string => {
      const id = `toast_${Date.now()}_${counterRef.current++}`;
      const toast: ToastMessage = { id, duration: 4500, ...msg };
      setToasts((prev) => [...prev, toast]);
      const duration = toast.duration ?? 4500;
      if (duration > 0) {
        const timer = window.setTimeout(() => dismiss(id), duration);
        timersRef.current.set(id, timer);
      }
      return id;
    },
    [dismiss]
  );

  const success = useCallback(
    (message: string, title?: string) => notify({ variant: 'success', message, title }),
    [notify]
  );
  const error = useCallback(
    (message: string, title?: string) => notify({ variant: 'error', message, title }),
    [notify]
  );
  const warning = useCallback(
    (message: string, title?: string) => notify({ variant: 'warning', message, title }),
    [notify]
  );
  const info = useCallback(
    (message: string, title?: string) => notify({ variant: 'info', message, title }),
    [notify]
  );

  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => window.clearTimeout(t));
      timersRef.current.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ notify, success, error, warning, info, dismiss }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed top-4 right-4 z-[1000] flex flex-col gap-3 pointer-events-none max-w-[calc(100vw-2rem)]"
      >
        {toasts.map((toast) => {
          const style = VARIANT_STYLES[toast.variant];
          const Icon = style.icon;
          return (
            <div
              key={toast.id}
              role="status"
              className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-2xl border-2 ${style.ring} ${style.bg} ${style.text} shadow-2xl backdrop-blur-md min-w-[280px] max-w-md animate-slide-in-right`}
            >
              <Icon className={`w-5 h-5 ${style.iconColor} shrink-0 mt-0.5`} />
              <div className="flex-1 min-w-0">
                {toast.title && (
                  <div className="font-extrabold text-sm mb-0.5">{toast.title}</div>
                )}
                <div className="text-xs leading-relaxed whitespace-pre-line break-words">
                  {toast.message}
                </div>
              </div>
              <button
                onClick={() => dismiss(toast.id)}
                className="text-slate-400 hover:text-white transition-colors shrink-0"
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

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within <ToastProvider>');
  }
  return ctx;
}

// ============================================================================
// Confirm Dialog — non-blocking replacement for window.confirm
// ============================================================================
interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

interface ConfirmState extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

const ConfirmContext = createContext<((opts: ConfirmOptions) => Promise<boolean>) | undefined>(undefined);

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ ...opts, resolve });
    });
  }, []);

  const handleClose = (ok: boolean) => {
    state?.resolve(ok);
    setState(null);
  };

  const variant = state?.variant ?? 'info';
  const accent =
    variant === 'danger'
      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/40'
      : variant === 'warning'
      ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/40'
      : 'bg-[#b48648] hover:bg-amber-600 text-black shadow-amber-600/40';

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="fixed inset-0 z-[999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="font-bold text-lg text-white">{state.title}</h3>
            <p className="text-sm text-slate-300 mt-2 whitespace-pre-line">{state.message}</p>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => handleClose(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold"
              >
                {state.cancelText ?? 'Hủy'}
              </button>
              <button
                onClick={() => handleClose(true)}
                className={`px-4 py-2 rounded-xl font-bold text-sm shadow-lg ${accent}`}
              >
                {state.confirmText ?? 'Đồng ý'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

export function useConfirm(): (opts: ConfirmOptions) => Promise<boolean> {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm must be used within <ConfirmProvider>');
  }
  return ctx;
}
