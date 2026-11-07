import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Mascot } from './Mascot';

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

  return (
    <div
      className={cn(
        'anim-drop-in flex items-center gap-3 rounded-[1.5rem] px-5 py-3.5 text-white shadow-xl shadow-purple-950/30',
        toast.tone === 'error' ? 'bg-red-700' : 'bg-purple-950'
      )}
    >
      {toast.tone === 'error' ? (
        <AlertCircle className="w-7 h-7 shrink-0 text-red-100" aria-hidden="true" />
      ) : (
        <span className="relative shrink-0">
          <Mascot kind="sun" still className="h-10 w-10" />
          <CheckCircle2 className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-purple-950 text-emerald-400" aria-hidden="true" />
        </span>
      )}
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
