import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Bell, BellRing, Check, CheckCircle2, ShieldCheck, Users, X } from 'lucide-react';
import { useIncomingFamilyNotices, useMedAlerts } from '../../lib/medAlerts';
import { decideRequest, memberNameById, pendingIncoming, useAccessRequests } from '../../lib/access';
import { cn } from '../../lib/cn';

const supportsNotification = typeof window !== 'undefined' && 'Notification' in window;

/** กระดิ่งแจ้งเตือนบนแถบบน: ลืมกินยา และยาใกล้หมด/หมดแล้ว (ส่งแจ้งเตือนบนเครื่องได้ถ้าอนุญาต) */
export const NotificationBell: React.FC = () => {
  const alerts = useMedAlerts({ notify: true });
  const accessRequests = useAccessRequests();
  const incoming = pendingIncoming(accessRequests);
  const familyNotices = useIncomingFamilyNotices();
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

  const count = alerts.length + incoming.length + familyNotices.length;

  return (
    <div ref={rootRef} className="static lg:relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={count ? `การแจ้งเตือน ${count} รายการ` : 'การแจ้งเตือน ไม่มีรายการใหม่'}
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex items-center justify-center w-12 h-12 rounded-2xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
      >
        {count ? (
          /* สั่นเบา ๆ ครั้งเดียวเมื่อมีรายการใหม่ (คีย์เปลี่ยนตามจำนวน) */
          <BellRing key={count} className="anim-swing w-6 h-6" aria-hidden="true" />
        ) : (
          <Bell className="w-6 h-6" aria-hidden="true" />
        )}
        {count > 0 && (
          <span className="anim-pop absolute -top-1 -right-1 min-w-6 h-6 px-1.5 rounded-full bg-purple-600 text-white text-sm font-bold flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="การแจ้งเตือน"
          className="absolute left-3 right-3 lg:left-auto lg:right-0 top-full z-50 mt-2 max-w-md mx-auto lg:mx-0 lg:w-96 max-h-[calc(100vh-6rem)] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
        >
          <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-3 border-b border-slate-100 shrink-0">
            <p className="text-lg font-bold text-slate-900">การแจ้งเตือน</p>
            <Link
              to="/meds"
              onClick={() => setOpen(false)}
              className="text-sm font-semibold text-purple-800 hover:underline"
            >
              ไปที่ตู้ยา
            </Link>
          </div>

          <div className="overflow-y-auto flex-1 overscroll-contain">
            {incoming.length > 0 && (
              <ul className="p-3 space-y-3 border-b border-slate-100">
                {incoming.map((req) => (
                  <li key={req.id} className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5">
                    <div className="flex items-start gap-2.5">
                      <ShieldCheck className="w-5 h-5 mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-base font-bold text-slate-900 break-words">
                          {memberNameById(req.requesterId)} ขอ{req.scope === 'edit' ? 'แก้ไขข้อมูลของคุณ' : 'ดูข้อมูลของคุณ'}
                        </p>
                        {req.message && <p className="mt-0.5 text-sm text-slate-600 break-words">“{req.message}”</p>}
                      </div>
                    </div>
                    {/* ตอบได้ทันที ไม่ต้องเปิดหน้าอื่น */}
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => decideRequest(req.id, 'always')}
                        className="col-span-2 inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl bg-purple-700 text-base font-bold text-white hover:bg-purple-800 cursor-pointer"
                      >
                        <Check className="w-5 h-5" aria-hidden="true" />
                        อนุญาต
                      </button>
                      <button
                        type="button"
                        onClick={() => decideRequest(req.id, 'once')}
                        className="min-h-[44px] rounded-xl border border-purple-200 bg-white text-sm font-bold text-purple-900 hover:bg-purple-50 cursor-pointer"
                      >
                        เฉพาะครั้งนี้
                      </button>
                      <button
                        type="button"
                        onClick={() => decideRequest(req.id, 'denied')}
                        className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-xl border border-red-200 bg-white text-sm font-bold text-red-700 hover:bg-red-50 cursor-pointer"
                      >
                        <X className="w-4 h-4" aria-hidden="true" />
                        ไม่อนุญาต
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {familyNotices.length > 0 && (
              <ul className="p-3 space-y-2 border-b border-slate-100">
                {familyNotices.map((n) => (
                  <li key={n.key}>
                    <Link
                      to="/journal"
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-3 hover:bg-red-100"
                    >
                      <Users className="w-5 h-5 mt-0.5 shrink-0 text-red-700" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block text-base font-bold text-slate-900 break-words">{n.title}</span>
                        <span className="block text-sm text-slate-700 break-words">{n.body}</span>
                        <span className="mt-1 block text-xs font-bold text-red-800">
                          แจ้งคนในบ้านแล้ว · ดูในบันทึกอาการ
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {count === 0 ? (
              <p className="flex items-center gap-2 p-6 text-base text-slate-600 justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" aria-hidden="true" />
                ไม่มีเรื่องต้องจัดการตอนนี้
              </p>
            ) : alerts.length === 0 ? null : (
              <ul className="px-2 py-2">
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
                        {a.kind === 'missed' && a.rounds > 1 && (
                          <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                            เตือนครั้งที่ {a.round} จาก {a.rounds}
                            {a.nextTime ? ` · ซ้ำอีก ${a.nextTime} น.` : ''}
                          </span>
                        )}
                        {a.sharedWithFamily && (
                          <span className="mt-1 flex items-center gap-1 text-xs font-bold text-purple-800">
                            <Users className="w-4 h-4 shrink-0" aria-hidden="true" />
                            แจ้งทุกคนในบ้านแล้ว
                          </span>
                        )}
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
            <p className="px-4 pb-4 pt-2 text-xs text-slate-500 border-t border-slate-100">
              เปิด/ปิดประเภทการเตือนได้ที่ ตั้งค่าส่วนตัว › การเตือน
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
