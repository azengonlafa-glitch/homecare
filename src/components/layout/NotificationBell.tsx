import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Bell, BellRing, CheckCircle2 } from 'lucide-react';
import { useMedAlerts } from '../../lib/medAlerts';
import { cn } from '../../lib/cn';

const supportsNotification = typeof window !== 'undefined' && 'Notification' in window;

/** กระดิ่งแจ้งเตือนบนแถบบน: ลืมกินยา และยาใกล้หมด/หมดแล้ว (ส่งแจ้งเตือนบนเครื่องได้ถ้าอนุญาต) */
export const NotificationBell: React.FC = () => {
  const alerts = useMedAlerts({ notify: true });
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState(supportsNotification ? Notification.permission : 'denied');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const askPermission = async () => {
    if (!supportsNotification) return;
    const result = await Notification.requestPermission();
    setPermission(result);
  };

  const count = alerts.length;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={count ? `การแจ้งเตือน ${count} รายการ` : 'การแจ้งเตือน ไม่มีรายการใหม่'}
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex items-center justify-center w-12 h-12 rounded-2xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
      >
        {count ? <BellRing className="w-6 h-6" aria-hidden="true" /> : <Bell className="w-6 h-6" aria-hidden="true" />}
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-6 h-6 px-1.5 rounded-full bg-red-600 text-white text-sm font-bold flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="การแจ้งเตือน"
          className="absolute right-0 top-full z-40 mt-2 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white shadow-xl"
        >
          <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-3">
            <p className="text-lg font-bold text-slate-900">การแจ้งเตือน</p>
            <Link
              to="/meds"
              onClick={() => setOpen(false)}
              className="text-sm font-semibold text-purple-800 hover:underline"
            >
              ไปที่ตู้ยา
            </Link>
          </div>

          {count === 0 ? (
            <p className="flex items-center gap-2 px-4 pb-4 text-base text-slate-600">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" aria-hidden="true" />
              ไม่มีเรื่องต้องจัดการตอนนี้
            </p>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto px-2 pb-2">
              {alerts.map((a) => (
                <li key={a.key}>
                  <Link
                    to="/meds"
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 rounded-xl px-2 py-3 hover:bg-slate-50"
                  >
                    {a.kind === 'missed' ? (
                      <BellRing className="w-5 h-5 mt-0.5 shrink-0 text-red-600" aria-hidden="true" />
                    ) : (
                      <AlertTriangle
                        className={cn('w-5 h-5 mt-0.5 shrink-0', a.tone === 'danger' ? 'text-red-600' : 'text-amber-600')}
                        aria-hidden="true"
                      />
                    )}
                    <span className="min-w-0">
                      <span className="block text-base font-bold text-slate-900 break-words">{a.title}</span>
                      <span className="block text-sm text-slate-600 break-words">{a.body}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {supportsNotification && permission !== 'granted' && (
            <div className="border-t border-slate-200 p-4">
              {permission === 'denied' ? (
                <p className="text-sm text-slate-600">
                  เบราว์เซอร์ปิดการแจ้งเตือนของเว็บนี้ไว้ เปิดได้ที่การตั้งค่าของเบราว์เซอร์
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => void askPermission()}
                  className="w-full min-h-[48px] rounded-xl bg-purple-50 border border-purple-200 text-base font-bold text-purple-900 hover:bg-purple-100 cursor-pointer"
                >
                  เปิดการแจ้งเตือนบนเครื่องนี้
                </button>
              )}
            </div>
          )}
          <p className="px-4 pb-4 text-xs text-slate-500">
            เปิด/ปิดประเภทการเตือนได้ที่ ตั้งค่าส่วนตัว › การเตือน
          </p>
        </div>
      )}
    </div>
  );
};
