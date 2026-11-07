import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BookHeart,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Droplet,
  HeartPulse,
  History,
  Info,
  Lock,
  PencilLine,
  Pill,
  Plus,
  Scale,
  Send,
  ShieldCheck,
  Slash,
  Sparkles,
  Stethoscope,
  Trash2,
  UserCheck,
  X,
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
  type GlucoseTiming,
  type MemberMed,
  type MemberRecord,
  type VitalReading,
} from '../lib/members';
import {
  ACCESS_CHANGED_EVENT,
  canEditMember,
  canViewMember,
  consumeOnce,
  requestAccess,
  requestsFor,
  useAccessRequests,
} from '../lib/access';
import {
  MEDS_CHANGED_EVENT,
  PERIOD_LABEL,
  applyDoseStatus,
  findLog,
  formatMedForm,
  formatQty,
  instructionText,
  loadMeds,
  saveMeds,
  thaiDate,
  todayKey,
  type DoseLog,
  type DosePeriod,
  type DoseStatus,
  type Medication,
} from '../lib/meds';
import { JOURNAL_CHANGED_EVENT, loadPosts, type JournalPost } from '../lib/journal';
import { MOOD_TONE, moodMeta } from '../data/journalOptions';
import { CALENDAR_CHANGED_EVENT, loadEvents, parseKey, type CalendarEvent } from '../lib/calendar';
import { ONBOARDING_CHANGED_EVENT, loadOnboarding, saveOnboarding } from '../lib/onboarding';
import { REQUEST_MESSAGE_SUGGESTIONS } from '../data/suggestions';
import { MONTHS } from '../data/onboardingOptions';
import { TONE_SOFT } from '../components/health/HealthCharts';
import { MedFormModal, type MedFormData } from '../components/meds/MedFormModal';
import { MedDetailModal } from '../components/meds/MedDetailModal';
import { MedPhoto } from '../components/meds/MedPhoto';
import { StockBadge } from '../components/meds/StockBadge';
import { getMemberTodayMood } from '../lib/memberMood';
import {
  GLUCOSE_TIMING_LABEL,
  RANGE_LABEL,
  appointmentsBetween,
  bodyInfo,
  buildFollowUps,
  caregiverOf,
  classifyBp,
  classifyGlucose,
  daysUntilKey,
  doseSummary,
  hasDiabetes,
  inRange,
  keyOfIso,
  latestVitals,
  medFromMember,
  overallOf,
  postsAboutMember,
  rangeDoseReport,
  rangeFor,
  sortedReadings,
  todayDoses,
  upcomingAppointments,
  type FollowItem,
  type FollowTarget,
  type OverallStatus,
  type RangePreset,
} from '../lib/memberDashboard';
import {
  ClassifiedChip,
  DoseStateChip,
  EmptyNote,
  SectionTitle,
  relativeDateTime,
  shortDateTime,
} from '../components/member/memberUi';

const DEFAULT_TIME: Record<DosePeriod, string> = {
  morning: '08:00',
  noon: '12:00',
  evening: '18:00',
  bedtime: '21:00',
};

const newMedId = () => `med-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

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

const roleBadge = 'inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700';

type DashboardTab = 'overview' | 'meds' | 'history';
type HistoryFilter = 'all' | 'symptoms' | 'bp' | 'glucose' | 'weight' | 'meds' | 'appointments';

const OVERALL_META: Record<
  OverallStatus,
  {
    label: string;
    desc: string;
    box: string;
    badge: string;
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  normal: {
    label: 'ปกติ',
    desc: 'ไม่มีรายการที่ต้องติดตามเป็นพิเศษในตอนนี้',
    box: 'border-emerald-200 bg-gradient-to-r from-emerald-50/90 to-teal-50/60 text-emerald-950',
    badge: 'bg-emerald-600 text-white',
    Icon: CheckCircle2,
  },
  watch: {
    label: 'ต้องติดตาม',
    desc: 'มีรายการที่ยังไม่ได้ยืนยันหรือมีข้อมูลที่ควรตรวจสอบ',
    box: 'border-amber-300 bg-gradient-to-r from-amber-50/90 to-orange-50/60 text-amber-950',
    badge: 'bg-amber-600 text-white',
    Icon: AlertCircle,
  },
  urgent: {
    label: 'ควรตรวจสอบเร่งด่วน',
    desc: 'มีข้อมูลที่อาจต้องได้รับการประเมินจากผู้ดูแลหรือบุคลากรทางการแพทย์',
    box: 'border-rose-300 bg-gradient-to-r from-rose-50/95 to-red-50/70 text-rose-950',
    badge: 'bg-rose-600 text-white',
    Icon: AlertTriangle,
  },
};

// ---------- หน้าต่างขออนุญาต ----------

const RequestDialog: React.FC<{
  memberName: string;
  scope: 'view' | 'edit';
  onClose: () => void;
  onSubmit: (message: string) => void;
}> = ({ memberName, scope, onClose, onSubmit }) => {
  const [message, setMessage] = useState(
    scope === 'edit' ? `ขออนุญาตจัดตารางยาและช่วยบันทึกสุขภาพให้ ${memberName} นะคะ` : `ขออนุญาตดูข้อมูลสุขภาพของ ${memberName}`
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

// ---------- หน้าต่างบันทึกค่าสุขภาพ (Vital Signs) ----------

const VitalModal: React.FC<{
  memberName: string;
  onClose: () => void;
  onSave: (reading: VitalReading) => void;
}> = ({ memberName, onClose, onSave }) => {
  const [sys, setSys] = useState('');
  const [dia, setDia] = useState('');
  const [glucose, setGlucose] = useState('');
  const [timing, setTiming] = useState<GlucoseTiming>('fasting');
  const [weight, setWeight] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const handleSave = () => {
    const s = sys.trim() ? Number(sys) : undefined;
    const d = dia.trim() ? Number(dia) : undefined;
    const g = glucose.trim() ? Number(glucose) : undefined;
    const w = weight.trim() ? Number(weight) : undefined;

    if ((s !== undefined && d === undefined) || (s === undefined && d !== undefined)) {
      setError('กรุณากรอกความดันทั้งตัวบนและตัวล่างให้ครบ');
      return;
    }
    if (s === undefined && g === undefined && w === undefined) {
      setError('กรุณากรอกอย่างน้อย 1 รายการ (ความดัน, น้ำตาล หรือ น้ำหนัก)');
      return;
    }

    onSave({
      id: `vital-${Date.now()}`,
      at: new Date().toISOString(),
      systolic: s,
      diastolic: d,
      glucose: g,
      glucoseTiming: g !== undefined ? timing : undefined,
      weightKg: w,
      note: note.trim() || undefined,
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`บันทึกค่าสุขภาพของ ${memberName}`}
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button variant="neutral" fullWidth onClick={onClose}>
            ยกเลิก
          </Button>
          <Button fullWidth onClick={handleSave}>
            บันทึกค่าสุขภาพ
          </Button>
        </div>
      }
    >
      <div className="py-4 space-y-4">
        <p className="text-sm text-slate-600">
          กรอกเฉพาะค่าที่วัดได้ในครั้งนี้ ระบบจะบันทึกเวลาปัจจุบันและอัปเดตค่าล่าสุดให้อัตโนมัติ
        </p>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm font-bold text-rose-800">
            {error}
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-3">
          <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <HeartPulse className="w-4 h-4 text-purple-700" />
            <span>ความดันโลหิต (mmHg)</span>
          </p>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              id="vital-sys"
              type="number"
              label="ตัวบน (Systolic)"
              placeholder="เช่น 125"
              value={sys}
              onChange={(e) => {
                setSys(e.target.value);
                setError('');
              }}
            />
            <TextField
              id="vital-dia"
              type="number"
              label="ตัวล่าง (Diastolic)"
              placeholder="เช่น 80"
              value={dia}
              onChange={(e) => {
                setDia(e.target.value);
                setError('');
              }}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-3">
          <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Droplet className="w-4 h-4 text-purple-700" />
            <span>ระดับน้ำตาลในเลือด (มก./ดล.)</span>
          </p>
          <TextField
            id="vital-glucose"
            type="number"
            label="ค่าน้ำตาล"
            placeholder="เช่น 105"
            value={glucose}
            onChange={(e) => {
              setGlucose(e.target.value);
              setError('');
            }}
          />
          <div>
            <p className="text-xs font-bold text-slate-600 mb-1.5">ช่วงที่ตรวจ</p>
            <div className="flex flex-wrap gap-2">
              {(['fasting', 'after-meal', 'unknown'] as GlucoseTiming[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTiming(t)}
                  className={cn(
                    'rounded-xl border px-3 py-1.5 text-sm font-bold transition-colors cursor-pointer',
                    timing === t
                      ? 'border-purple-600 bg-purple-600 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-purple-50'
                  )}
                >
                  {GLUCOSE_TIMING_LABEL[t]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-3">
          <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Scale className="w-4 h-4 text-purple-700" />
            <span>น้ำหนักตัว (กิโลกรัม)</span>
          </p>
          <TextField
            id="vital-weight"
            type="number"
            step="0.1"
            label="น้ำหนัก (กก.)"
            placeholder="เช่น 58.5"
            value={weight}
            onChange={(e) => {
              setWeight(e.target.value);
              setError('');
            }}
          />
        </div>

        <TextField
          id="vital-note"
          label="หมายเหตุเพิ่มเติม (ถ้ามี)"
          placeholder="เช่น วัดหลังตื่นนอน หรือหลังเดินออกกำลังกาย"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
    </Modal>
  );
};

// ---------- หน้าต่างแก้ไขข้อมูลพื้นฐานและผู้ดูแลหลัก ----------

const BasicProfileModal: React.FC<{
  record: MemberRecord;
  member: HouseholdMember;
  members: HouseholdMember[];
  isMe: boolean;
  onClose: () => void;
  onSave: (patch: Partial<MemberRecord>, ownPatch?: { birthDay: string; birthMonth: string; birthYear: string; heightCm: string; weightKg: string }) => void;
}> = ({ record, member, members, isMe, onClose, onSave }) => {
  const own = isMe ? loadOnboarding().profile : null;
  const initBirth = record.birthDate;

  const [birthDay, setBirthDay] = useState(
    own?.birthDay || (initBirth?.day ? String(initBirth.day) : '')
  );
  const [birthMonth, setBirthMonth] = useState(
    own?.birthMonth || (initBirth?.month ? String(initBirth.month) : '')
  );
  const [birthYear, setBirthYear] = useState(
    own?.birthYear || (initBirth?.yearBE ? String(initBirth.yearBE) : record.age ? String(new Date().getFullYear() + 543 - record.age) : '')
  );
  const [heightCm, setHeightCm] = useState(
    own?.heightCm || (record.heightCm != null ? String(record.heightCm) : '')
  );
  const [weightKg, setWeightKg] = useState(
    own?.weightKg || (record.weightKg != null ? String(record.weightKg) : '')
  );
  const [caregiverId, setCaregiverId] = useState(record.caregiverId ?? '');
  const [conditionsText, setConditionsText] = useState(record.health.conditions.join(', '));
  const [allergiesText, setAllergiesText] = useState(record.health.allergies.join(', '));
  const [note, setNote] = useState(record.health.note);

  const handleSave = () => {
    const y = Number(birthYear);
    const m = Number(birthMonth);
    const d = Number(birthDay);
    const birthDate =
      Number.isFinite(y) && y >= 2400 && y <= 2600
        ? {
            yearBE: y,
            month: m >= 1 && m <= 12 ? m : null,
            day: d >= 1 && d <= 31 ? d : null,
          }
        : record.birthDate;

    const h = parseFloat(heightCm);
    const w = parseFloat(weightKg);
    const conditions = conditionsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const allergies = allergiesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const patch: Partial<MemberRecord> = {
      birthDate,
      heightCm: Number.isFinite(h) && h > 0 ? h : record.heightCm,
      weightKg: Number.isFinite(w) && w > 0 ? w : record.weightKg,
      caregiverId: caregiverId || undefined,
      health: {
        ...record.health,
        conditions,
        allergies,
        note: note.trim(),
      },
    };

    onSave(
      patch,
      isMe
        ? {
            birthDay: birthDay.trim(),
            birthMonth: birthMonth.trim(),
            birthYear: birthYear.trim(),
            heightCm: heightCm.trim(),
            weightKg: weightKg.trim(),
          }
        : undefined
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`ข้อมูลพื้นฐานของ ${member.name}`}
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button variant="neutral" fullWidth onClick={onClose}>
            ยกเลิก
          </Button>
          <Button fullWidth onClick={handleSave}>
            บันทึกข้อมูล
          </Button>
        </div>
      }
    >
      <div className="py-4 space-y-4">
        <div>
          <p className="text-sm font-bold text-slate-800 mb-2">วันเกิด (พ.ศ.)</p>
          <div className="grid grid-cols-3 gap-2.5">
            <TextField
              id="basic-day"
              type="number"
              label="วัน (1-31)"
              placeholder="15"
              value={birthDay}
              onChange={(e) => setBirthDay(e.target.value)}
            />
            <div>
              <label htmlFor="basic-month" className="block text-sm font-bold text-slate-800 mb-1.5">
                เดือน
              </label>
              <select
                id="basic-month"
                value={birthMonth}
                onChange={(e) => setBirthMonth(e.target.value)}
                className="w-full min-h-[48px] rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 focus:border-purple-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-600"
              >
                <option value="">ไม่ระบุ</option>
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <TextField
              id="basic-year"
              type="number"
              label="พ.ศ. เกิด"
              placeholder="2503"
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <TextField
            id="basic-height"
            type="number"
            label="ส่วนสูง (ซม.)"
            placeholder="เช่น 160"
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
          />
          <TextField
            id="basic-weight"
            type="number"
            step="0.1"
            label="น้ำหนักล่าสุด (กก.)"
            placeholder="เช่น 58.5"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="basic-caregiver" className="block text-sm font-bold text-slate-800 mb-1.5">
            ผู้ดูแลหลักของสมาชิกคนนี้
          </label>
          <select
            id="basic-caregiver"
            value={caregiverId}
            onChange={(e) => setCaregiverId(e.target.value)}
            className="w-full min-h-[48px] rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 focus:border-purple-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-600"
          >
            <option value="">ใช้ค่าเริ่มต้นของผู้ดูแลบ้าน</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.relation})
              </option>
            ))}
          </select>
        </div>

        <TextField
          id="basic-conditions"
          label="โรคประจำตัว (คั่นด้วยเครื่องหมายจุลภาค ,)"
          placeholder="เช่น ความดันโลหิตสูง, เบาหวานชนิดที่ 2"
          value={conditionsText}
          onChange={(e) => setConditionsText(e.target.value)}
        />

        <TextField
          id="basic-allergies"
          label="ประวัติการแพ้ยา / แพ้อาหาร (คั่นด้วย ,)"
          placeholder="เช่น เพนิซิลลิน (ผื่นลมพิษ), กุ้ง"
          value={allergiesText}
          onChange={(e) => setAllergiesText(e.target.value)}
        />

        <TextField
          id="basic-note"
          label="บันทึกข้อควรระวังเพิ่มเติม"
          placeholder="เช่น วัดความดันทุกเช้าก่อนอาหาร"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
    </Modal>
  );
};

// ---------- ตัวแก้ไขตารางยาและการดูแล ----------

const ScheduleDialog: React.FC<{
  record: MemberRecord;
  memberName: string;
  logs: DoseLog[];
  onClose: () => void;
  onSave: (meds: MemberMed[], note: string) => void;
}> = ({ record, memberName, logs, onClose, onSave }) => {
  const [meds, setMeds] = useState<MemberMed[]>(record.meds);
  const [note, setNote] = useState(record.health.note);
  const [editing, setEditing] = useState<MemberMed | 'new' | null>(null);

  if (editing) {
    const current = editing === 'new' ? null : editing;
    return (
      <MedFormModal
        open
        initial={current ? medFromMember(current, logs) : null}
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

// ---------- หน้าหลัก: แดชบอร์ดสุขภาพของสมาชิก ----------

export const MemberDetailPage: React.FC = () => {
  const { id = '' } = useParams();
  const toast = useToast();
  const requests = useAccessRequests();

  const [settings, setSettings] = useState(loadSettings);
  const [record, setRecord] = useState<MemberRecord>(() => loadMemberRecord(id));
  const [ownMedsState, setOwnMedsState] = useState(loadMeds);
  const [posts, setPosts] = useState<JournalPost[]>(loadPosts);
  const [events, setEvents] = useState<CalendarEvent[]>(loadEvents);
  const [onboarding, setOnboarding] = useState(loadOnboarding);

  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [rangePreset, setRangePreset] = useState<RangePreset>('30d');
  const [customRange, setCustomRange] = useState<{ from: string; to: string }>(() => ({
    from: rangeFor('30d', { from: '', to: '' }).from,
    to: todayKey(),
  }));

  const [dialog, setDialog] = useState<'view' | 'edit' | 'schedule' | 'vital' | 'basic' | null>(null);
  const [selectedMedId, setSelectedMedId] = useState<string | null>(null);
  const [editingMedInModal, setEditingMedInModal] = useState<Medication | null>(null);

  useEffect(() => {
    const refresh = () => {
      setSettings(loadSettings());
      setRecord(loadMemberRecord(id));
      setOwnMedsState(loadMeds());
      setPosts(loadPosts());
      setEvents(loadEvents());
      setOnboarding(loadOnboarding());
    };
    window.addEventListener(MEMBERS_CHANGED_EVENT, refresh);
    window.addEventListener(SETTINGS_CHANGED_EVENT, refresh);
    window.addEventListener(ACCESS_CHANGED_EVENT, refresh);
    window.addEventListener(MEDS_CHANGED_EVENT, refresh);
    window.addEventListener(JOURNAL_CHANGED_EVENT, refresh);
    window.addEventListener(CALENDAR_CHANGED_EVENT, refresh);
    window.addEventListener(ONBOARDING_CHANGED_EVENT, refresh);
    refresh();
    return () => {
      window.removeEventListener(MEMBERS_CHANGED_EVENT, refresh);
      window.removeEventListener(SETTINGS_CHANGED_EVENT, refresh);
      window.removeEventListener(ACCESS_CHANGED_EVENT, refresh);
      window.removeEventListener(MEDS_CHANGED_EVENT, refresh);
      window.removeEventListener(JOURNAL_CHANGED_EVENT, refresh);
      window.removeEventListener(CALENDAR_CHANGED_EVENT, refresh);
      window.removeEventListener(ONBOARDING_CHANGED_EVENT, refresh);
    };
  }, [id]);

  const member: HouseholdMember | undefined = settings.members.find((m) => m.id === id);

  const isMe = member?.id === CURRENT_MEMBER_ID;
  const ownProfile = isMe ? onboarding.profile : null;

  // รายการยาและบันทึกการกินยาของสมาชิกคนนี้
  const memberLogs: DoseLog[] = useMemo(
    () => (isMe ? ownMedsState.logs : record.doseLogs ?? []),
    [isMe, ownMedsState.logs, record.doseLogs]
  );

  const fullMeds: Medication[] = useMemo(() => {
    if (isMe) {
      return ownMedsState.meds
        .filter((m) => m.active)
        .slice()
        .sort((a, b) => (a.times[a.periods[0]] ?? '99:99').localeCompare(b.times[b.periods[0]] ?? '99:99'));
    }
    return memberMeds(record)
      .map((m) => medFromMember(m, memberLogs))
      .sort((a, b) => (a.times[a.periods[0]] ?? '99:99').localeCompare(b.times[b.periods[0]] ?? '99:99'));
  }, [isMe, ownMedsState.meds, record, memberLogs]);

  const selectedMed = useMemo(
    () => (selectedMedId ? fullMeds.find((m) => m.id === selectedMedId) ?? null : null),
    [fullMeds, selectedMedId]
  );

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

  // ข้อมูลสุขภาพคำนวณจาก memberDashboard
  const body = bodyInfo(record, ownProfile);
  const caregiver = caregiverOf(record, member, settings.members);
  const vitals = latestVitals(record, ownProfile);
  const diabetic = hasDiabetes(record.health.conditions);
  const bpClass = vitals.bp ? classifyBp(vitals.bp.sys, vitals.bp.dia) : null;
  const gluClass = vitals.glucose ? classifyGlucose(vitals.glucose.value, vitals.glucose.timing, diabetic) : null;

  const dosesToday = todayDoses(fullMeds, memberLogs);
  const summaryToday = doseSummary(dosesToday);

  const memberPosts = postsAboutMember(posts, member);
  const latestPost = memberPosts[0] ?? null;

  const upcomingAppts = upcomingAppointments(events, member, settings.members, isMe);
  const nextAppt = upcomingAppts[0] ?? null;

  const stockTrusted = (m: Medication) => {
    if (isMe) return true;
    const raw = record.meds.find((rm) => rm.id === m.id);
    return !!raw?.detail;
  };

  const followUps = buildFollowUps({
    member,
    members: settings.members,
    record,
    isMe,
    meds: fullMeds,
    logs: memberLogs,
    posts,
    events,
    own: ownProfile,
    stockTrusted,
  });

  const overallStatus = overallOf(followUps);
  const overallMeta = OVERALL_META[overallStatus];
  const todayMood = getMemberTodayMood(member.id, member.name, record);

  // ช่วงเวลาสำหรับแท็บประวัติสุขภาพย้อนหลัง
  const activeRange = rangeFor(rangePreset, customRange);
  const readingsInRange = sortedReadings(record.vitals).filter((r) => inRange(keyOfIso(r.at), activeRange));
  const bpReadings = readingsInRange.filter((r) => r.systolic != null && r.diastolic != null);
  const gluReadings = readingsInRange.filter((r) => r.glucose != null);
  const weightReadings = readingsInRange.filter((r) => r.weightKg != null);
  const postsInRange = memberPosts.filter((p) => inRange(keyOfIso(p.createdAt), activeRange));
  const doseReport = rangeDoseReport(fullMeds, memberLogs, activeRange.from, activeRange.to);
  const apptsInRange = appointmentsBetween(
    events,
    member,
    settings.members,
    isMe,
    parseKey(activeRange.from),
    parseKey(activeRange.to)
  );
  const medicalHistoryInRange = record.health.history.filter((h) => inRange(h.at, activeRange));

  // ---------- Actions ----------

  const checkAndConsumeOnce = () => {
    if (!isMe && latestEditRequest && latestEditRequest.decision === 'once' && !latestEditRequest.usedAt) {
      consumeOnce(latestEditRequest.id);
    }
  };

  const sendRequest = (scope: 'view' | 'edit', message: string) => {
    requestAccess(member.id, scope, message);
    setDialog(null);
    toast.show(`ส่งคำขอไปหา ${member.name} แล้ว รอการอนุมัติ`);
  };

  const saveSchedule = (nextMeds: MemberMed[], note: string) => {
    if (!editable) {
      toast.show('ไม่มีสิทธิ์แก้ไขข้อมูลตารางยา');
      return;
    }
    const updated: MemberRecord = {
      ...record,
      meds: nextMeds,
      health: { ...record.health, note },
    };
    saveMemberRecord(updated);
    setRecord(updated);
    checkAndConsumeOnce();
    setDialog(null);
    toast.show('บันทึกตารางยาและการดูแลแล้ว');
  };

  const handleToggleTodayDose = (med: Medication, period: DosePeriod, status: DoseStatus) => {
    if (!editable) {
      toast.show('ต้องได้รับสิทธิ์แก้ไขข้อมูลก่อนจึงจะยืนยันการกินยาได้');
      return;
    }
    const today = todayKey();
    const currentActor = {
      id: CURRENT_MEMBER_ID,
      name: settings.members.find((m) => m.id === CURRENT_MEMBER_ID)?.name ?? 'ฉัน',
    };
    const existing = findLog(memberLogs, today, med.id, period);
    const nextStatus: DoseStatus | null = existing?.status === status ? null : status;

    if (isMe) {
      const next = applyDoseStatus(ownMedsState, med, period, nextStatus, currentActor, today);
      saveMeds(next);
      setOwnMedsState(next);
    } else {
      const fakeState = { meds: fullMeds, logs: memberLogs };
      const next = applyDoseStatus(fakeState, med, period, nextStatus, currentActor, today);
      const nextMemberMeds = record.meds.map((rm) => {
        if (rm.id !== med.id) return rm;
        const updatedMed = next.meds.find((m: Medication) => m.id === med.id);
        return updatedMed && rm.detail ? { ...rm, detail: { ...rm.detail, remaining: updatedMed.remaining } } : rm;
      });
      const updatedRecord: MemberRecord = {
        ...record,
        meds: nextMemberMeds,
        doseLogs: next.logs,
      };
      saveMemberRecord(updatedRecord);
      setRecord(updatedRecord);
    }
    checkAndConsumeOnce();
    toast.show(`อัปเดตสถานะยา ${med.name} (${PERIOD_LABEL[period]}) แล้ว`);
  };

  const handleSaveVital = (reading: VitalReading) => {
    if (!editable) {
      toast.show('ไม่มีสิทธิ์บันทึกค่าสุขภาพ');
      return;
    }
    const nextVitals = [reading, ...(record.vitals ?? [])];
    const nextBp =
      reading.systolic != null && reading.diastolic != null
        ? `${reading.systolic}/${reading.diastolic}`
        : record.health.bloodPressure;
    const nextSugar = reading.glucose != null ? String(reading.glucose) : record.health.bloodSugar;
    const nextWeight = reading.weightKg != null ? reading.weightKg : record.weightKg;

    const updated: MemberRecord = {
      ...record,
      weightKg: nextWeight,
      vitals: nextVitals,
      health: {
        ...record.health,
        bloodPressure: nextBp,
        bloodSugar: nextSugar,
      },
    };
    saveMemberRecord(updated);
    setRecord(updated);

    if (isMe) {
      const ob = loadOnboarding();
      saveOnboarding({
        ...ob,
        profile: {
          ...ob.profile,
          systolic: reading.systolic != null ? String(reading.systolic) : ob.profile.systolic,
          diastolic: reading.diastolic != null ? String(reading.diastolic) : ob.profile.diastolic,
          fastingGlucose: reading.glucose != null ? String(reading.glucose) : ob.profile.fastingGlucose,
          weightKg: reading.weightKg != null ? String(reading.weightKg) : ob.profile.weightKg,
        },
      });
    }

    checkAndConsumeOnce();
    setDialog(null);
    toast.show('บันทึกค่าสุขภาพเรียบร้อยแล้ว');
  };

  const handleSaveBasic = (
    patch: Partial<MemberRecord>,
    ownPatch?: { birthDay: string; birthMonth: string; birthYear: string; heightCm: string; weightKg: string }
  ) => {
    if (!editable) {
      toast.show('ไม่มีสิทธิ์แก้ไขข้อมูล');
      return;
    }
    const updated: MemberRecord = {
      ...record,
      ...patch,
      health: patch.health ?? record.health,
    };
    saveMemberRecord(updated);
    setRecord(updated);

    if (isMe && ownPatch) {
      const ob = loadOnboarding();
      saveOnboarding({
        ...ob,
        profile: {
          ...ob.profile,
          ...ownPatch,
        },
      });
    }

    checkAndConsumeOnce();
    setDialog(null);
    toast.show('อัปเดตข้อมูลพื้นฐานของสมาชิกแล้ว');
  };

  const jumpToFollowTarget = (target: FollowTarget) => {
    if (target === 'meds') {
      setActiveTab('meds');
      return;
    }
    if (target === 'record') {
      if (editable) setDialog('vital');
      else {
        setActiveTab('history');
        setHistoryFilter('all');
      }
      return;
    }
    setActiveTab('history');
    if (target === 'symptoms') setHistoryFilter('symptoms');
    else if (target === 'bp') setHistoryFilter('bp');
    else if (target === 'glucose') setHistoryFilter('glucose');
    else if (target === 'weight') setHistoryFilter('weight');
    else if (target === 'appointments') setHistoryFilter('appointments');
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      {/* ==================== 1. ข้อมูลพื้นฐานของสมาชิก (Basic Profile Header) ==================== */}
      <Card className="p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <Link
              to="/members"
              title="กลับไปหน้ารายชื่อสมาชิก"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors mt-0.5"
            >
              <ChevronLeft className="w-6 h-6" aria-hidden="true" />
            </Link>
            <Avatar src={photo} name={member.name} className="h-16 w-16 sm:h-20 sm:w-20 text-2xl shadow-xs shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight break-words">
                  {member.name}
                </h1>
                <span className={roleBadge}>
                  <span aria-hidden="true" className={cn('h-2 w-2 rounded-full', ROLE_META[member.role].dot)} />
                  {ROLE_META[member.role].label}
                </span>
                {viewable && todayMood && (
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

              {/* อายุ วันเกิด เพศ ความสัมพันธ์ (แสดงรายละเอียดเฉพาะเมื่อมีสิทธิ์ดูข้อมูล) */}
              <p className="mt-1 text-sm sm:text-base text-slate-700 font-medium">
                {isMe ? 'ตัวฉันเอง' : `ความสัมพันธ์: ${member.relation}`}
                {viewable ? (
                  <>
                    {' · '}
                    {body.age !== null ? `อายุ ${body.age} ปี` : 'ไม่ระบุอายุ'}
                    {body.birthLabel ? ` (เกิด ${body.birthLabel})` : ''}
                    {' · '}
                    {record.gender ? GENDER_LABEL[record.gender] : 'ไม่ระบุเพศ'}
                  </>
                ) : (
                  <>
                    {' · '}
                    <span className="text-amber-800 font-semibold inline-flex items-center gap-1 text-xs sm:text-sm">
                      <Lock className="w-3.5 h-3.5 text-amber-700" />
                      <span>ข้อมูลสุขภาพถูกจำกัดสิทธิ์</span>
                    </span>
                  </>
                )}
              </p>

              {/* ผู้ดูแลหลักของสมาชิก (แสดงเมื่อมีสิทธิ์ดูข้อมูล) */}
              {viewable && (
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-purple-50/80 border border-purple-200/80 px-2.5 py-1 text-xs sm:text-sm font-bold text-purple-900">
                    <UserCheck className="w-4 h-4 text-purple-700 shrink-0" aria-hidden="true" />
                    <span>
                      ผู้ดูแลหลัก:{' '}
                      {caregiver.member
                        ? `${caregiver.member.name} (${caregiver.member.relation})`
                        : `${member.name} (ดูแลตัวเอง)`}
                    </span>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* สิทธิ์เข้าถึงและปุ่มการกระทำหลัก */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!isMe && !editable && (
              <>
                {latestEditRequest?.decision === 'pending' ? (
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
              </>
            )}

            {editable && (
              <>
                {!isMe && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs sm:text-sm font-bold border border-emerald-200">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>แก้ไขได้{latestEditRequest?.decision === 'once' ? ' (ครั้งนี้)' : ''}</span>
                  </span>
                )}
                <Button size="sm" variant="soft" onClick={() => setDialog('basic')}>
                  <PencilLine className="w-4 h-4" aria-hidden="true" />
                  <span>ข้อมูลพื้นฐาน</span>
                </Button>
                <Button size="sm" onClick={() => setDialog('vital')}>
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  <span>บันทึกค่าสุขภาพ</span>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* แถบสรุปข้อมูลร่างกาย + โรคประจำตัว + ประวัติการแพ้ยา (แสดงเมื่อมีสิทธิ์ดูข้อมูล) */}
        {viewable && (
          <div className="pt-3.5 border-t border-slate-100 space-y-3">
            {/* น้ำหนัก ส่วนสูง และค่า BMI ล่าสุด */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 px-3.5 py-2.5">
                <p className="text-xs font-bold text-slate-500">น้ำหนักล่าสุด</p>
                <p className="mt-0.5 text-base sm:text-lg font-extrabold text-slate-900 tabular-nums">
                  {body.weightKg !== null ? `${body.weightKg} กก.` : 'ยังไม่ระบุ'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 px-3.5 py-2.5">
                <p className="text-xs font-bold text-slate-500">ส่วนสูง</p>
                <p className="mt-0.5 text-base sm:text-lg font-extrabold text-slate-900 tabular-nums">
                  {body.heightCm !== null ? `${body.heightCm} ซม.` : 'ยังไม่ระบุ'}
                </p>
              </div>
              <div className="col-span-2 rounded-xl border border-slate-200/80 bg-slate-50/70 px-3.5 py-2.5 flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-slate-500">ดัชนีมวลกาย (BMI ล่าสุด)</p>
                  <p className="mt-0.5 text-base sm:text-lg font-extrabold text-slate-900 tabular-nums">
                    {body.bmi !== null ? (
                      body.bmi
                    ) : (
                      <span className="text-sm font-semibold text-slate-500">
                        ยังไม่มีข้อมูล <span className="text-xs text-slate-400 font-normal hidden sm:inline">(ระบุน้ำหนัก/ส่วนสูง)</span>
                      </span>
                    )}
                  </p>
                </div>
                {body.bmiLabel && body.bmiTone && (
                  <span
                    className={cn(
                      'inline-flex items-center rounded-lg border px-2.5 py-1 text-xs sm:text-sm font-bold shrink-0',
                      TONE_SOFT[body.bmiTone]
                    )}
                  >
                    {body.bmiLabel}
                  </span>
                )}
              </div>
            </div>

            {/* โรคประจำตัว & ประวัติการแพ้ยา */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5">
                <p className="text-xs font-bold text-slate-500 mb-1.5">โรคประจำตัว</p>
                <div className="flex flex-wrap gap-1.5">
                  {record.health.conditions.length === 0 ? (
                    <span className="text-sm text-slate-500">ไม่มีโรคประจำตัวที่ระบุไว้</span>
                  ) : (
                    record.health.conditions.map((c) => (
                      <span
                        key={c}
                        className="rounded-full bg-rose-50 border border-rose-200 px-3 py-0.5 text-xs sm:text-sm font-bold text-rose-900"
                      >
                        {c}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5">
                <p className="text-xs font-bold text-slate-500 mb-1.5">ประวัติการแพ้ยา / แพ้อาหาร</p>
                <div className="flex flex-wrap gap-1.5">
                  {record.health.allergies.length === 0 ? (
                    <span className="text-sm text-slate-500">ไม่มีประวัติการแพ้ยา/อาหาร</span>
                  ) : (
                    record.health.allergies.map((a) => (
                      <span
                        key={a}
                        className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-300 px-3 py-0.5 text-xs sm:text-sm font-bold text-amber-950"
                      >
                        <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" aria-hidden="true" />
                        <span>{a}</span>
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* ==================== กรณีข้อมูลถูกซ่อน ==================== */}
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
        <>
          {/* ==================== สถานะภาพรวมสุขภาพวันนี้ + ปุ่มสลับหน้า ==================== */}
          <div className={cn('rounded-2xl border p-4 sm:p-5 shadow-xs transition-colors', overallMeta.box)}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className={cn('rounded-xl p-2.5 shrink-0', overallMeta.badge)}>
                  <overallMeta.Icon className="w-6 h-6" aria-hidden="true" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider opacity-80">
                      สถานะภาพรวมวันนี้
                    </span>
                    <span className={cn('rounded-full px-3 py-0.5 text-sm font-extrabold', overallMeta.badge)}>
                      {overallMeta.label}
                    </span>
                    {followUps.length > 0 && (
                      <span className="text-sm font-bold">
                        ({followUps.length} รายการที่ต้องติดตาม)
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm sm:text-base font-semibold">{overallMeta.desc}</p>
                  <p className="mt-1 text-xs opacity-80 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>สถานะนี้เป็นเพียงตัวช่วยจัดลำดับความสำคัญในการดูแล ไม่ใช่การวินิจฉัยโรค</span>
                  </p>
                </div>
              </div>
              {followUps.length > 0 && activeTab !== 'overview' && (
                <Button size="sm" variant="neutral" onClick={() => setActiveTab('overview')}>
                  ดูรายการที่ต้องติดตาม ({followUps.length})
                </Button>
              )}
            </div>
          </div>

          {/* ปุ่มสลับหมวดหมู่ของ Dashboard (แบ่งเป็น 3 ปุ่มหลักเพื่อไม่ให้หน้ายาวเกินไป) */}
          <div
            role="tablist"
            aria-label="หมวดข้อมูลสุขภาพของสมาชิก"
            className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xs"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'overview'}
              onClick={() => setActiveTab('overview')}
              className={cn(
                'flex items-center justify-center gap-1 sm:gap-2 rounded-xl px-1.5 sm:px-2.5 py-2.5 sm:py-3 text-xs sm:text-base font-extrabold transition cursor-pointer min-w-0',
                activeTab === 'overview'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-purple-50'
              )}
            >
              <Sparkles className="w-3.5 h-3.5 sm:w-5 sm:h-5 shrink-0" aria-hidden="true" />
              <span className="truncate">
                <span className="hidden sm:inline">ภาพรวมวันนี้</span>
                <span className="sm:hidden">ภาพรวม</span>
              </span>
              {followUps.length > 0 && (
                <span
                  className={cn(
                    'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs leading-none font-extrabold shrink-0',
                    activeTab === 'overview' ? 'bg-white text-purple-800' : 'bg-amber-100 text-amber-900'
                  )}
                >
                  {followUps.length}
                </span>
              )}
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'meds'}
              onClick={() => setActiveTab('meds')}
              className={cn(
                'flex items-center justify-center gap-1 sm:gap-2 rounded-xl px-1.5 sm:px-2.5 py-2.5 sm:py-3 text-xs sm:text-base font-extrabold transition cursor-pointer min-w-0',
                activeTab === 'meds'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-purple-50'
              )}
            >
              <Pill className="w-3.5 h-3.5 sm:w-5 sm:h-5 shrink-0" aria-hidden="true" />
              <span className="truncate">
                <span className="hidden sm:inline">การจัดการยา ({fullMeds.length})</span>
                <span className="sm:hidden">ยา ({fullMeds.length})</span>
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'history'}
              onClick={() => setActiveTab('history')}
              className={cn(
                'flex items-center justify-center gap-1 sm:gap-2 rounded-xl px-1.5 sm:px-2.5 py-2.5 sm:py-3 text-xs sm:text-base font-extrabold transition cursor-pointer min-w-0',
                activeTab === 'history'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-purple-50'
              )}
            >
              <History className="w-3.5 h-3.5 sm:w-5 sm:h-5 shrink-0" aria-hidden="true" />
              <span className="truncate">
                <span className="hidden sm:inline">ประวัติสุขภาพ</span>
                <span className="sm:hidden">ประวัติ</span>
              </span>
            </button>
          </div>

          {/* ==================== TAB 1: ภาพรวมสุขภาพวันนี้ & กิจกรรมที่ต้องติดตาม ==================== */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* 1.2 ส่วนภาพรวมสุขภาพวันนี้ (Today's Health Overview) */}
              <Card className="shadow-xs space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <SectionTitle icon={ClipboardList}>ภาพรวมสุขภาพวันนี้ (Today's Health Overview)</SectionTitle>
                  <span className="text-xs sm:text-sm font-bold text-slate-500">
                    {thaiDate(todayKey())}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {/* 1) Medication: จำนวนยาที่ต้องรับประทานวันนี้ */}
                  <button
                    type="button"
                    onClick={() => setActiveTab('meds')}
                    className="text-left rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-purple-50/40 p-4 hover:border-purple-300 hover:shadow-xs transition cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold uppercase tracking-wide text-purple-800">
                        1. ยาที่ต้องรับประทานวันนี้
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-purple-700" />
                    </div>
                    <p className="mt-2 text-2xl font-extrabold text-slate-900">
                      {fullMeds.length} รายการ · {summaryToday.total} มื้อ
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {summaryToday.total === 0
                        ? 'ไม่มีมื้อยาที่มีกำหนดรับประทานวันนี้'
                        : `มื้อถัดไปหรือกดเพื่อดูตารางยาของ ${member.name}`}
                    </p>
                  </button>

                  {/* 2) Medication Status: รับประทานแล้ว / ยังไม่ยืนยัน / ข้าม */}
                  <button
                    type="button"
                    onClick={() => setActiveTab('meds')}
                    className="text-left rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-emerald-50/30 p-4 hover:border-purple-300 hover:shadow-xs transition cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold uppercase tracking-wide text-emerald-800">
                        2. สถานะการรับประทานยาวันนี้
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-purple-700" />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-100/90 px-2.5 py-1 text-xs sm:text-sm font-extrabold text-emerald-900">
                        รับประทานแล้ว {summaryToday.taken}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs sm:text-sm font-extrabold text-slate-800">
                        ยังไม่ยืนยัน {summaryToday.unconfirmed}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-lg bg-amber-100/90 px-2.5 py-1 text-xs sm:text-sm font-extrabold text-amber-900">
                        ข้าม {summaryToday.skipped}
                      </span>
                      {summaryToday.missed > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-rose-100 px-2.5 py-1 text-xs sm:text-sm font-extrabold text-rose-900">
                          ไม่ได้กิน {summaryToday.missed}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-xs font-semibold text-slate-600">
                      {summaryToday.late > 0
                        ? `มี ${summaryToday.late} มื้อที่เลยเวลาแล้วยังไม่ยืนยัน`
                        : 'กดเพื่อยืนยันการรับประทานยา'}
                    </p>
                  </button>

                  {/* 3) Health Journal: บันทึกอาการล่าสุด */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('history');
                      setHistoryFilter('symptoms');
                    }}
                    className="text-left rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-pink-50/30 p-4 hover:border-purple-300 hover:shadow-xs transition cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold uppercase tracking-wide text-pink-800">
                        3. บันทึกอาการล่าสุด
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-purple-700" />
                    </div>
                    {latestPost ? (
                      <>
                        <p className="mt-1.5 text-base font-extrabold text-slate-900 line-clamp-1">
                          {latestPost.symptoms.length > 0
                            ? `อาการ: ${latestPost.symptoms.join(', ')}`
                            : latestPost.moodMain
                              ? `อารมณ์: ${moodMeta(latestPost.moodMain)?.label ?? ''}`
                              : latestPost.title || 'บันทึกอาการ'}
                        </p>
                        <p className="mt-0.5 text-sm text-slate-600 line-clamp-1">
                          {latestPost.content || (latestPost.moodDetails.length > 0 ? latestPost.moodDetails.join(', ') : 'ไม่มีรายละเอียดเพิ่มเติม')}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          บันทึกเมื่อ {relativeDateTime(latestPost.createdAt)}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="mt-2 text-base font-bold text-slate-700">ยังไม่มีบันทึกอาการ</p>
                        <p className="mt-1 text-xs text-slate-500">ไปที่หน้าบันทึกอาการเพื่อโพสต์อัปเดต</p>
                      </>
                    )}
                  </button>

                  {/* 4) Vital Signs: ค่าความดัน น้ำตาล น้ำหนักล่าสุด */}
                  <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-sky-50/30 p-4">
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span className="text-xs font-extrabold uppercase tracking-wide text-sky-900">
                        4. สัญญาณชีพและค่าสุขภาพล่าสุด (Vital Signs)
                      </span>
                      <div className="flex items-center gap-2">
                        {editable && (
                          <button
                            type="button"
                            onClick={() => setDialog('vital')}
                            className="text-xs font-extrabold text-purple-700 hover:text-purple-900 underline cursor-pointer"
                          >
                            + บันทึกค่าใหม่
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('history');
                            setHistoryFilter('bp');
                          }}
                          className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                        >
                          ดูประวัติ ›
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {/* ความดัน */}
                      <div className="rounded-xl border border-slate-200/80 bg-white p-3">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold text-slate-500">ความดันโลหิต</span>
                          {bpClass && <ClassifiedChip value={bpClass} />}
                        </div>
                        <p className="mt-1 text-lg font-extrabold text-slate-900 tabular-nums">
                          {vitals.bp ? `${vitals.bp.sys}/${vitals.bp.dia} mmHg` : 'ไม่มีข้อมูล'}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {vitals.bp?.at ? relativeDateTime(vitals.bp.at) : 'ค่าพื้นฐาน'}
                        </p>
                      </div>

                      {/* น้ำตาล */}
                      <div className="rounded-xl border border-slate-200/80 bg-white p-3">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold text-slate-500">ระดับน้ำตาล</span>
                          {gluClass && <ClassifiedChip value={gluClass} />}
                        </div>
                        <p className="mt-1 text-lg font-extrabold text-slate-900 tabular-nums">
                          {vitals.glucose ? `${vitals.glucose.value} มก./ดล.` : 'ไม่มีข้อมูล'}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {vitals.glucose
                            ? `${GLUCOSE_TIMING_LABEL[vitals.glucose.timing]}${vitals.glucose.at ? ` · ${relativeDateTime(vitals.glucose.at)}` : ''}`
                            : 'ยังไม่เคยบันทึก'}
                        </p>
                      </div>

                      {/* น้ำหนัก */}
                      <div className="rounded-xl border border-slate-200/80 bg-white p-3">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold text-slate-500">น้ำหนักล่าสุด</span>
                          {body.bmiLabel && body.bmiTone && (
                            <span
                              className={cn(
                                'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-bold',
                                TONE_SOFT[body.bmiTone]
                              )}
                            >
                              BMI {body.bmi}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-lg font-extrabold text-slate-900 tabular-nums">
                          {vitals.weight ? `${vitals.weight.kg} กก.` : 'ไม่มีข้อมูล'}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {vitals.weight?.at ? relativeDateTime(vitals.weight.at) : 'ค่าพื้นฐาน'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 5) Appointments: นัดหมายครั้งถัดไป */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('history');
                      setHistoryFilter('appointments');
                    }}
                    className="text-left rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-amber-50/40 p-4 hover:border-purple-300 hover:shadow-xs transition cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold uppercase tracking-wide text-amber-900">
                        5. นัดหมายแพทย์ครั้งถัดไป
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-purple-700" />
                    </div>
                    {nextAppt ? (
                      <>
                        <p className="mt-1.5 text-base font-extrabold text-slate-900 line-clamp-1">
                          {nextAppt.event.title}
                        </p>
                        <p className="mt-0.5 text-sm font-bold text-purple-800">
                          {thaiDate(nextAppt.day)}
                          {nextAppt.event.allDay ? ' (ทั้งวัน)' : ` · ${nextAppt.event.startTime} น.`}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-600">
                          {(() => {
                            const d = daysUntilKey(nextAppt.day);
                            if (d === 0) return 'วันนี้!';
                            if (d === 1) return 'พรุ่งนี้';
                            return `อีก ${d} วัน`;
                          })()}
                          {nextAppt.event.location ? ` · ${nextAppt.event.location}` : ''}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="mt-2 text-base font-bold text-slate-700">ยังไม่มีนัดหมายเร็วๆ นี้</p>
                        <p className="mt-1 text-xs text-slate-500">เพิ่มนัดพบแพทย์ได้ในหน้าปฏิทินครอบครัว</p>
                      </>
                    )}
                  </button>
                </div>
              </Card>

              {/* 1.5 ส่วนกิจกรรมที่ต้องติดตาม (Things to Follow Up) */}
              <Card className="shadow-xs space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <SectionTitle icon={AlertCircle}>
                    กิจกรรมที่ต้องติดตาม (Things to Follow Up)
                  </SectionTitle>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-700">
                    {followUps.length} รายการ
                  </span>
                </div>

                {followUps.length === 0 ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 text-center">
                    <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" aria-hidden="true" />
                    <p className="mt-2 text-base font-extrabold text-emerald-950">
                      ทุกอย่างเรียบร้อยดี ไม่มีรายการค้างที่ต้องติดตามในขณะนี้
                    </p>
                    <p className="mt-0.5 text-sm text-emerald-800">
                      มื้อยาที่ถึงเวลาได้รับการยืนยันครบ และไม่มีสัญญาณชีพหรืออาการผิดปกติใหม่
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-2.5">
                    {followUps.map((item: FollowItem) => {
                      const isUrgent = item.level === 'urgent';
                      return (
                        <li
                          key={item.id}
                          className={cn(
                            'flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border p-4',
                            isUrgent
                              ? 'border-rose-300 bg-rose-50/70 text-rose-950'
                              : 'border-amber-200 bg-amber-50/60 text-amber-950'
                          )}
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            {isUrgent ? (
                              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
                            ) : (
                              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                            )}
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={cn(
                                    'rounded-md px-2 py-0.5 text-xs font-extrabold',
                                    isUrgent ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'
                                  )}
                                >
                                  {isUrgent ? 'ควรตรวจสอบเร่งด่วน' : 'ต้องติดตาม'}
                                </span>
                                <p className="text-base font-extrabold break-words">{item.title}</p>
                              </div>
                              <p className="mt-1 text-sm opacity-90 break-words">{item.detail}</p>
                            </div>
                          </div>

                          <Button
                            size="sm"
                            variant="neutral"
                            className="shrink-0 self-end sm:self-center"
                            onClick={() => jumpToFollowTarget(item.target)}
                          >
                            <span>ตรวจสอบ</span>
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            </div>
          )}

          {/* ==================== TAB 2: ส่วนจัดการยา (Medication Overview) ==================== */}
          {activeTab === 'meds' && (
            <div className="space-y-5">
              {/* เช็คชื่อการรับประทานยาวันนี้ */}
              <Card className="shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <SectionTitle icon={Clock}>ตารางรับประทานยาวันนี้</SectionTitle>
                    <p className="mt-0.5 text-sm text-slate-600">
                      รับประทานแล้ว {summaryToday.taken}/{summaryToday.total} มื้อ · ยังไม่ยืนยัน {summaryToday.unconfirmed} · ข้าม {summaryToday.skipped}
                    </p>
                  </div>
                  {editable && (
                    <Button size="sm" variant="soft" onClick={() => setDialog('schedule')}>
                      <PencilLine className="w-4 h-4" aria-hidden="true" />
                      <span>แก้ไขรายการยา</span>
                    </Button>
                  )}
                </div>

                {dosesToday.length === 0 ? (
                  <EmptyNote>วันนี้ไม่มีมื้อยาที่ต้องรับประทานตามตาราง</EmptyNote>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {dosesToday.map((d) => (
                      <li
                        key={d.key}
                        className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <span className="inline-flex items-center gap-1 rounded-xl border border-purple-200 bg-purple-50 px-3 py-1.5 text-sm font-extrabold text-purple-900 shrink-0">
                            <Clock className="w-4 h-4 text-purple-700" />
                            {PERIOD_LABEL[d.period]} {d.time} น.
                          </span>
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => setSelectedMedId(d.med.id)}
                              className="text-left text-base font-extrabold text-slate-900 hover:text-purple-800 underline-offset-2 hover:underline cursor-pointer break-words"
                            >
                              {d.med.name}
                            </button>
                            <p className="text-sm text-slate-600">
                              ครั้งละ {instructionText(d.med)}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
                          <DoseStateChip state={d.state} />
                          {editable && (
                            <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
                              <button
                                type="button"
                                title="ยืนยันว่ารับประทานแล้ว"
                                onClick={() => handleToggleTodayDose(d.med, d.period, 'taken')}
                                className={cn(
                                  'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-extrabold transition-colors cursor-pointer',
                                  d.state === 'taken'
                                    ? 'bg-emerald-600 text-white'
                                    : 'text-slate-700 hover:bg-emerald-100'
                                )}
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>กินแล้ว</span>
                              </button>
                              <button
                                type="button"
                                title="ข้ามมื้อนี้"
                                onClick={() => handleToggleTodayDose(d.med, d.period, 'skipped')}
                                className={cn(
                                  'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-extrabold transition-colors cursor-pointer',
                                  d.state === 'skipped'
                                    ? 'bg-amber-500 text-white'
                                    : 'text-slate-700 hover:bg-amber-100'
                                )}
                              >
                                <Slash className="w-3.5 h-3.5" />
                                <span>ข้าม</span>
                              </button>
                              <button
                                type="button"
                                title="ไม่ได้รับประทาน"
                                onClick={() => handleToggleTodayDose(d.med, d.period, 'missed')}
                                className={cn(
                                  'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-extrabold transition-colors cursor-pointer',
                                  d.state === 'missed'
                                    ? 'bg-rose-600 text-white'
                                    : 'text-slate-700 hover:bg-rose-100'
                                )}
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>ไม่ได้กิน</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              {/* 1.3 รายการยาที่สมาชิกต้องรับประทานทั้งหมด (กดเพื่อดูรายละเอียดและประวัติได้) */}
              <Card className="shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <SectionTitle icon={Pill}>รายการยาที่สมาชิกต้องรับประทาน ({fullMeds.length})</SectionTitle>
                    <p className="mt-0.5 text-sm text-slate-600">
                      กดที่รายการยาเพื่อดูรายละเอียด สรรพคุณ และประวัติการรับประทานยาย้อนหลัง
                    </p>
                  </div>
                  {isMe && (
                    <Link
                      to="/meds"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-purple-50 border border-purple-200 px-3.5 py-2 text-sm font-bold text-purple-900 hover:bg-purple-100"
                    >
                      <span>เปิดหน้าจัดการยาเต็มรูปแบบ</span>
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  )}
                </div>

                {fullMeds.length === 0 ? (
                  <EmptyNote>ยังไม่มีรายการยาหรือการดูแลที่บันทึกไว้</EmptyNote>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {fullMeds.map((med) => {
                      const medDosesToday = dosesToday.filter((d) => d.med.id === med.id);
                      const trusted = stockTrusted(med);
                      return (
                        <button
                          key={med.id}
                          type="button"
                          onClick={() => setSelectedMedId(med.id)}
                          className="text-left rounded-2xl border border-slate-200 bg-white p-4 hover:border-purple-400 hover:shadow-sm transition cursor-pointer flex items-start gap-3.5 group"
                        >
                          {/* รูปภาพยา (ถ้ามี) หรือไอคอนยา */}
                          <MedPhoto
                            med={med}
                            className="h-16 w-16 rounded-2xl border border-slate-200 bg-purple-50/70 shrink-0"
                            fallback={<Pill className="w-7 h-7 text-purple-600" aria-hidden="true" />}
                          />

                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-base sm:text-lg font-extrabold text-slate-900 group-hover:text-purple-800 break-words">
                                  {med.name}
                                </p>
                                <p className="text-xs font-bold text-slate-500">
                                  {formatMedForm(med)}
                                  {med.condition ? ` · เพื่อดูแล: ${med.condition}` : ''}
                                </p>
                              </div>
                              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-purple-700 shrink-0 mt-0.5" />
                            </div>

                            {/* ขนาดและจำนวนที่ต้องรับประทาน + วิธีใช้ */}
                            <p className="text-sm font-bold text-slate-800">
                              ขนาดรับประทาน: ครั้งละ {instructionText(med)}
                            </p>

                            {/* เวลาในการรับประทาน */}
                            <div className="flex flex-wrap gap-1.5">
                              {med.periods.length === 0 ? (
                                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                                  ใช้เมื่อมีอาการ
                                </span>
                              ) : (
                                med.periods.map((p) => (
                                  <span
                                    key={p}
                                    className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-xs font-bold text-purple-900"
                                  >
                                    <Clock className="w-3 h-3 text-purple-600" />
                                    {PERIOD_LABEL[p]} {med.times[p] ?? DEFAULT_TIME[p]} น.
                                  </span>
                                ))
                              )}
                            </div>

                            {/* สถานะการรับประทานยาวันนี้ + คงเหลือ */}
                            <div className="pt-1 flex flex-wrap items-center gap-2">
                              {medDosesToday.map((d) => (
                                <span key={d.key} className="inline-flex items-center gap-1 text-xs font-bold text-slate-600">
                                  <span>{PERIOD_LABEL[d.period]}:</span>
                                  <DoseStateChip state={d.state} className="px-2 py-0.5 text-xs" />
                                </span>
                              ))}
                              {trusted && <StockBadge med={med} />}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ==================== TAB 3: ส่วนประวัติสุขภาพ (Health History) ==================== */}
          {activeTab === 'history' && (
            <div className="space-y-5">
              {/* ตัวกรองตามช่วงเวลา (7 วัน, 30 วัน, 3 เดือน, กำหนดเอง) และหมวดหมู่ */}
              <Card className="shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <SectionTitle icon={History}>ประวัติสุขภาพย้อนหลัง (Health History)</SectionTitle>

                  {/* ปุ่มเลือกช่วงเวลา */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(['7d', '30d', '3m', 'custom'] as RangePreset[]).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setRangePreset(preset)}
                        className={cn(
                          'rounded-xl border px-3 py-1.5 text-xs sm:text-sm font-extrabold transition-colors cursor-pointer',
                          rangePreset === preset
                            ? 'border-purple-700 bg-purple-700 text-white'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-purple-50'
                        )}
                      >
                        {RANGE_LABEL[preset]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* กำหนดวันที่เอง */}
                {rangePreset === 'custom' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-2xl border border-purple-200 bg-purple-50/40 p-3.5">
                    <TextField
                      id="history-from"
                      type="date"
                      label="ตั้งแต่วันที่"
                      value={customRange.from}
                      onChange={(e) => setCustomRange((prev) => ({ ...prev, from: e.target.value }))}
                    />
                    <TextField
                      id="history-to"
                      type="date"
                      label="ถึงวันที่"
                      value={customRange.to}
                      onChange={(e) => setCustomRange((prev) => ({ ...prev, to: e.target.value }))}
                    />
                  </div>
                )}

                <p className="text-xs sm:text-sm font-semibold text-slate-600">
                  ช่วงข้อมูลที่แสดง: {thaiDate(activeRange.from)} – {thaiDate(activeRange.to)}
                </p>

                {/* ปุ่มกรองหมวดข้อมูลย้อนหลัง */}
                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100">
                  {(
                    [
                      { id: 'all', label: 'ทั้งหมด' },
                      { id: 'symptoms', label: `บันทึกอาการ (${postsInRange.length})` },
                      { id: 'bp', label: `ความดันโลหิต (${bpReadings.length})` },
                      { id: 'glucose', label: `ระดับน้ำตาล (${gluReadings.length})` },
                      { id: 'weight', label: `น้ำหนัก (${weightReadings.length})` },
                      { id: 'meds', label: `การรับประทานยา (${doseReport.days.length} วัน)` },
                      { id: 'appointments', label: `นัดหมาย/การรักษา (${apptsInRange.length + medicalHistoryInRange.length})` },
                    ] as { id: HistoryFilter; label: string }[]
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setHistoryFilter(f.id)}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-xs sm:text-sm font-bold transition-colors cursor-pointer',
                        historyFilter === f.id
                          ? 'border-purple-600 bg-purple-100 text-purple-950'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </Card>

              {/* 1) ประวัติการบันทึกอาการ */}
              {(historyFilter === 'all' || historyFilter === 'symptoms') && (
                <Card className="shadow-xs space-y-3.5">
                  <SectionTitle icon={BookHeart}>ประวัติการบันทึกอาการและอารมณ์</SectionTitle>
                  {postsInRange.length === 0 ? (
                    <EmptyNote>ไม่มีการบันทึกอาการในช่วงเวลานี้</EmptyNote>
                  ) : (
                    <ul className="space-y-2.5">
                      {postsInRange.map((p) => {
                        const meta = moodMeta(p.moodMain);
                        const tone = p.moodMain ? MOOD_TONE[p.moodMain] : null;
                        return (
                          <li key={p.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-500">{shortDateTime(p.createdAt)}</span>
                              {meta && tone && (
                                <span
                                  className={cn(
                                    'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold',
                                    tone.badge
                                  )}
                                >
                                  {meta.label}
                                  {p.moodDetails.length > 0 ? `: ${p.moodDetails.join(', ')}` : ''}
                                </span>
                              )}
                            </div>
                            {p.symptoms.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {p.symptoms.map((s) => (
                                  <span
                                    key={s}
                                    className="rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-xs font-extrabold text-rose-900"
                                  >
                                    อาการ: {s}
                                  </span>
                                ))}
                              </div>
                            )}
                            {p.title && <p className="text-sm font-bold text-slate-900 break-words">{p.title}</p>}
                            {p.content && <p className="text-sm sm:text-base text-slate-800 break-words">{p.content}</p>}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Card>
              )}

              {/* 2) ประวัติค่าความดันโลหิต */}
              {(historyFilter === 'all' || historyFilter === 'bp') && (
                <Card className="shadow-xs space-y-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <SectionTitle icon={HeartPulse}>ประวัติค่าความดันโลหิต</SectionTitle>
                    {editable && (
                      <Button size="sm" variant="soft" onClick={() => setDialog('vital')}>
                        + บันทึกความดัน
                      </Button>
                    )}
                  </div>
                  {bpReadings.length === 0 ? (
                    <EmptyNote>ไม่มีประวัติการวัดความดันโลหิตในช่วงเวลานี้</EmptyNote>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {bpReadings.map((r) => {
                        const c = classifyBp(r.systolic as number, r.diastolic as number);
                        return (
                          <li key={r.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-base font-extrabold text-slate-900 tabular-nums">
                                {r.systolic}/{r.diastolic} mmHg
                              </p>
                              <p className="text-xs text-slate-500">
                                {shortDateTime(r.at)}
                                {r.note ? ` · ${r.note}` : ''}
                              </p>
                            </div>
                            <ClassifiedChip value={c} />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Card>
              )}

              {/* 3) ประวัติระดับน้ำตาล */}
              {(historyFilter === 'all' || historyFilter === 'glucose') && (
                <Card className="shadow-xs space-y-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <SectionTitle icon={Droplet}>ประวัติระดับน้ำตาลในเลือด</SectionTitle>
                    {editable && (
                      <Button size="sm" variant="soft" onClick={() => setDialog('vital')}>
                        + บันทึกค่าน้ำตาล
                      </Button>
                    )}
                  </div>
                  {gluReadings.length === 0 ? (
                    <EmptyNote>ไม่มีประวัติการตรวจระดับน้ำตาลในช่วงเวลานี้</EmptyNote>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {gluReadings.map((r) => {
                        const c = classifyGlucose(r.glucose as number, r.glucoseTiming, diabetic);
                        return (
                          <li key={r.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-base font-extrabold text-slate-900 tabular-nums">
                                {r.glucose} มก./ดล.{' '}
                                <span className="text-xs font-bold text-slate-500">
                                  ({GLUCOSE_TIMING_LABEL[r.glucoseTiming ?? 'unknown']})
                                </span>
                              </p>
                              <p className="text-xs text-slate-500">
                                {shortDateTime(r.at)}
                                {r.note ? ` · ${r.note}` : ''}
                              </p>
                            </div>
                            <ClassifiedChip value={c} />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Card>
              )}

              {/* 4) ประวัติน้ำหนัก */}
              {(historyFilter === 'all' || historyFilter === 'weight') && (
                <Card className="shadow-xs space-y-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <SectionTitle icon={Scale}>ประวัติน้ำหนักตัว</SectionTitle>
                    {editable && (
                      <Button size="sm" variant="soft" onClick={() => setDialog('vital')}>
                        + บันทึกน้ำหนัก
                      </Button>
                    )}
                  </div>
                  {weightReadings.length === 0 ? (
                    <EmptyNote>ไม่มีประวัติการชั่งน้ำหนักในช่วงเวลานี้</EmptyNote>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {weightReadings.map((r) => (
                        <li key={r.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-base font-extrabold text-slate-900 tabular-nums">{r.weightKg} กก.</p>
                            <p className="text-xs text-slate-500">
                              {shortDateTime(r.at)}
                              {r.note ? ` · ${r.note}` : ''}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              )}

              {/* 5) ประวัติการรับประทานยา */}
              {(historyFilter === 'all' || historyFilter === 'meds') && (
                <Card className="shadow-xs space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <SectionTitle icon={Activity}>ประวัติการรับประทานยา</SectionTitle>
                    {doseReport.adherence !== null && (
                      <span className="rounded-full bg-purple-50 border border-purple-200 px-3 py-1 text-xs sm:text-sm font-extrabold text-purple-900">
                        ความสม่ำเสมอ {doseReport.adherence}% (กินแล้ว {doseReport.totals.taken}/{doseReport.totals.expected - doseReport.totals.skipped} มื้อ)
                      </span>
                    )}
                  </div>
                  {doseReport.days.length === 0 ? (
                    <EmptyNote>ไม่มีประวัติมื้อยาในช่วงเวลานี้</EmptyNote>
                  ) : (
                    <ul className="space-y-3">
                      {doseReport.days.slice(0, 15).map((row) => (
                        <li key={row.date} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-3.5">
                          <p className="text-sm font-extrabold text-slate-800 mb-2">{thaiDate(row.date)}</p>
                          <div className="flex flex-wrap gap-2">
                            {row.entries.map((e) => (
                              <div
                                key={`${row.date}-${e.med.id}-${e.period}`}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs sm:text-sm"
                              >
                                <span className="font-bold text-slate-800">
                                  {e.med.name} ({PERIOD_LABEL[e.period]})
                                </span>
                                <DoseStateChip state={e.state} className="px-2 py-0.5 text-xs" />
                              </div>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              )}

              {/* 6) ประวัติการนัดหมายและการพบแพทย์ */}
              {(historyFilter === 'all' || historyFilter === 'appointments') && (
                <Card className="shadow-xs space-y-3.5">
                  <SectionTitle icon={Stethoscope}>ประวัติการนัดหมายและบันทึกการรักษา</SectionTitle>
                  {apptsInRange.length === 0 && medicalHistoryInRange.length === 0 ? (
                    <EmptyNote>ไม่มีประวัติการนัดหมายหรือการพบแพทย์ในช่วงเวลานี้</EmptyNote>
                  ) : (
                    <div className="space-y-3">
                      {apptsInRange.map((occ) => (
                        <div
                          key={`${occ.event.id}-${occ.day}`}
                          className="rounded-2xl border border-purple-200 bg-purple-50/40 p-3.5"
                        >
                          <div className="flex items-center gap-2 text-xs font-extrabold text-purple-800">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>นัดหมายในปฏิทิน · {thaiDate(occ.day)}</span>
                          </div>
                          <p className="mt-1 text-base font-extrabold text-slate-900">{occ.event.title}</p>
                          {occ.event.description && (
                            <p className="mt-0.5 text-sm text-slate-600">{occ.event.description}</p>
                          )}
                        </div>
                      ))}

                      {medicalHistoryInRange.map((h) => (
                        <div key={h.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5">
                          <p className="text-xs font-semibold text-slate-500">{thaiDate(h.at)}</p>
                          <p className="text-base font-extrabold text-slate-900 mt-0.5">{h.label}</p>
                          <p className="text-sm text-slate-600 mt-0.5">{h.detail}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}
            </div>
          )}
        </>
      )}

      {/* หมายเหตุด้านล่าง */}
      {!isMe && (
        <p className="text-xs sm:text-sm text-center text-slate-500 pt-2 pb-4">
          ข้อมูลนี้เป็นของ {member.name} · ตั้งค่าสิทธิ์เข้าถึงข้อมูลของคุณได้ที่{' '}
          <Link to="/settings/privacy" className="text-purple-700 underline font-semibold hover:text-purple-900">
            ตั้งค่า › ความเป็นส่วนตัว
          </Link>
        </p>
      )}

      {/* ==================== หน้าต่าง Modals ==================== */}
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
          logs={memberLogs}
          onClose={() => setDialog(null)}
          onSave={saveSchedule}
        />
      )}

      {dialog === 'vital' && (
        <VitalModal
          memberName={member.name}
          onClose={() => setDialog(null)}
          onSave={handleSaveVital}
        />
      )}

      {dialog === 'basic' && (
        <BasicProfileModal
          record={record}
          member={member}
          members={settings.members}
          isMe={isMe}
          onClose={() => setDialog(null)}
          onSave={handleSaveBasic}
        />
      )}

      {/* หน้าต่างดูรายละเอียดและประวัติการรับประทานยาเมื่อคลิกที่รายการยา */}
      <MedDetailModal
        med={selectedMed}
        logs={memberLogs}
        onClose={() => setSelectedMedId(null)}
        onEdit={(med) => {
          setSelectedMedId(null);
          if (editable) {
            setEditingMedInModal(med);
          } else {
            toast.show('คุณยังไม่มีสิทธิ์แก้ไขรายการยาของสมาชิกคนนี้');
          }
        }}
        onDelete={(med) => {
          if (!editable) {
            toast.show('คุณยังไม่มีสิทธิ์ลบรายการยาของสมาชิกคนนี้');
            return;
          }
          if (isMe) {
            const next = {
              ...ownMedsState,
              meds: ownMedsState.meds.filter((m) => m.id !== med.id),
            };
            saveMeds(next);
            setOwnMedsState(next);
          } else {
            const updated: MemberRecord = {
              ...record,
              meds: record.meds.filter((m) => m.id !== med.id),
            };
            saveMemberRecord(updated);
            setRecord(updated);
          }
          checkAndConsumeOnce();
          setSelectedMedId(null);
          toast.show(`ลบรายการยา ${med.name} แล้ว`);
        }}
        onRefill={(med) => {
          setSelectedMedId(null);
          if (editable) setEditingMedInModal(med);
        }}
      />

      {editingMedInModal && (
        <MedFormModal
          open
          initial={editingMedInModal}
          defaultLowStockDays={3}
          conditionSuggestions={record.health.conditions}
          onClose={() => setEditingMedInModal(null)}
          onSave={(data) => {
            if (isMe) {
              const next = {
                ...ownMedsState,
                meds: ownMedsState.meds.map((m) => (m.id === editingMedInModal.id ? { ...m, ...data } : m)),
              };
              saveMeds(next);
              setOwnMedsState(next);
            } else {
              const saved = memberMedFromForm(editingMedInModal.id, data);
              const exists = record.meds.some((m) => m.id === saved.id);
              const updated: MemberRecord = {
                ...record,
                meds: exists ? record.meds.map((m) => (m.id === saved.id ? saved : m)) : [...record.meds, saved],
              };
              saveMemberRecord(updated);
              setRecord(updated);
            }
            checkAndConsumeOnce();
            setEditingMedInModal(null);
            toast.show('อัปเดตข้อมูลยาเรียบร้อยแล้ว');
          }}
        />
      )}
    </div>
  );
};
