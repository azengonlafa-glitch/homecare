import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertCircle,
  Calendar,
  ChevronLeft,
  Clock,
  HeartPulse,
  Lock,
  PencilLine,
  Pill,
  Send,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { Modal } from '../components/ui/Modal';
import { TextField } from '../components/ui/TextField';
import { useToast } from '../components/ui/Toast';
import { cn } from '../lib/cn';
import {
  CURRENT_MEMBER_ID,
  ROLE_META,
  SETTINGS_CHANGED_EVENT,
  loadSettings,
  type HouseholdMember,
} from '../lib/settings';
import {
  GENDER_LABEL,
  MEMBERS_CHANGED_EVENT,
  loadMemberRecord,
  saveMemberRecord,
  memberMeds,
  type MemberMed,
  type MemberRecord,
} from '../lib/members';
import {
  ACCESS_CHANGED_EVENT,
  canEditMember,
  canViewMember,
  requestAccess,
  requestsFor,
  useAccessRequests,
} from '../lib/access';
import {
  FORM_OPTIONS,
  PERIOD_LABEL,
  formatMedForm,
  formatQty,
  instructionText,
  todayKey,
  type DosePeriod,
  type Medication,
} from '../lib/meds';
import { REQUEST_MESSAGE_SUGGESTIONS } from '../data/suggestions';
import { MedFormModal, type MedFormData } from '../components/meds/MedFormModal';
import { getMemberTodayMood } from '../lib/memberMood';

const DEFAULT_TIME: Record<DosePeriod, string> = {
  morning: '08:00',
  noon: '12:00',
  evening: '18:00',
  bedtime: '21:00',
};

const newMedId = () => `med-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

/** แปลงรายการยาของสมาชิกเป็นข้อมูลที่ฟอร์มยาใช้ (ถ้าไม่มีข้อมูลละเอียดจะเดาจากสรุปที่มี) */
function medFromMember(m: MemberMed): Medication {
  const base = {
    id: m.id,
    stoppedAt: null,
    refillRequestedAt: null,
    createdAt: '',
  };
  if (m.detail) return { ...base, ...m.detail };
  const match = /^([\d.]+)\s*(.*)$/.exec(m.dose.trim());
  const form = FORM_OPTIONS.find((f) => f.label === m.form);
  return {
    ...base,
    name: m.name,
    form: form?.value ?? 'tablet',
    perDose: match ? parseFloat(match[1]) || 1 : 1,
    unit: match?.[2] || form?.unit || 'เม็ด',
    meal: 'after',
    periods: m.periods,
    times: m.times,
    weekdays: [],
    startDate: todayKey(),
    durationDays: null,
    active: true,
    remaining: 0,
    lowStockDays: 3,
    lastRefillDate: '',
    refillsRemaining: null,
    condition: m.condition ?? '',
    reason: '',
    drugRef: '',
    pillPhoto: null,
    labelPhoto: null,
    note: '',
  };
}

/** แปลงข้อมูลจากฟอร์มยากลับเป็นรายการของสมาชิก พร้อมสรุปสั้นสำหรับแสดงในหน้ารายละเอียด */
function memberMedFromForm(id: string, data: MedFormData): MemberMed {
  return {
    id,
    name: data.name,
    dose: `${formatQty(data.perDose)} ${data.unit}`,
    periods: data.periods,
    times: data.times,
    form: formatMedForm(data),
    condition: data.condition,
    instruction: instructionText(data),
    detail: data,
  };
}

const SectionTitle: React.FC<{ icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }> = ({
  icon: Icon,
  children,
}) => (
  <h2 className="flex items-center gap-2 text-lg sm:text-xl font-bold text-slate-900">
    <Icon className="h-6 w-6 text-purple-700 shrink-0" aria-hidden="true" />
    <span>{children}</span>
  </h2>
);

const roleBadge = 'inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700';

// ---------- หน้าต่างขออนุญาต ----------

const RequestDialog: React.FC<{
  memberName: string;
  scope: 'view' | 'edit';
  onClose: () => void;
  onSubmit: (message: string) => void;
}> = ({ memberName, scope, onClose, onSubmit }) => {
  const [message, setMessage] = useState(
    scope === 'edit' ? `ขออนุญาตจัดตารางยาให้ ${memberName} นะคะ` : `ขออนุญาตดูข้อมูลสุขภาพของ ${memberName}`
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={scope === 'edit' ? 'ขออนุญาตแก้ไขข้อมูล' : 'ขออนุญาตดูข้อมูล'}
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button variant="neutral" fullWidth onClick={onClose}>
            ยกเลิก
          </Button>
          <Button fullWidth onClick={() => onSubmit(message.trim())}>
            ส่งคำขอ
          </Button>
        </div>
      }
    >
      <div className="py-4 space-y-4">
        <p className="text-base text-slate-700">
          ส่งข้อความบอก {memberName} ว่าทำไมคุณต้องการ
          {scope === 'edit' ? 'แก้ไขและจัดตารางยา' : 'ดูข้อมูล'}
        </p>
        <TextField
          id="request-message"
          suggestions={REQUEST_MESSAGE_SUGGESTIONS}
          label="ข้อความบอกเหตุผล"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="เช่น ช่วยจัดตารางมื้อเช้าให้ จะได้ไม่ลืม"
        />
      </div>
    </Modal>
  );
};

// ---------- ตัวแก้ไขตารางยาและการดูแล ----------

const ScheduleDialog: React.FC<{
  record: MemberRecord;
  memberName: string;
  onClose: () => void;
  onSave: (meds: MemberMed[], note: string) => void;
}> = ({ record, memberName, onClose, onSave }) => {
  const [meds, setMeds] = useState<MemberMed[]>(record.meds);
  const [note, setNote] = useState(record.health.note);
  /** 'new' = เพิ่มรายการใหม่, MemberMed = แก้รายการนั้น, null = อยู่หน้ารายการ */
  const [editing, setEditing] = useState<MemberMed | 'new' | null>(null);

  // เปิดฟอร์มยาเดียวกับหน้า "ยาและการดูแล" (แทนที่หน้ารายการชั่วคราว)
  if (editing) {
    const current = editing === 'new' ? null : editing;
    return (
      <MedFormModal
        open
        initial={current ? medFromMember(current) : null}
        defaultLowStockDays={3}
        conditionSuggestions={record.health.conditions}
        onClose={() => setEditing(null)}
        onSave={(data) => {
          const saved = memberMedFromForm(current?.id ?? newMedId(), data);
          setMeds((prev) => (current ? prev.map((m) => (m.id === saved.id ? saved : m)) : [...prev, saved]));
          setEditing(null);
        }}
      />
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`แก้ไขตารางยาและการดูแลของ ${memberName}`}
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button variant="neutral" fullWidth onClick={onClose}>
            ยกเลิก
          </Button>
          <Button fullWidth onClick={() => onSave(meds.filter((m) => m.name.trim()), note)}>
            บันทึก
          </Button>
        </div>
      }
    >
      <div className="py-5 space-y-4">
        {meds.length === 0 && <p className="text-base text-slate-600">ยังไม่มีรายการยาในตาราง เพิ่มรายการแรกได้เลย</p>}

        {meds.map((med) => (
          <div key={med.id} className="flex items-start gap-2 rounded-2xl border border-slate-200 p-4 bg-slate-50/50">
            <div className="min-w-0 flex-1">
              <p className="text-base sm:text-lg font-bold text-slate-900 break-words">{med.name}</p>
              <p className="text-sm font-medium text-slate-600">
                ครั้งละ {med.dose}
                {med.instruction ? ` · ${med.instruction}` : ''}
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {med.periods.map((p) => (
                  <li
                    key={p}
                    className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-sm font-bold text-purple-900"
                  >
                    <Clock className="w-3.5 h-3.5 text-purple-600 shrink-0" aria-hidden="true" />
                    <span>
                      {PERIOD_LABEL[p]} · {med.times[p] ?? DEFAULT_TIME[p]} น.
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              aria-label={`แก้ไข ${med.name || 'รายการยา'}`}
              onClick={() => setEditing(med)}
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 cursor-pointer transition-colors"
            >
              <PencilLine className="w-5 h-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={`ลบ ${med.name || 'รายการยา'}`}
              onClick={() => setMeds((prev) => prev.filter((m) => m.id !== med.id))}
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 cursor-pointer transition-colors"
            >
              <Trash2 className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        ))}

        <Button variant="soft" fullWidth onClick={() => setEditing('new')}>
          + เพิ่มรายการยา / การดูแล
        </Button>

        <TextField
          id="member-note"
          label="บันทึกเพิ่มเติมด้านสุขภาพ"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
    </Modal>
  );
};

// ---------- หน้าหลัก ----------

/** รายละเอียดสมาชิก: จัดเลย์เอาต์กระชับพอดีกับจอ พร้อมปรับความสูง 2 คอลัมน์ให้สมดุล */
export const MemberDetailPage: React.FC = () => {
  const { id = '' } = useParams();
  const toast = useToast();
  const requests = useAccessRequests();
  const [settings, setSettings] = useState(loadSettings);
  const [record, setRecord] = useState<MemberRecord>(() => loadMemberRecord(id));
  const [dialog, setDialog] = useState<'view' | 'edit' | 'schedule' | null>(null);

  useEffect(() => {
    const refresh = () => {
      setSettings(loadSettings());
      setRecord(loadMemberRecord(id));
    };
    window.addEventListener(MEMBERS_CHANGED_EVENT, refresh);
    window.addEventListener(SETTINGS_CHANGED_EVENT, refresh);
    window.addEventListener(ACCESS_CHANGED_EVENT, refresh);
    refresh();
    return () => {
      window.removeEventListener(MEMBERS_CHANGED_EVENT, refresh);
      window.removeEventListener(SETTINGS_CHANGED_EVENT, refresh);
      window.removeEventListener(ACCESS_CHANGED_EVENT, refresh);
    };
  }, [id]);

  const member: HouseholdMember | undefined = settings.members.find((m) => m.id === id);

  if (!member) {
    return (
      <div className="space-y-4">
        <Link to="/members" className="inline-flex items-center gap-1 text-lg font-semibold text-purple-800">
          <ChevronLeft className="w-6 h-6" aria-hidden="true" /> สมาชิกในบ้าน
        </Link>
        <Card>
          <p className="text-lg font-bold text-slate-900">ไม่พบสมาชิกคนนี้ในบ้าน</p>
          <p className="mt-1 text-base text-slate-600">อาจถูกนำออกจากบ้านไปแล้ว</p>
        </Card>
      </div>
    );
  }

  const isMe = member.id === CURRENT_MEMBER_ID;
  const photo = isMe ? settings.profile.photo : record.photo;
  const viewable = canViewMember(record, CURRENT_MEMBER_ID, requests);
  const editable = canEditMember(record, CURRENT_MEMBER_ID, requests);

  const editHistory = requestsFor(member.id, CURRENT_MEMBER_ID, requests)
    .filter((r) => r.scope === 'edit')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const latestEditRequest = editHistory[0];
  const viewRequest = requestsFor(member.id, CURRENT_MEMBER_ID, requests)
    .filter((r) => r.scope === 'view')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  const meds: MemberMed[] = memberMeds(record).slice().sort((a: MemberMed, b: MemberMed) => {
    const time = (m: MemberMed) => m.times[m.periods[0]] ?? '99:99';
    return time(a).localeCompare(time(b));
  });

  const sendRequest = (scope: 'view' | 'edit', message: string) => {
    requestAccess(member.id, scope, message);
    setDialog(null);
    toast.show(`ส่งคำขอไปหา ${member.name} แล้ว รอการอนุมัติ`);
  };

  const saveSchedule = (nextMeds: MemberMed[], note: string) => {
    const updated: MemberRecord = {
      ...record,
      meds: nextMeds,
      health: { ...record.health, note },
    };
    saveMemberRecord(updated);
    setRecord(updated);
    setDialog(null);
    toast.show('บันทึกตารางยาและการดูแลแล้ว');
  };

  const todayMood = getMemberTodayMood(member.id, member.name, record);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      {/* ส่วนหัว: บัตรประจำตัวสมาชิก + สถานะและปุ่มขอสิทธิ์ (รวมในแถวเดียว กระชับ พอดีจอ) */}
      <Card className="p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <Link
              to="/members"
              title="กลับไปหน้ารายชื่อสมาชิก"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors"
            >
              <ChevronLeft className="w-6 h-6" aria-hidden="true" />
            </Link>
            <Avatar src={photo} name={member.name} className="h-14 w-14 sm:h-16 sm:w-16 text-2xl shadow-xs shrink-0" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight break-words">
                  {member.name}
                </h1>
                <span className={roleBadge}>
                  <span aria-hidden="true" className={cn('h-2 w-2 rounded-full', ROLE_META[member.role].dot)} />
                  {ROLE_META[member.role].label}
                </span>
                {todayMood && (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-bold',
                      todayMood.toneBadge
                    )}
                  >
                    <todayMood.Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>
                      อารมณ์วันนี้: {todayMood.label}
                      {todayMood.detail ? ` (${todayMood.detail})` : ''}
                    </span>
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm sm:text-base text-slate-600">
                {isMe ? 'ฉัน' : member.relation} · {record.age ? `${record.age} ปี` : 'ไม่ระบุอายุ'} ·{' '}
                {record.gender ? GENDER_LABEL[record.gender] : 'ไม่ระบุเพศ'}
              </p>
            </div>
          </div>

          {/* สิทธิ์เข้าถึงและปุ่มการกระทำ */}
          {!isMe && (
            <div className="flex flex-wrap items-center gap-2 shrink-0 md:border-l md:border-slate-200 md:pl-5">
              {editable ? (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 text-sm font-bold border border-emerald-200">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>แก้ไขได้{latestEditRequest?.decision === 'once' ? ' (ครั้งนี้)' : ''}</span>
                  </span>
                  <Button size="sm" onClick={() => setDialog('schedule')}>
                    <PencilLine className="w-4 h-4" aria-hidden="true" />
                    <span>แก้ไขตาราง</span>
                  </Button>
                </div>
              ) : latestEditRequest?.decision === 'pending' ? (
                /* ผู้ขอทำได้แค่รอ เจ้าของข้อมูลเป็นคนตอบเองผ่านกระดิ่งแจ้งเตือน */
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 text-sm font-bold border border-amber-200">
                  <Clock className="w-4 h-4" aria-hidden="true" />
                  <span>ส่งคำขอแล้ว · รอ {member.name} ตอบ</span>
                </span>
              ) : (
                <Button size="sm" onClick={() => setDialog('edit')}>
                  <Send className="w-4 h-4" aria-hidden="true" />
                  <span>ขออนุญาตแก้ไขข้อมูล</span>
                </Button>
              )}
            </div>
          )}

          {isMe && (
            <Link
              to="/meds"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 px-4 text-sm font-bold text-purple-900 transition-colors"
            >
              <Pill className="w-4 h-4" />
              <span>ไปที่ยาและการดูแล</span>
            </Link>
          )}
        </div>
      </Card>

      {/* ข้อมูลถูกซ่อน */}
      {!viewable ? (
        <Card className="text-center py-12 shadow-xs">
          <Lock className="mx-auto h-12 w-12 text-amber-700" aria-hidden="true" />
          <p className="mt-3 text-lg font-bold text-slate-900">ข้อมูลนี้ถูกซ่อนไว้</p>
          <p className="mt-1 text-base text-slate-600">
            {member.name} ตั้งค่าไม่ให้คนในบ้านดูข้อมูลสุขภาพและตารางยา
          </p>
          {viewRequest?.decision === 'pending' ? (
            <p className="mt-4 text-base font-bold text-amber-800">ส่งคำขอไปแล้ว · รอการอนุมัติ</p>
          ) : (
            <Button className="mt-4" onClick={() => setDialog('view')}>
              ขออนุญาตดูข้อมูล
            </Button>
          )}
        </Card>
      ) : (
        /* สองคอลัมน์ปรับสมดุลความสูงให้พอดีกับจอ */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* คอลัมน์ซ้าย: ยาและการดูแล + ประวัติการรักษา */}
          <div className="lg:col-span-6 space-y-5">
            {/* ยาและการดูแล */}
            <Card className="shadow-xs">
              <div className="flex items-center justify-between gap-3 mb-3.5">
                <SectionTitle icon={Pill}>ยาและการดูแล</SectionTitle>
                {editable && (
                  <Button size="sm" variant="soft" onClick={() => setDialog('schedule')}>
                    <PencilLine className="w-4 h-4" aria-hidden="true" />
                    <span>จัดการ</span>
                  </Button>
                )}
              </div>

              {meds.length === 0 ? (
                <div className="py-7 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <p className="text-base text-slate-600">ยังไม่มีรายการยาหรือการดูแลที่บันทึกไว้</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {meds.map((med: MemberMed) => (
                    <li key={med.id} className="py-3.5 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="text-base sm:text-lg font-bold text-slate-900 break-words">{med.name}</p>
                        {med.form && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                            {med.form}
                          </span>
                        )}
                        {med.condition && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-600">
                            {med.condition}
                          </span>
                        )}
                      </div>

                      <p className="text-sm font-medium text-slate-600">
                        ครั้งละ {med.dose}
                        {med.instruction ? ` · ${med.instruction}` : ''}
                      </p>

                      <ul className="mt-2 flex flex-wrap gap-2">
                        {med.periods.map((p: DosePeriod) => (
                          <li
                            key={p}
                            className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-sm font-bold text-purple-900"
                          >
                            <Clock className="w-3.5 h-3.5 text-purple-600 shrink-0" aria-hidden="true" />
                            <span>{PERIOD_LABEL[p]} · {med.times[p] ?? DEFAULT_TIME[p]} น.</span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* ประวัติการรักษาและการพบแพทย์ (จัดไว้คอลัมน์ซ้ายเพื่อเกลี่ยความสูงให้พอดีกับจอ) */}
            <Card className="shadow-xs">
              <SectionTitle icon={Calendar}>ประวัติการรักษา / พบแพทย์</SectionTitle>

              {record.health.history.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500 py-4 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  ยังไม่มีประวัติการรักษาที่บันทึกไว้
                </p>
              ) : (
                <ul className="mt-3.5 space-y-2.5">
                  {record.health.history.map((h) => (
                    <li key={h.id} className="rounded-xl border border-slate-200 p-3.5 bg-slate-50/50">
                      <p className="text-xs font-semibold text-slate-500">
                        {new Date(h.at).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                      <p className="text-base font-bold text-slate-900 break-words mt-0.5">{h.label}</p>
                      <p className="text-sm text-slate-600 break-words mt-0.5">{h.detail}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {/* คอลัมน์ขวา: ประวัติสุขภาพ (สัญญาณชีพ, โรคประจำตัว, แพ้ยา, บันทึก) */}
          <div className="lg:col-span-6 space-y-5">
            <Card className="shadow-xs">
              <SectionTitle icon={HeartPulse}>ประวัติสุขภาพ</SectionTitle>

              {/* Vitals */}
              <div className="grid gap-3 sm:grid-cols-2 mt-3.5">
                <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-purple-50/30 p-4 border border-slate-100">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">ความดันล่าสุด</p>
                  <p className="mt-1 text-2xl font-extrabold text-slate-900 tabular-nums">
                    {record.health.bloodPressure || 'ไม่มีข้อมูล'}
                  </p>
                  {record.health.bloodPressure && (
                    <span className="mt-1.5 inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800">
                      ปกติ
                    </span>
                  )}
                </div>
                <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-purple-50/30 p-4 border border-slate-100">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">น้ำตาลในเลือดล่าสุด</p>
                  <p className="mt-1 text-2xl font-extrabold text-slate-900 tabular-nums">
                    {record.health.bloodSugar ? `${record.health.bloodSugar} มก./ดล.` : 'ไม่มีข้อมูล'}
                  </p>
                  {record.health.bloodSugar && (
                    <span className="mt-1.5 inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800">
                      ปกติ
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 space-y-4 pt-4 border-t border-slate-100">
                <div>
                  <p className="text-sm font-bold text-slate-700">โรคประจำตัว</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {record.health.conditions.length === 0 ? (
                      <span className="text-sm text-slate-500">ไม่มีข้อมูล</span>
                    ) : (
                      record.health.conditions.map((c) => (
                        <span key={c} className="rounded-full bg-red-50 border border-red-200 px-3 py-1 text-sm font-bold text-red-800">
                          {c}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-bold text-slate-700">การแพ้ยา / แพ้อาหาร</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {record.health.allergies.length === 0 ? (
                      <span className="text-sm text-slate-500">ไม่มีข้อมูลการแพ้</span>
                    ) : (
                      record.health.allergies.map((a) => (
                        <span key={a} className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-sm font-bold text-amber-900">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" aria-hidden="true" />
                          <span>{a}</span>
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {record.health.note && (
                  <div>
                    <p className="text-sm font-bold text-slate-700">บันทึกเพิ่มเติม</p>
                    <p className="mt-1.5 text-base text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-200 break-words">
                      {record.health.note}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* หมายเหตุด้านล่างแบบข้อความกระชับ ไม่กินเนื้อที่จอ */}
      {!isMe && (
        <p className="text-xs sm:text-sm text-center text-slate-500 pt-2 pb-4">
          ข้อมูลนี้เป็นของ {member.name} · ตั้งค่าสิทธิ์เข้าถึงข้อมูลของคุณได้ที่{' '}
          <Link to="/settings/privacy" className="text-purple-700 underline font-semibold hover:text-purple-900">
            ตั้งค่า › ความเป็นส่วนตัว
          </Link>
        </p>
      )}

      {dialog === 'view' && (
        <RequestDialog
          memberName={member.name}
          scope="view"
          onClose={() => setDialog(null)}
          onSubmit={(msg) => sendRequest('view', msg)}
        />
      )}

      {dialog === 'edit' && (
        <RequestDialog
          memberName={member.name}
          scope="edit"
          onClose={() => setDialog(null)}
          onSubmit={(msg) => sendRequest('edit', msg)}
        />
      )}

      {dialog === 'schedule' && (
        <ScheduleDialog
          record={record}
          memberName={member.name}
          onClose={() => setDialog(null)}
          onSave={saveSchedule}
        />
      )}
    </div>
  );
};
