import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Pill,
  Search,
  Settings as SettingsIcon,
  ShieldAlert,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { cn } from '../lib/cn';
import { CURRENT_MEMBER_ID, loadSettings } from '../lib/settings';
import {
  CATEGORY_LABELS,
  useHealthNotifications,
  type HealthNotification,
  type NotificationCategory,
  type NotificationPriority,
} from '../lib/notifications';
import { relativeDateTime, shortDateTime } from '../components/member/memberUi';

const CATEGORY_ICONS: Record<NotificationCategory, React.ComponentType<{ className?: string }>> = {
  medication: Pill,
  appointment: Calendar,
  family: Users,
  system: Bell,
};

const PRIORITY_STYLES: Record<NotificationPriority, { border: string; bg: string }> = {
  urgent: {
    border: 'border-rose-300 hover:border-rose-400',
    bg: 'bg-rose-50/20',
  },
  important: {
    border: 'border-amber-300 hover:border-amber-400',
    bg: 'bg-amber-50/20',
  },
  routine: {
    border: 'border-slate-200 hover:border-purple-300',
    bg: 'bg-white',
  },
};

type FilterCategory = 'all' | NotificationCategory;
type FilterStatus = 'pending' | 'unread' | 'all' | 'resolved';

/**
 * ตัดทอนคำพูดและชื่อซ้ำซ้อนให้กระชับ เป็นภาษาพูดที่เข้าใจง่าย สบายตา
 */
function simplifyNotification(item: HealthNotification) {
  let title = item.title;
  let body = item.body;

  // 1. ตัดชื่อที่ซ้ำในหัวข้อ
  if (item.memberName) {
    const escaped = item.memberName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    title = title
      .replace(new RegExp(`\\s*\\(${escaped}\\)`, 'gi'), '')
      .replace(new RegExp(`\\s*ของ\\s*${escaped}`, 'gi'), '')
      .replace(new RegExp(`${escaped}\\s*เพิ่มบันทึกสุขภาพใหม่`, 'gi'), 'เพิ่มบันทึกอาการใหม่')
      .trim();
  }

  // 2. ปรับคำทางการให้เป็นภาษาพูดที่ชัดเจน
  title = title
    .replace('ยังไม่มีการยืนยันการรับประทานยา:', 'ยังไม่ได้กินยา:')
    .replace('ยังไม่ยืนยันการรับประทานยา:', 'ยังไม่ได้กินยา:')
    .replace('ถึงเวลารับประทานยา:', 'ถึงเวลากินยา:')
    .replace('ใกล้ถึงเวลารับประทานยา', 'ใกล้ถึงเวลากินยา')
    .replace('มีการข้ามยา', 'ข้ามยา')
    .trim();

  // 3. ปรับรายละเอียดให้สั้นกระชับ
  body = body
    .replace('เลยเวลากำหนดแล้ว กรุณาตรวจสอบ', 'เลยเวลากำหนดแล้ว')
    .replace('กรุณาตรวจสอบการรับประทานยา', '')
    .trim();

  // 4. ป้ายปุ่มดำเนินการ
  let actionLabel = item.actionLabel;
  if (actionLabel === 'ยืนยันการรับประทาน') actionLabel = 'ยืนยันการกินยา';
  if (actionLabel === 'ดูบันทึกอาการ') actionLabel = 'ดูบันทึก';

  return { title, body, actionLabel };
}

/**
 * ศูนย์การแจ้งเตือนเหตุการณ์สุขภาพ (Notification Center)
 * ขนาดตัวอักษรและการ์ดใหญ่เต็มตา ชัดเจน อ่านง่าย ไม่รก
 */
export const NotificationsPage: React.FC = () => {
  const toast = useToast();
  const settings = loadSettings();
  const {
    notifications,
    unreadCount,
    pendingCount,
    markAsRead,
    markAllAsRead,
    resolve,
    deleteNotification,
  } = useHealthNotifications();

  // สถานะตัวกรอง
  const [statusFilter, setStatusFilter] = useState<FilterStatus>(
    pendingCount > 0 ? 'pending' : 'all'
  );
  const [activeTab, setActiveTab] = useState<FilterCategory>('all');
  const [memberFilter, setMemberFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNotif, setSelectedNotif] = useState<HealthNotification | null>(null);

  const resolvedCount = useMemo(
    () => notifications.filter((n) => n.actionStatus === 'resolved').length,
    [notifications]
  );

  // การกรองข้อมูล
  const filtered = useMemo(() => {
    return notifications.filter((item) => {
      // 1. สถานะ
      if (statusFilter === 'pending' && item.actionStatus !== 'pending') return false;
      if (statusFilter === 'unread' && item.isRead) return false;
      if (statusFilter === 'resolved' && item.actionStatus !== 'resolved') return false;

      // 2. หมวดหมู่
      if (activeTab !== 'all' && item.category !== activeTab) return false;

      // 3. สมาชิก
      if (memberFilter !== 'all' && item.memberId !== memberFilter) return false;

      // 4. ค้นหา
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const inTitle = item.title.toLowerCase().includes(q);
        const inBody = item.body.toLowerCase().includes(q);
        const inDetail = (item.detail || '').toLowerCase().includes(q);
        const inMember = (item.memberName || '').toLowerCase().includes(q);
        const inMed = (item.medName || '').toLowerCase().includes(q);
        if (!inTitle && !inBody && !inDetail && !inMember && !inMed) return false;
      }

      return true;
    });
  }, [notifications, statusFilter, activeTab, memberFilter, searchQuery]);

  const handleOpenDetail = (notif: HealthNotification) => {
    const now = new Date().toISOString();
    const updatedRecipients = notif.recipients.map((r) =>
      r.memberId === CURRENT_MEMBER_ID ? { ...r, readAt: r.readAt ?? now } : r
    );
    if (!updatedRecipients.some((r) => r.memberId === CURRENT_MEMBER_ID)) {
      updatedRecipients.push({
        memberId: CURRENT_MEMBER_ID,
        memberName: 'ฉัน',
        role: 'family',
        deliveredAt: notif.createdAt,
        readAt: now,
      });
    }
    const updatedNotif: HealthNotification = {
      ...notif,
      isRead: true,
      readAt: notif.readAt ?? now,
      recipients: updatedRecipients,
    };
    if (!notif.isRead) {
      markAsRead(notif.id);
    }
    setSelectedNotif(updatedNotif);
  };

  const handleResolve = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    resolve(id, 'ผู้ใช้ยืนยันการจัดการแล้ว');
    toast.show('ทำเครื่องหมายว่าเรียบร้อยแล้ว');
    if (selectedNotif?.id === id) {
      setSelectedNotif((prev) => (prev ? { ...prev, actionStatus: 'resolved', isRead: true } : null));
    }
  };

  const handleMarkAllRead = () => {
    markAllAsRead();
    toast.show('อ่านทั้งหมดแล้ว');
  };

  return (
    <div className="w-full space-y-6">
      {/* 1. Header: ขนาดใหญ่ ชัดเจน เต็มตา */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
            การแจ้งเตือน
          </h1>
          {pendingCount > 0 ? (
            <span className="px-3.5 py-1 rounded-full text-sm font-bold bg-amber-100 text-amber-900 shadow-2xs">
              ต้องดูแล {pendingCount}
            </span>
          ) : (
            <span className="px-3.5 py-1 rounded-full text-sm font-bold bg-emerald-100 text-emerald-800 shadow-2xs">
              เรียบร้อยทั้งหมด
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-sm font-bold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
            >
              อ่านทั้งหมด ({unreadCount})
            </button>
          )}
          <Link
            to="/settings/reminders"
            className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-2xs"
            title="ตั้งค่าผู้รับ"
          >
            <SettingsIcon className="w-5 h-5" />
          </Link>
        </div>
      </div>

      {/* 2. Control Toolbar: ปรับตามขนาดหน้าจอ มือถือ/แท็บเล็ต/คอมพิวเตอร์ */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
        {/* แท็บสถานะหลัก: สกอร์ลได้ไม่ล้นจอมือถือ */}
        <div className="inline-flex p-1.5 rounded-2xl bg-slate-100 border border-slate-200 text-sm font-bold w-full sm:w-fit max-w-full overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setStatusFilter('pending')}
            className={cn(
              'inline-flex items-center justify-center gap-2 px-3.5 sm:px-5 py-2.5 rounded-xl transition cursor-pointer min-h-[44px] shrink-0',
              statusFilter === 'pending'
                ? 'bg-white text-purple-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <span>ต้องดูแล</span>
            {pendingCount > 0 && (
              <span className="h-5 min-w-5 px-1.5 rounded-full text-xs font-black flex items-center justify-center bg-amber-500 text-white">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('unread')}
            className={cn(
              'inline-flex items-center justify-center gap-2 px-3.5 sm:px-5 py-2.5 rounded-xl transition cursor-pointer min-h-[44px] shrink-0',
              statusFilter === 'unread'
                ? 'bg-white text-purple-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <span>ยังไม่อ่าน</span>
            {unreadCount > 0 && (
              <span className="h-5 min-w-5 px-1.5 rounded-full text-xs font-black flex items-center justify-center bg-purple-700 text-white">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={cn(
              'px-3.5 sm:px-5 py-2.5 rounded-xl transition cursor-pointer min-h-[44px] shrink-0 text-center',
              statusFilter === 'all'
                ? 'bg-white text-purple-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            ทั้งหมด ({notifications.length})
          </button>

          {resolvedCount > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter('resolved')}
              className={cn(
                'px-3.5 sm:px-5 py-2.5 rounded-xl transition cursor-pointer min-h-[44px] shrink-0 hidden sm:block',
                statusFilter === 'resolved'
                  ? 'bg-white text-purple-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              เสร็จแล้ว ({resolvedCount})
            </button>
          )}
        </div>

        {/* ตัวกรองสมาชิก, หมวดหมู่ และ ช่องค้นหา: บนมือถือจัดเรียงเป็นตารางไม่ล้น */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2.5 w-full lg:w-auto">
          <select
            value={memberFilter}
            onChange={(e) => setMemberFilter(e.target.value)}
            aria-label="เลือกสมาชิก"
            className="col-span-1 min-h-[44px] w-full sm:w-auto rounded-xl border border-slate-300 bg-white px-3.5 text-sm sm:text-base font-bold text-slate-800 focus:border-purple-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 shadow-2xs"
          >
            <option value="all">ทุกคนในบ้าน</option>
            {settings.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>

          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value as FilterCategory)}
            aria-label="เลือกหมวดหมู่"
            className="col-span-1 min-h-[44px] w-full sm:w-auto rounded-xl border border-slate-300 bg-white px-3.5 text-sm sm:text-base font-bold text-slate-800 focus:border-purple-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 shadow-2xs"
          >
            <option value="all">ทุกหมวดหมู่</option>
            <option value="medication">ยาและการดูแล</option>
            <option value="appointment">นัดหมายแพทย์</option>
            <option value="family">ครอบครัว</option>
            <option value="system">ระบบ</option>
          </select>

          <div className="col-span-2 relative w-full sm:w-60">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              aria-label="ค้นหาการแจ้งเตือน"
              autoComplete="off"
              placeholder="ค้นหา…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white pl-10 pr-9 text-sm sm:text-base text-slate-900 placeholder:text-slate-500 focus:border-purple-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="ล้างคำค้นหา"
                className="absolute right-0 inset-y-0 my-auto inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:text-slate-800 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-600"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. รายการบัตรแจ้งเตือน (Card ขนาดใหญ่ เต็มตา อ่านง่าย สบายใจ) */}
      <div className="space-y-3.5">
        {filtered.length === 0 ? (
          <Card className="py-16 text-center shadow-xs">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" aria-hidden="true" />
            <p className="mt-3 text-lg sm:text-xl font-bold text-slate-900">ไม่มีรายการที่ต้องติดตาม</p>
            <p className="mt-1 text-sm sm:text-base text-slate-500">
              {statusFilter === 'pending'
                ? 'เรียบร้อยทั้งหมด ทุกคนในบ้านทำตามแผนเรียบร้อยดี'
                : 'ไม่มีข้อมูลตรงกับตัวกรองที่เลือก'}
            </p>
          </Card>
        ) : (
          filtered.map((item) => {
            const CatIcon = CATEGORY_ICONS[item.category];
            const pStyle = PRIORITY_STYLES[item.priority];
            const isResolved = item.actionStatus === 'resolved';
            const { title, body, actionLabel } = simplifyNotification(item);

            return (
              <div
                key={item.id}
                onClick={() => handleOpenDetail(item)}
                className={cn(
                  'group relative rounded-2xl border-2 p-5 sm:p-6 transition cursor-pointer bg-white',
                  'hover:shadow-md hover:border-purple-400',
                  pStyle.border,
                  !item.isRead && 'bg-purple-50/25 ring-2 ring-purple-100',
                  isResolved && 'opacity-75 bg-slate-50/60'
                )}
              >
                {/* จุดบ่งชี้ยังไม่อ่าน ขนาดใหญ่ชัดเจน */}
                {!item.isRead && (
                  <span
                    title="ยังไม่ได้อ่าน"
                    className="absolute top-5 right-5 h-3 w-3 rounded-full bg-purple-600 ring-4 ring-purple-100"
                  />
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* ซ้าย: ไอคอนใหญ่ + ข้อความใหญ่ชัดเจน */}
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    <div
                      className={cn(
                        'h-12 w-12 sm:h-14 sm:w-14 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 shadow-xs',
                        item.category === 'medication'
                          ? 'bg-purple-100 text-purple-700'
                          : item.category === 'appointment'
                          ? 'bg-blue-100 text-blue-700'
                          : item.category === 'family'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-700'
                      )}
                    >
                      <CatIcon className="w-6 h-6 sm:w-7 sm:h-7" />
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      {/* บรรทัดหัวเรื่องย่อย: ด่วน • ชื่อสมาชิก • เวลา */}
                      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500 pr-6">
                        {item.priority === 'urgent' && (
                          <span className="px-2.5 py-0.5 rounded-md font-black text-xs bg-rose-100 text-rose-700">
                            ด่วน
                          </span>
                        )}
                        {item.memberName && (
                          <span className="font-bold text-slate-900 text-sm sm:text-base">
                            {item.memberName}
                          </span>
                        )}
                        <span>•</span>
                        <span className="text-sm text-slate-400">
                          {relativeDateTime(item.createdAt)}
                        </span>
                        {item.escalatedAt && (
                          <>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1 text-rose-600 font-bold text-sm">
                              <ShieldAlert className="w-4 h-4" />
                              <span>ส่งต่อแล้ว</span>
                            </span>
                          </>
                        )}
                      </div>

                      {/* หัวข้อขนาดใหญ่ อ่านง่าย ชัดเจน */}
                      <h2 className="text-base sm:text-lg lg:text-xl font-black text-slate-900 group-hover:text-purple-900 transition-colors leading-snug">
                        {title}
                      </h2>

                      {/* คำอธิบายชัดเจน */}
                      {body && (
                        <p className="text-sm sm:text-base text-slate-600 line-clamp-2 leading-relaxed">
                          {body}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* ขวา: ปุ่มขนาดใหญ่ กดง่าย เต็มมือ ปรับพอดีทั้งจอมือถือและจอคอม */}
                  <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    {isResolved ? (
                      <span className="inline-flex items-center gap-1.5 min-h-[46px] px-4 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-sm sm:text-base font-bold">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span>เรียบร้อย</span>
                      </span>
                    ) : (
                      <>
                        {item.link ? (
                          <Link
                            to={item.link}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!item.isRead) markAsRead(item.id);
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 min-h-[46px] rounded-xl bg-purple-700 px-5 sm:px-6 text-sm sm:text-base font-bold text-white hover:bg-purple-800 transition-colors shadow-sm"
                          >
                            <span>{actionLabel || 'ไปที่รายการ'}</span>
                            <ChevronRight className="w-4.5 h-4.5" />
                          </Link>
                        ) : null}

                        <button
                          type="button"
                          onClick={(e) => handleResolve(item.id, e)}
                          onPointerDown={(e) => e.stopPropagation()}
                          title="ทำเครื่องหมายว่าเรียบร้อย"
                          className="inline-flex items-center gap-1.5 min-h-[46px] rounded-xl border border-slate-300 bg-white px-4 text-sm sm:text-base font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
                        >
                          <Check className="w-4.5 h-4.5 text-emerald-600" />
                          <span className="hidden sm:inline">เสร็จแล้ว</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 4. Modal รายละเอียด (ถ้าต้องการดูประวัติผู้รับหรือข้อมูลลึก) */}
      {selectedNotif && (
        <Modal
          open
          onClose={() => setSelectedNotif(null)}
          title="รายละเอียดเหตุการณ์"
          footer={
            <div className="flex items-center justify-between gap-3 w-full">
              <Button
                variant="neutral"
                size="md"
                onClick={() => {
                  deleteNotification(selectedNotif.id);
                  setSelectedNotif(null);
                  toast.show('ลบการแจ้งเตือนแล้ว');
                }}
              >
                <Trash2 className="w-4 h-4 text-rose-600 mr-1" />
                <span>ลบ</span>
              </Button>

              <div className="flex items-center gap-2.5">
                {selectedNotif.actionStatus === 'pending' && (
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => handleResolve(selectedNotif.id)}
                  >
                    <Check className="w-4 h-4 mr-1" />
                    <span>เรียบร้อยแล้ว</span>
                  </Button>
                )}
                {selectedNotif.link && (
                  <Link
                    to={selectedNotif.link}
                    onClick={() => setSelectedNotif(null)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-purple-700 px-5 py-2.5 text-sm sm:text-base font-bold text-white hover:bg-purple-800"
                  >
                    <span>{selectedNotif.actionLabel || 'ไปที่รายการ'}</span>
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                )}
              </div>
            </div>
          }
        >
          <div className="py-2 space-y-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                {selectedNotif.priority === 'urgent' && (
                  <span className="px-2 py-0.5 rounded font-black bg-rose-100 text-rose-700 text-xs">
                    ด่วน
                  </span>
                )}
                <span className="font-bold text-slate-800">
                  {CATEGORY_LABELS[selectedNotif.category]}
                </span>
                <span>•</span>
                <span>{shortDateTime(selectedNotif.createdAt)}</span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 break-words">
                {selectedNotif.title}
              </h2>
            </div>

            <p className="text-base text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200 break-words leading-relaxed">
              {selectedNotif.body}
            </p>

            {selectedNotif.detail && (
              <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-3.5 space-y-1">
                <p className="text-sm font-bold text-purple-900">ข้อมูลเพิ่มเติม</p>
                <p className="text-sm text-slate-700 break-words">{selectedNotif.detail}</p>
              </div>
            )}

            {/* ประวัติผู้รับการแจ้งเตือน */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-700" />
                <span>ประวัติผู้รับการแจ้งเตือน</span>
              </h3>

              {selectedNotif.recipients.length === 0 ? (
                <p className="text-sm text-slate-400">แจ้งเตือนทุกคนในบ้าน</p>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50/50">
                  {selectedNotif.recipients.map((rec) => (
                    <li key={rec.memberId} className="p-3 flex items-center justify-between text-sm">
                      <div>
                        <span className="font-bold text-slate-800">{rec.memberName}</span>
                        <span className="text-slate-400 ml-1.5">
                          ({rec.role === 'caregiver' ? 'ผู้ดูแล' : rec.role === 'patient' ? 'ผู้ป่วย' : 'สมาชิก'})
                        </span>
                      </div>
                      <div className="text-right">
                        {rec.readAt ? (
                          <span className="text-emerald-700 font-bold">
                            อ่านแล้ว {shortDateTime(rec.readAt)}
                          </span>
                        ) : (
                          <span className="text-slate-400">ยังไม่อ่าน</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
