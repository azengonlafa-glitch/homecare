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
  const error = toast.tone === 'error';
  return (
    <div
      className={cn(
        'anim-drop-in relative overflow-hidden rounded-[1.5rem] bg-white py-3.5 pl-4 pr-5 shadow-[0_14px_34px_-14px_rgba(42,34,29,0.5)] ring-1',
        error ? 'ring-red-200' : 'ring-purple-100'
      )}
    >
      <div className="flex items-center gap-3">
        {error ? (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-50">
            <AlertCircle className="h-6 w-6 text-red-600" aria-hidden="true" />
          </span>
        ) : (
          <span className="relative shrink-0">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FFF4E8]">
              <Mascot kind="sun" still className="h-9 w-9" />
            </span>
            <CheckCircle2 className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-white text-emerald-500" aria-hidden="true" />
          </span>
        )}
        <p className={cn('min-w-0 break-words text-base font-bold leading-snug', error ? 'text-red-800' : 'text-purple-900')}>
          {toast.message}
        </p>
      </div>
      {/* แถบเวลาไล่หมดตามที่ Toast ค้างอยู่ */}
      <span
        aria-hidden="true"
        className={cn('toast-timer absolute inset-x-0 bottom-0 h-1 origin-left', error ? 'bg-red-300' : 'bg-purple-300')}
        style={{ animationDuration: `${TOAST_DURATION_MS}ms` }}
      />
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
