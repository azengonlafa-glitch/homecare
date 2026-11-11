import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  BellRing,
  Calendar,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  Pill,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { decideRequest, memberNameById, pendingIncoming, useAccessRequests } from '../../lib/access';
import { useDueFollowUps } from '../../consult/hooks';
import {
  useHealthNotifications,
  type HealthNotification,
  type NotificationCategory,
} from '../../lib/notifications';
import { cn } from '../../lib/cn';
import { playNotifySound } from '../../lib/sound';
import { relativeDateTime } from '../member/memberUi';

const supportsNotification = typeof window !== 'undefined' && 'Notification' in window;

const CAT_ICON: Record<NotificationCategory, React.ComponentType<{ className?: string }>> = {
  medication: Pill,
  appointment: Calendar,
  family: Users,
  system: Bell,
};

/** กระดิ่งแจ้งเตือนบนแถบบน: เชื่อมโยงกับ Health Notification Tracking System */
export const NotificationBell: React.FC = () => {
  const { notifications, unreadCount, markAsRead } = useHealthNotifications();
  const accessRequests = useAccessRequests();
  const incoming = pendingIncoming(accessRequests);
  const dueFollowUps = useDueFollowUps();
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

  const totalUnread = unreadCount + incoming.length + dueFollowUps.length;

  // มีแจ้งเตือนใหม่เพิ่มเข้ามาขณะเปิดแอป (ไม่เล่นตอนเปิดหน้าครั้งแรก) ให้มีเสียงเตือน
  const prevUnread = useRef<number | null>(null);
  useEffect(() => {
    if (prevUnread.current !== null && totalUnread > prevUnread.current) playNotifySound();
    prevUnread.current = totalUnread;
  }, [totalUnread]);

  return (
    <div ref={rootRef} className="static lg:relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={totalUnread ? `การแจ้งเตือน ${totalUnread} รายการใหม่` : 'การแจ้งเตือน ไม่มีรายการใหม่'}
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex items-center justify-center w-12 h-12 rounded-2xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs transition-colors"
      >
        {totalUnread > 0 ? (
          <BellRing key={totalUnread} className="anim-swing w-6 h-6 text-purple-700" aria-hidden="true" />
        ) : (
          <Bell className="w-6 h-6" aria-hidden="true" />
        )}
        {totalUnread > 0 && (
          <span className="anim-pop absolute -top-1 -right-1 min-w-6 h-6 px-1.5 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center">
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="การแจ้งเตือนเหตุการณ์สุขภาพ"
          className="absolute left-3 right-3 lg:left-auto lg:right-0 top-full z-50 mt-2 max-w-md mx-auto lg:mx-0 lg:w-96 max-h-[calc(100vh-6rem)] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
        >
          {/* แถบหัวกระดิ่ง */}
          <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 shrink-0">
            <div className="flex items-center gap-2">
              <p className="text-base font-extrabold text-slate-900">การแจ้งเตือน</p>
              {unreadCount > 0 && (
                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-900">
                  ใหม่ {unreadCount}
                </span>
              )}
            </div>
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-extrabold text-purple-700 hover:text-purple-900 hover:underline inline-flex items-center gap-0.5"
            >
              <span>ศูนย์แจ้งเตือน</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-y-auto flex-1 overscroll-contain divide-y divide-slate-100">
            {/* คำขอสิทธิ์การเข้าถึงข้อมูล */}
            {incoming.length > 0 && (
              <ul className="p-3 space-y-2.5 bg-amber-50/30">
                {incoming.map((req) => (
                  <li key={req.id} className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3">
                    <div className="flex items-start gap-2.5">
                      <ShieldCheck className="w-5 h-5 mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 break-words">
                          {memberNameById(req.requesterId)} ขอ{req.scope === 'edit' ? 'แก้ไขข้อมูลของคุณ' : 'ดูข้อมูลของคุณ'}
                        </p>
                        {req.message && <p className="mt-0.5 text-xs text-slate-600 break-words">“{req.message}”</p>}
                      </div>
                    </div>
                    <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => decideRequest(req.id, 'always')}
                        className="col-span-2 inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-purple-700 text-sm font-bold text-white hover:bg-purple-800 cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        อนุญาต
                      </button>
                      <button
                        type="button"
                        onClick={() => decideRequest(req.id, 'once')}
                        className="min-h-[38px] rounded-xl border border-purple-200 bg-white text-xs font-bold text-purple-900 hover:bg-purple-50 cursor-pointer"
                      >
                        เฉพาะครั้งนี้
                      </button>
                      <button
                        type="button"
                        onClick={() => decideRequest(req.id, 'denied')}
                        className="inline-flex min-h-[38px] items-center justify-center gap-1 rounded-xl border border-red-200 bg-white text-xs font-bold text-red-700 hover:bg-red-50 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        ไม่อนุญาต
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* นัดติดตามผลการปรึกษา */}
            {dueFollowUps.length > 0 && (
              <ul className="p-3 space-y-2 bg-purple-50/30">
                {dueFollowUps.map(({ followUp, providerName }) => (
                  <li key={followUp.id}>
                    <Link
                      to={`/consult/followup/${followUp.id}`}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-3 rounded-2xl border border-purple-200 bg-purple-50 px-3 py-2.5 hover:bg-purple-100"
                    >
                      <CalendarClock className="w-5 h-5 mt-0.5 shrink-0 text-purple-700" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-slate-900 break-words">ถึงเวลาอัปเดตอาการ</span>
                        <span className="block text-xs text-slate-700 break-words">นัดติดตามผลกับ {providerName}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {/* รายการเหตุการณ์สุขภาพล่าสุด */}
            {notifications.length === 0 && incoming.length === 0 && dueFollowUps.length === 0 ? (
              <div className="py-10 text-center px-4">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" aria-hidden="true" />
                <p className="mt-2 text-sm font-bold text-slate-800">ไม่มีเรื่องต้องจัดการในขณะนี้</p>
                <p className="mt-0.5 text-xs text-slate-500">รับประทานยาและติดตามสุขภาพครบถ้วน</p>
              </div>
            ) : (
              <ul className="p-2 space-y-1.5">
                {notifications.slice(0, 6).map((item: HealthNotification) => {
                  const Icon = CAT_ICON[item.category];
                  const isUrgent = item.priority === 'urgent';
                  const isResolved = item.actionStatus === 'resolved';

                  return (
                    <li key={item.id}>
                      <Link
                        to={item.link || '/notifications'}
                        onClick={() => {
                          if (!item.isRead) markAsRead(item.id);
                          setOpen(false);
                        }}
                        className={cn(
                          'flex items-start gap-3 rounded-xl p-2.5 transition-colors group hover:bg-slate-50',
                          !item.isRead ? 'bg-purple-50/50' : 'bg-white',
                          isResolved && 'opacity-70'
                        )}
                      >
                        <div
                          className={cn(
                            'h-8 w-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5',
                            isUrgent ? 'bg-rose-100 text-rose-700' : 'bg-purple-100 text-purple-700'
                          )}
                        >
                          <Icon className="w-4 h-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-extrabold text-slate-900 group-hover:text-purple-800 line-clamp-1">
                              {item.title}
                            </span>
                            {!item.isRead && (
                              <span className="h-2 w-2 rounded-full bg-purple-600 shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-slate-600 line-clamp-1 mt-0.5">
                            {item.body}
                          </p>
                          <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
                            <span>{relativeDateTime(item.createdAt)}</span>
                            {isResolved && (
                              <span className="text-emerald-700 font-bold flex items-center gap-0.5">
                                <Check className="w-3 h-3" />
                                <span>จัดการแล้ว</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* ส่วนขออนุญาตแจ้งเตือนบนเบราว์เซอร์ */}
            {supportsNotification && permission !== 'granted' && (
              <div className="p-3 bg-slate-50">
                {permission === 'denied' ? (
                  <p className="text-xs text-slate-500">
                    เบราว์เซอร์ปิดการแจ้งเตือนไว้ เปิดได้ที่การตั้งค่าของเบราว์เซอร์
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => void askPermission()}
                    className="w-full min-h-[40px] rounded-xl bg-purple-100 text-xs font-bold text-purple-900 hover:bg-purple-200 transition-colors cursor-pointer"
                  >
                    เปิดการแจ้งเตือนบนเครื่องนี้
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ส่วนท้ายกระดิ่ง: ลิงก์ไปยังหน้า Notification Center เต็มรูปแบบ */}
          <div className="p-3 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between shrink-0">
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-purple-700 py-2.5 text-xs sm:text-sm font-extrabold text-white hover:bg-purple-800 transition-colors"
            >
              <span>เปิดศูนย์การแจ้งเตือน ({notifications.length} เหตุการณ์)</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
