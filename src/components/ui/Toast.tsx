import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/cn';

type ToastTone = 'success' | 'error';

interface ToastOptions {
  tone?: ToastTone;
}

interface ToastApi {
  /** แสดงข้อความแจ้งผลใกล้ด้านบนจอ ค้างประมาณ 3 วินาที แล้วหายเอง */
  show: (message: string, options?: ToastOptions) => void;
}

interface ToastState {
  id: number;
  message: string;
  tone: ToastTone;
}

/** เวลาที่ Toast ค้างอยู่ (มิลลิวินาที) */
export const TOAST_DURATION_MS = 3000;

const ToastContext = createContext<ToastApi | null>(null);

const ToastItem: React.FC<{ toast: ToastState }> = ({ toast }) => {
  // เริ่มโปร่งใสแล้วค่อยเลื่อนลงมา (ปิดอนิเมชันเองเมื่อผู้ใช้ตั้งค่า reduced motion ผ่าน index.css)
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const Icon = toast.tone === 'error' ? AlertCircle : CheckCircle2;

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl px-5 py-3.5 text-white shadow-lg shadow-slate-900/20',
        'transition-all duration-200',
        shown ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3',
        toast.tone === 'error' ? 'bg-red-700' : 'bg-slate-900'
      )}
    >
      <Icon
        className={cn('w-7 h-7 shrink-0', toast.tone === 'error' ? 'text-red-100' : 'text-emerald-400')}
        aria-hidden="true"
      />
      <p className="text-base font-bold leading-snug break-words min-w-0">{toast.message}</p>
    </div>
  );
};

/**
 * Toast กลางของแอป: ใส่ ToastProvider ครั้งเดียว แล้วเรียก useToast().show('บันทึกแล้ว') จากหน้าไหนก็ได้
 * ข้อความถูกประกาศให้ screen reader ผ่าน aria-live ด้วย
 */
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const counter = useRef(0);

  const show = useCallback((message: string, options?: ToastOptions) => {
    window.clearTimeout(timer.current);
    counter.current += 1;
    setToast({ id: counter.current, message, tone: options?.tone ?? 'success' });
    timer.current = window.setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* พื้นที่ประกาศอยู่ตลอด เพื่อให้ screen reader อ่านข้อความใหม่ทุกครั้ง ไม่บังการกดของหน้าด้านล่าง */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex justify-center px-4 pt-[max(1rem,env(safe-area-inset-top))]"
      >
        <div className="w-full max-w-md">{toast && <ToastItem key={toast.id} toast={toast} />}</div>
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast ต้องใช้ภายใน ToastProvider');
  return api;
}
