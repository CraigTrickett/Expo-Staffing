import React, { useState, useEffect } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

type ToastListener = (toasts: ToastItem[]) => void;

class ToastManager {
  private toasts: ToastItem[] = [];
  private listeners: Set<ToastListener> = new Set();

  subscribe(listener: ToastListener): () => void {
    this.listeners.add(listener);
    listener([...this.toasts]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener([...this.toasts]));
  }

  show(message: string, type: ToastType = 'info', title?: string, duration = 4000) {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newToast: ToastItem = { id, message, type, title, duration };
    this.toasts = [...this.toasts, newToast];
    this.notify();

    if (duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, duration);
    }
    return id;
  }

  dismiss(id: string) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notify();
  }

  clear() {
    this.toasts = [];
    this.notify();
  }

  success(message: string, title?: string, duration?: number) {
    return this.show(message, 'success', title, duration);
  }

  error(message: string, title?: string, duration?: number) {
    return this.show(message, 'error', title, duration ?? 5000);
  }

  warning(message: string, title?: string, duration?: number) {
    return this.show(message, 'warning', title, duration ?? 4500);
  }

  info(message: string, title?: string, duration?: number) {
    return this.show(message, 'info', title, duration);
  }
}

export const toast = new ToastManager();

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    return toast.subscribe((updated) => setToasts(updated));
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
    >
      {toasts.map((t) => {
        let borderClass = 'border-slate-700 bg-slate-900/95 text-slate-100';
        let Icon = Info;
        let iconColor = 'text-blue-400';

        if (t.type === 'success') {
          borderClass = 'border-emerald-500/40 bg-slate-900/95 text-emerald-100';
          Icon = CheckCircle2;
          iconColor = 'text-emerald-400';
        } else if (t.type === 'error') {
          borderClass = 'border-red-500/50 bg-slate-900/95 text-red-100';
          Icon = AlertCircle;
          iconColor = 'text-red-400';
        } else if (t.type === 'warning') {
          borderClass = 'border-amber-500/50 bg-slate-900/95 text-amber-100';
          Icon = AlertTriangle;
          iconColor = 'text-amber-400';
        }

        return (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto rounded-xl border p-3.5 shadow-2xl backdrop-blur-md transition-all duration-200 animate-in slide-in-from-bottom-3 fade-in flex items-start gap-3',
              borderClass
            )}
            role="alert"
          >
            <Icon className={cn('w-5 h-5 shrink-0 mt-0.5', iconColor)} />
            <div className="flex-1 text-xs">
              {t.title && <div className="font-semibold mb-0.5 text-white">{t.title}</div>}
              <div className="text-slate-300 leading-relaxed">{t.message}</div>
            </div>
            <button
              type="button"
              onClick={() => toast.dismiss(t.id)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors shrink-0"
              aria-label="Close notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
