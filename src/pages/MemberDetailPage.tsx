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
import { Dino } from '../components/ui/Dino';
import { Avatar } from '../components/ui/Avatar';
import { Modal } from '../components/ui/Modal';
import { TextField } from '../components/ui/TextField';
import { SelectField } from '../components/ui/SelectField';
import { DateField } from '../components/ui/DatePicker';
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
  consumeOnce,
  requestAccess,
  requestsFor,
  useAccessRequests,
} from '../lib/access';
import {
  MEDS_CHANGED_EVENT,
  PERIOD_LABEL,
  applyDoseStatus,
  commonDoseWords,
  doseWords,
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
import { JOURNAL_CHANGED_EVENT, SELF_LABEL, loadPosts, type JournalPost } from '../lib/journal';
import { useDailyRecordComposer } from '../components/journal/DailyRecordComposer';
import { ProgressOverview, type ProgressTarget } from '../components/health/ProgressOverview';
import { hasVitals, vitalChips } from '../lib/dailyRecord';
import { MOOD_TONE, moodMeta } from '../data/journalOptions';
import { CALENDAR_CHANGED_EVENT, loadEvents, parseKey, type CalendarEvent } from '../lib/calendar';
import { ONBOARDING_CHANGED_EVENT, loadOnboarding, saveOnboarding } from '../lib/onboarding';
import { REQUEST_MESSAGE_SUGGESTIONS } from '../data/suggestions';
import { MONTHS } from '../data/onboardingOptions';
import { TONE_SOFT } from '../components/health/HealthCharts';
import { Sparkline, TrendBlock } from '../components/health/TrendChart';
import { MoodDino } from '../components/journal/MoodDino';
import { ExtraMetricsHistory } from '../components/health/ExtraMetricsHistory';
import { EXTRA_METRICS, metricValue, seriesOf } from '../lib/vitalMetrics';
import { LatestByCategory } from '../components/health/LatestByCategory';
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
type HistoryFilter = 'all' | 'symptoms' | 'bp' | 'glucose' | 'weight' | 'other' | 'meds' | 'appointments';

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

/** หัวข้อการ์ดแบบกะทัดรัด: ไอคอนในวงกลมสีอ่อน + ชื่อ + ส่วนด้านขวา */
const PanelHead: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  tint: string;
  title: string;
  aside?: React.ReactNode;
}> = ({ icon: Icon, tint, title, aside }) => (
  <div className="flex items-center justify-between gap-2">
    <h2 className="flex items-center gap-2.5 text-base sm:text-lg font-extrabold text-slate-900">
      <span className={cn('inline-flex h-9 w-9 items-center justify-center rounded-full shrink-0', tint)}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span>{title}</span>
    </h2>
    {aside}
  </div>
);

// ---------- หน้าต่างขออนุญาต ----------

const RequestDialog: React.FC<{
  memberName: string;
  scope: 'view' | 'edit';
  onClose: () => void;
  onSubmit: (message: string) => void;
}> = ({ memberName, scope, onClose, onSubmit }) => {
  const [message, setMessage] = useState(
    scope === 'edit' ? `ขออนุญาตจัดตารางยาและช่วยบันทึกสุขภาพให้ ${memberName}` : `ขออนุญาตดูข้อมูลสุขภาพของ ${memberName}`
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
            <SelectField
              id="basic-month"
              label="เดือน"
              placeholder="ไม่ระบุ"
              value={birthMonth}
              onChange={setBirthMonth}
              options={[{ value: '', label: 'ไม่ระบุ' }, ...MONTHS]}
            />
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
          <SelectField
            id="basic-caregiver"
            label="ผู้ดูแลหลักของสมาชิกคนนี้"
            placeholder="ใช้ค่าเริ่มต้นของผู้ดูแลหลัก"
            value={caregiverId}
            onChange={setCaregiverId}
            options={[
              { value: '', label: 'ใช้ค่าเริ่มต้นของผู้ดูแลหลัก' },
              ...members.map((m) => ({ value: m.id, label: `${m.name} (${m.relation})` })),
            ]}
          />
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
  /** แท็บภาพรวม: วันนี้ (สิ่งที่ต้องทำ) หรือพัฒนาการในช่วงเวลา */
  const [overviewPeriod, setOverviewPeriod] = useState<'today' | '7d' | '30d' | '3m'>('today');
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [showAllFollowUps, setShowAllFollowUps] = useState(false);
  const [rangePreset, setRangePreset] = useState<RangePreset>('30d');
  const [customRange, setCustomRange] = useState<{ from: string; to: string }>(() => ({
    from: rangeFor('30d', { from: '', to: '' }).from,
    to: todayKey(),
  }));

  const [dialog, setDialog] = useState<'view' | 'edit' | 'schedule' | 'basic' | null>(null);
  // บันทึกประจำวัน (อาการ + ค่าสุขภาพ) ตัวเดียวกับหน้าบันทึกอาการ
  const composer = useDailyRecordComposer();
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
  /** เปิดบันทึกประจำวันของสมาชิกคนนี้ โดยเปิดส่วนค่าสุขภาพไว้ (ค่าที่บันทึกขึ้นกราฟในหน้านี้ทันที) */
  const openRecord = () => composer.start({ first: 'vitals', about: isMe ? SELF_LABEL : member?.name });
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
          <p className="mt-1 text-base text-slate-600">อาจถูกนำออกจากกลุ่มบ้านไปแล้ว</p>
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
  // คำสรุปรวม: ยาทุกตัวใช้กริยาเดียวกันใช้คำนั้น ถ้าปนกัน (กิน+หยอด+ฉีด) ใช้ "ใช้ยา"
  const cw = commonDoseWords(fullMeds.map((m) => m.form));

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

  const visibleFollowUps = showAllFollowUps ? followUps : followUps.slice(0, 3);
  const pendingDoses = dosesToday.filter((d) => d.state === 'unconfirmed');
  const doneDoses = summaryToday.taken + summaryToday.skipped;
  const dosePct = summaryToday.total > 0 ? Math.round((doneDoses / summaryToday.total) * 100) : 0;

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
  const sysSeries = seriesOf(bpReadings, (r) => r.systolic);
  const diaSeries = seriesOf(bpReadings, (r) => r.diastolic);
  const gluSeries = seriesOf(gluReadings, (r) => r.glucose);
  const weightSeries = seriesOf(weightReadings, (r) => r.weightKg);
  const extraCount = readingsInRange.filter((r) => EXTRA_METRICS.some((m) => metricValue(r, m) != null)).length;
  // แนวโน้มย่อบนหน้าภาพรวม ใช้ค่าล่าสุดทั้งหมด ไม่ขึ้นกับช่วงเวลาที่เลือกในแท็บประวัติ
  const allReadings = record.vitals ?? [];
  const sparkSys = seriesOf(allReadings, (r) => r.systolic);
  const sparkGlu = seriesOf(allReadings, (r) => r.glucose);
  const sparkWeight = seriesOf(allReadings, (r) => r.weightKg);

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
      if (editable) openRecord();
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
                    <MoodDino mood={todayMood.main} className="h-7 w-7 -my-1 shrink-0" />
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
                <Button size="sm" onClick={() => openRecord()}>
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  <span>บันทึกค่าสุขภาพ</span>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* แถบสรุปร่างกายแบบกะทัดรัด + โรคประจำตัว + การแพ้ (แสดงเมื่อมีสิทธิ์ดูข้อมูล) */}
        {viewable && (
          <div className="pt-3.5 border-t border-slate-100 space-y-2.5">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-slate-600">
              <span>
                น้ำหนัก{' '}
                <b className="text-base font-extrabold text-slate-900 tabular-nums">
                  {body.weightKg !== null ? `${body.weightKg} กก.` : 'ยังไม่ระบุ'}
                </b>
              </span>
              <span>
                ส่วนสูง{' '}
                <b className="text-base font-extrabold text-slate-900 tabular-nums">
                  {body.heightCm !== null ? `${body.heightCm} ซม.` : 'ยังไม่ระบุ'}
                </b>
              </span>
              <span className="inline-flex items-center gap-1.5">
                BMI{' '}
                <b className="text-base font-extrabold text-slate-900 tabular-nums">
                  {body.bmi !== null ? body.bmi : 'ยังไม่มีข้อมูล'}
                </b>
                {body.bmiLabel && body.bmiTone && (
                  <span
                    className={cn(
                      'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-bold',
                      TONE_SOFT[body.bmiTone]
                    )}
                  >
                    {body.bmiLabel}
                  </span>
                )}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500">โรคประจำตัว</span>
                {record.health.conditions.length === 0 ? (
                  <span className="text-sm text-slate-500">ไม่มี</span>
                ) : (
                  record.health.conditions.map((c) => (
                    <span
                      key={c}
                      className="rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-xs sm:text-sm font-bold text-rose-900"
                    >
                      {c}
                    </span>
                  ))
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500">แพ้ยา/อาหาร</span>
                {record.health.allergies.length === 0 ? (
                  <span className="text-sm text-slate-500">ไม่มี</span>
                ) : (
                  record.health.allergies.map((a) => (
                    <span
                      key={a}
                      className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-300 px-2.5 py-0.5 text-xs sm:text-sm font-bold text-amber-950"
                    >
                      <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" aria-hidden="true" />
                      <span>{a}</span>
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* ==================== กรณีข้อมูลถูกซ่อน ==================== */}
      {!viewable ? (
        <Card className="text-center py-12 shadow-xs">
          <Dino pose="peek" bob className="mx-auto h-28 w-32" />
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
          {/* ==================== สถานะภาพรวมวันนี้ (แถบสั้น) ==================== */}
          <div
            className={cn(
              'rounded-2xl border px-4 py-3 shadow-xs flex items-center gap-3 transition-colors',
              overallMeta.box
            )}
          >
            <div className={cn('rounded-xl p-2 shrink-0', overallMeta.badge)}>
              <overallMeta.Icon className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm sm:text-base font-extrabold leading-snug">
                วันนี้: {overallMeta.label}
                {followUps.length > 0 && ` · ${followUps.length} รายการที่ต้องติดตาม`}
              </p>
              <p className="text-xs sm:text-sm opacity-90">{overallMeta.desc}</p>
            </div>
            {followUps.length > 0 && activeTab !== 'overview' && (
              <Button size="sm" variant="neutral" className="shrink-0" onClick={() => setActiveTab('overview')}>
                ดูรายการ
              </Button>
            )}
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
                ภาพรวม
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

          {/* ==================== TAB 1: ภาพรวมวันนี้ (เรียงตามลำดับความสำคัญ: ต้องทำ → ยา → ค่าสุขภาพ → นัด) ==================== */}
          {activeTab === 'overview' && (
            <div className="space-y-4 sm:space-y-5">
              {/* เลือกดู: วันนี้ (สิ่งที่ต้องทำ) หรือพัฒนาการภาพรวมในช่วงเวลา */}
              <fieldset className="min-w-0">
                <legend className="sr-only">ช่วงเวลาของภาพรวม</legend>
                <div className="seg-track grid grid-cols-4 gap-1 rounded-2xl p-1">
                  {(
                    [
                      { id: 'today', label: 'วันนี้' },
                      { id: '7d', label: '7 วัน' },
                      { id: '30d', label: '30 วัน' },
                      { id: '3m', label: '3 เดือน' },
                    ] as const
                  ).map((opt) => {
                    const on = overviewPeriod === opt.id;
                    return (
                      <label
                        key={opt.id}
                        className={cn(
                          'flex min-h-[48px] cursor-pointer items-center justify-center rounded-xl px-1 text-center text-base font-bold',
                          'focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-purple-600',
                          on ? 'seg-on text-white' : 'text-slate-700 hover:bg-white'
                        )}
                      >
                        <input
                          type="radio"
                          name="overview-period"
                          value={opt.id}
                          checked={on}
                          onChange={() => setOverviewPeriod(opt.id)}
                          className="sr-only"
                        />
                        {opt.label}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              {overviewPeriod !== 'today' ? (
                <ProgressOverview
                  key={overviewPeriod}
                  memberName={member.name}
                  range={rangeFor(overviewPeriod, customRange)}
                  rangeLabel={RANGE_LABEL[overviewPeriod]}
                  readings={record.vitals ?? []}
                  posts={memberPosts}
                  adherence={(() => {
                    const r = rangeFor(overviewPeriod, customRange);
                    return rangeDoseReport(fullMeds, memberLogs, r.from, r.to).adherence;
                  })()}
                  keyOf={keyOfIso}
                  onOpen={(target: ProgressTarget) => {
                    setRangePreset(overviewPeriod);
                    setHistoryFilter(target);
                    setActiveTab('history');
                  }}
                  onRecord={editable ? openRecord : undefined}
                />
              ) : (
              <>
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-5 items-start">
                {/* ---------- คอลัมน์หลัก: สิ่งที่ต้องทำ ---------- */}
                <div className="lg:col-span-3 space-y-4 sm:space-y-5">
                  {/* 1) ต้องดูแลตอนนี้ */}
                  <Card className="p-4 sm:p-5 shadow-xs space-y-3">
                    <PanelHead
                      icon={followUps.length === 0 ? CheckCircle2 : AlertCircle}
                      tint={followUps.length === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}
                      title="ต้องดูแลตอนนี้"
                      aside={
                        followUps.length > 0 ? (
                          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-extrabold text-amber-900">
                            {followUps.length} รายการ
                          </span>
                        ) : null
                      }
                    />

                    {followUps.length === 0 ? (
                      <p className="flex items-center gap-3 rounded-xl bg-emerald-50 px-3.5 py-2 text-sm sm:text-base font-bold text-emerald-900">
                        <Dino pose="cheer" className="h-14 w-16 shrink-0" />
                        <span>ทุกอย่างเรียบร้อยดี ไม่มีรายการค้างที่ต้องติดตาม</span>
                      </p>
                    ) : (
                      <>
                        <ul className="space-y-2">
                          {visibleFollowUps.map((item: FollowItem) => {
                            const isUrgent = item.level === 'urgent';
                            return (
                              <li
                                key={item.id}
                                className={cn(
                                  'flex items-center gap-3 rounded-xl border p-3',
                                  isUrgent
                                    ? 'border-rose-300 bg-rose-50/70 text-rose-950'
                                    : 'border-amber-200 bg-amber-50/60 text-amber-950'
                                )}
                              >
                                {isUrgent ? (
                                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" aria-hidden="true" />
                                ) : (
                                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" aria-hidden="true" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm sm:text-base font-extrabold break-words leading-snug">
                                    {isUrgent && (
                                      <span className="mr-1.5 rounded-md bg-rose-600 px-1.5 py-0.5 text-xs font-extrabold text-white align-middle">
                                        เร่งด่วน
                                      </span>
                                    )}
                                    {item.title}
                                  </p>
                                  <p className="mt-0.5 text-xs sm:text-sm opacity-90 break-words">{item.detail}</p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="neutral"
                                  className="shrink-0"
                                  onClick={() => jumpToFollowTarget(item.target)}
                                >
                                  <span>ตรวจสอบ</span>
                                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                                </Button>
                              </li>
                            );
                          })}
                        </ul>
                        {followUps.length > 3 && (
                          <button
                            type="button"
                            onClick={() => setShowAllFollowUps((v) => !v)}
                            className="w-full rounded-xl py-2 text-sm font-extrabold text-purple-800 hover:bg-purple-50 cursor-pointer"
                          >
                            {showAllFollowUps ? 'แสดงน้อยลง' : `ดูทั้งหมด (${followUps.length})`}
                          </button>
                        )}
                      </>
                    )}
                  </Card>

                  {/* 2) ยาวันนี้ */}
                  <Card className="p-4 sm:p-5 shadow-xs space-y-3.5">
                    <PanelHead
                      icon={Pill}
                      tint="bg-purple-100 text-purple-700"
                      title="ยาวันนี้"
                      aside={
                        <button
                          type="button"
                          onClick={() => setActiveTab('meds')}
                          className="text-sm font-extrabold text-purple-800 hover:underline cursor-pointer"
                        >
                          ดูตารางยา ›
                        </button>
                      }
                    />

                    {summaryToday.total === 0 ? (
                      <p className="rounded-xl bg-slate-50 px-3.5 py-3 text-sm sm:text-base text-slate-600">
                        วันนี้ไม่มีมื้อยาที่ต้อง{cw.verb}
                      </p>
                    ) : (
                      <>
                        <div>
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="text-base sm:text-lg font-extrabold text-slate-900 tabular-nums">
                              จัดการแล้ว {doneDoses} จาก {summaryToday.total} มื้อ
                            </p>
                            <p className="text-xs sm:text-sm font-semibold text-slate-500">{fullMeds.length} รายการยา</p>
                          </div>
                          <div
                            className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-purple-100"
                            role="progressbar"
                            aria-valuemin={0}
                            aria-valuemax={summaryToday.total}
                            aria-valuenow={doneDoses}
                            aria-label={`ความคืบหน้าการ${cw.phrase}วันนี้`}
                          >
                            <div
                              className="h-full rounded-full bg-emerald-500 transition-all"
                              style={{ width: `${dosePct}%` }}
                            />
                          </div>
                          {(summaryToday.skipped > 0 || summaryToday.missed > 0) && (
                            <p className="mt-1.5 text-xs sm:text-sm font-semibold text-slate-600">
                              {summaryToday.skipped > 0 && `ข้าม ${summaryToday.skipped} มื้อ`}
                              {summaryToday.skipped > 0 && summaryToday.missed > 0 && ' · '}
                              {summaryToday.missed > 0 && `${cw.notDone} ${summaryToday.missed} มื้อ`}
                            </p>
                          )}
                        </div>

                        {pendingDoses.length === 0 ? (
                          <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-3 text-sm sm:text-base font-bold text-emerald-900">
                            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" aria-hidden="true" />
                            ยืนยันครบทุกมื้อแล้ว
                          </p>
                        ) : (
                          <ul className="space-y-2">
                            {pendingDoses.slice(0, 4).map((d) => (
                              <li
                                key={d.key}
                                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3"
                              >
                                <div className="shrink-0 text-center leading-tight w-14">
                                  <p className="text-base font-extrabold text-slate-900 tabular-nums">{d.time}</p>
                                  <p className="text-xs font-semibold text-slate-500">{PERIOD_LABEL[d.period]}</p>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedMedId(d.med.id)}
                                    className="text-left text-sm sm:text-base font-extrabold text-slate-900 hover:text-purple-800 hover:underline cursor-pointer break-words"
                                  >
                                    {d.med.name}
                                  </button>
                                  <p className="text-xs sm:text-sm text-slate-600">
                                    ครั้งละ {instructionText(d.med)}
                                    {d.late && (
                                      <span className="ml-1.5 font-extrabold text-rose-700">· เลยเวลาแล้ว</span>
                                    )}
                                  </p>
                                </div>
                                {editable && (
                                  <Button
                                    size="sm"
                                    className="shrink-0"
                                    onClick={() => handleToggleTodayDose(d.med, d.period, 'taken')}
                                  >
                                    <Check className="w-4 h-4" aria-hidden="true" />
                                    <span>{doseWords(d.med.form).done}</span>
                                  </Button>
                                )}
                              </li>
                            ))}
                            {pendingDoses.length > 4 && (
                              <li>
                                <button
                                  type="button"
                                  onClick={() => setActiveTab('meds')}
                                  className="w-full rounded-xl py-2 text-sm font-extrabold text-purple-800 hover:bg-purple-50 cursor-pointer"
                                >
                                  ดูอีก {pendingDoses.length - 4} มื้อ
                                </button>
                              </li>
                            )}
                          </ul>
                        )}
                      </>
                    )}
                  </Card>
                </div>

                {/* ---------- คอลัมน์รอง: ข้อมูลอ้างอิง ---------- */}
                <div className="lg:col-span-2 space-y-4 sm:space-y-5">
                  {/* 3) ค่าสุขภาพล่าสุด */}
                  <Card className="p-4 sm:p-5 shadow-xs space-y-1">
                    <PanelHead
                      icon={HeartPulse}
                      tint="bg-sky-100 text-sky-700"
                      title="ค่าสุขภาพล่าสุด"
                      aside={
                        editable ? (
                          <button
                            type="button"
                            onClick={() => openRecord()}
                            className="inline-flex items-center gap-1 text-sm font-extrabold text-purple-800 hover:underline cursor-pointer"
                          >
                            <Plus className="w-4 h-4" aria-hidden="true" />
                            บันทึก
                          </button>
                        ) : null
                      }
                    />
                    <ul className="divide-y divide-slate-100">
                      <li className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-500">ความดันโลหิต</p>
                          <p className="text-lg font-extrabold text-slate-900 tabular-nums">
                            {vitals.bp ? `${vitals.bp.sys}/${vitals.bp.dia}` : <span className="text-slate-400">—</span>}
                            {vitals.bp && <span className="ml-1 text-xs font-bold text-slate-500">mmHg</span>}
                          </p>
                        </div>
                        <Sparkline points={sparkSys} color="#15703A" label="แนวโน้มความดันตัวบน" />
                        <div className="text-right shrink-0">
                          {bpClass && <ClassifiedChip value={bpClass} />}
                          <p className="mt-0.5 text-xs text-slate-500">
                            {vitals.bp?.at ? relativeDateTime(vitals.bp.at) : 'ยังไม่เคยบันทึก'}
                          </p>
                        </div>
                      </li>
                      <li className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-500">ระดับน้ำตาล</p>
                          <p className="text-lg font-extrabold text-slate-900 tabular-nums">
                            {vitals.glucose ? vitals.glucose.value : <span className="text-slate-400">—</span>}
                            {vitals.glucose && <span className="ml-1 text-xs font-bold text-slate-500">มก./ดล.</span>}
                          </p>
                        </div>
                        <Sparkline points={sparkGlu} color="#E8913A" label="แนวโน้มน้ำตาล" />
                        <div className="text-right shrink-0">
                          {gluClass && <ClassifiedChip value={gluClass} />}
                          <p className="mt-0.5 text-xs text-slate-500">
                            {vitals.glucose
                              ? `${GLUCOSE_TIMING_LABEL[vitals.glucose.timing]}${vitals.glucose.at ? ` · ${relativeDateTime(vitals.glucose.at)}` : ''}`
                              : 'ยังไม่เคยบันทึก'}
                          </p>
                        </div>
                      </li>
                      <li className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-500">น้ำหนัก</p>
                          <p className="text-lg font-extrabold text-slate-900 tabular-nums">
                            {vitals.weight ? vitals.weight.kg : <span className="text-slate-400">—</span>}
                            {vitals.weight && <span className="ml-1 text-xs font-bold text-slate-500">กก.</span>}
                          </p>
                        </div>
                        <Sparkline points={sparkWeight} color="#1FA38A" label="แนวโน้มน้ำหนัก" />
                        <div className="text-right shrink-0">
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
                          <p className="mt-0.5 text-xs text-slate-500">
                            {vitals.weight?.at ? relativeDateTime(vitals.weight.at) : 'ยังไม่เคยบันทึก'}
                          </p>
                        </div>
                      </li>
                    </ul>
                    <LatestByCategory readings={allReadings} />
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('history');
                        setHistoryFilter('bp');
                      }}
                      className="w-full rounded-xl py-2 text-sm font-extrabold text-purple-800 hover:bg-purple-50 cursor-pointer"
                    >
                      ดูกราฟและประวัติย้อนหลัง ›
                    </button>
                  </Card>

                  {/* 4) นัดหมายถัดไป */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('history');
                      setHistoryFilter('appointments');
                    }}
                    className="block w-full text-left rounded-[1.5rem] bg-white p-4 sm:p-5 shadow-xs ring-1 ring-purple-100 hover:ring-purple-300 transition cursor-pointer"
                  >
                    <PanelHead
                      icon={Calendar}
                      tint="bg-amber-100 text-amber-700"
                      title="นัดหมายถัดไป"
                      aside={<ChevronRight className="w-5 h-5 text-slate-400" aria-hidden="true" />}
                    />
                    {nextAppt ? (
                      <div className="mt-2.5">
                        <p className="text-base font-extrabold text-slate-900 break-words">{nextAppt.event.title}</p>
                        <p className="mt-0.5 text-sm font-bold text-purple-800">
                          {(() => {
                            const d = daysUntilKey(nextAppt.day);
                            return d === 0 ? 'วันนี้' : d === 1 ? 'พรุ่งนี้' : `อีก ${d} วัน`;
                          })()}
                          {' · '}
                          {thaiDate(nextAppt.day)}
                          {nextAppt.event.allDay ? ' (ทั้งวัน)' : ` · ${nextAppt.event.startTime} น.`}
                        </p>
                        {nextAppt.event.location && (
                          <p className="mt-0.5 text-xs sm:text-sm text-slate-600">{nextAppt.event.location.name}</p>
                        )}
                      </div>
                    ) : (
                      <p className="mt-2.5 text-sm text-slate-600">ยังไม่มีนัดหมายเร็วๆ นี้</p>
                    )}
                  </button>

                  {/* 5) บันทึกอาการล่าสุด */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('history');
                      setHistoryFilter('symptoms');
                    }}
                    className="block w-full text-left rounded-[1.5rem] bg-white p-4 sm:p-5 shadow-xs ring-1 ring-purple-100 hover:ring-purple-300 transition cursor-pointer"
                  >
                    <PanelHead
                      icon={BookHeart}
                      tint="bg-pink-100 text-pink-700"
                      title="บันทึกอาการล่าสุด"
                      aside={<ChevronRight className="w-5 h-5 text-slate-400" aria-hidden="true" />}
                    />
                    {latestPost ? (
                      <div className="mt-2.5">
                        <p className="text-base font-extrabold text-slate-900 line-clamp-2 break-words">
                          {latestPost.symptoms.length > 0
                            ? latestPost.symptoms.join(', ')
                            : latestPost.moodMain
                              ? `อารมณ์: ${moodMeta(latestPost.moodMain)?.label ?? ''}`
                              : latestPost.title || 'บันทึกอาการ'}
                        </p>
                        {latestPost.content && (
                          <p className="mt-0.5 text-sm text-slate-600 line-clamp-2 break-words">{latestPost.content}</p>
                        )}
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {relativeDateTime(latestPost.createdAt)}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-2.5 text-sm text-slate-600">ยังไม่มีบันทึกอาการ</p>
                    )}
                  </button>
                </div>
              </div>

              <p className="flex items-start gap-1.5 px-1 text-xs text-slate-500">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                <span>สถานะนี้เป็นเพียงตัวช่วยจัดลำดับความสำคัญในการดูแล ไม่ใช่การวินิจฉัยโรค</span>
              </p>
              </>
              )}
            </div>
          )}

          {/* ==================== TAB 2: ส่วนจัดการยา (Medication Overview) ==================== */}
          {activeTab === 'meds' && (
            <div className="space-y-5">
              {/* เช็คชื่อมื้อยาวันนี้ (คำกริยาตามรูปแบบยา) */}
              <Card className="shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <SectionTitle icon={Clock}>ตาราง{cw.phrase}วันนี้</SectionTitle>
                    <p className="mt-0.5 text-sm text-slate-600">
                      {cw.done} {summaryToday.taken}/{summaryToday.total} มื้อ · ยังไม่ยืนยัน {summaryToday.unconfirmed} · ข้าม {summaryToday.skipped}
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
                  <EmptyNote>วันนี้ไม่มีมื้อยาที่ต้อง{cw.verb}ตามตาราง</EmptyNote>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {dosesToday.map((d) => (
                      <li
                        key={d.key}
                        className="py-3.5 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-center justify-between gap-3"
                      >
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <span className="inline-flex items-center gap-1 rounded-xl border border-purple-200 bg-purple-50 px-3 py-1.5 text-sm font-extrabold text-purple-900 shrink-0">
                            <Clock className="w-4 h-4 text-purple-700" />
                            {PERIOD_LABEL[d.period]} {d.time} น.
                          </span>
                          <div className="min-w-0 flex-1">
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

                        <div className="flex flex-wrap items-center justify-between md:justify-end gap-2 shrink-0 w-full md:w-auto pt-2.5 md:pt-0 border-t border-slate-100 md:border-t-0">
                          <DoseStateChip state={d.state} form={d.med.form} />
                          {editable && (
                            <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 shrink-0">
                              <button
                                type="button"
                                title={`ยืนยันว่า${doseWords(d.med.form).done}`}
                                onClick={() => handleToggleTodayDose(d.med, d.period, 'taken')}
                                className={cn(
                                  'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-extrabold transition-colors cursor-pointer',
                                  d.state === 'taken'
                                    ? 'bg-emerald-600 text-white'
                                    : 'text-slate-700 hover:bg-emerald-100'
                                )}
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>{doseWords(d.med.form).done}</span>
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
                                title={doseWords(d.med.form).notDone}
                                onClick={() => handleToggleTodayDose(d.med, d.period, 'missed')}
                                className={cn(
                                  'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-extrabold transition-colors cursor-pointer',
                                  d.state === 'missed'
                                    ? 'bg-rose-600 text-white'
                                    : 'text-slate-700 hover:bg-rose-100'
                                )}
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>{doseWords(d.med.form).notDone}</span>
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
                    <SectionTitle icon={Pill}>รายการยาที่สมาชิกต้อง{cw.verb} ({fullMeds.length})</SectionTitle>
                    <p className="mt-0.5 text-sm text-slate-600">
                      กดที่รายการยาเพื่อดูรายละเอียด สรรพคุณ และประวัติการ{cw.phrase}ย้อนหลัง
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
                              ขนาดที่ใช้: ครั้งละ {instructionText(med)}
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
                                  <DoseStateChip state={d.state} form={d.med.form} className="px-2 py-0.5 text-xs" />
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
                <div className="fit-row justify-between">
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
                    <DateField
                      id="history-from"
                      label="ตั้งแต่วันที่"
                      value={customRange.from}
                      onChange={(val) => setCustomRange((prev) => ({ ...prev, from: val }))}
                    />
                    <DateField
                      id="history-to"
                      label="ถึงวันที่"
                      value={customRange.to}
                      onChange={(val) => setCustomRange((prev) => ({ ...prev, to: val }))}
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
                      { id: 'symptoms', label: `บันทึกประจำวัน (${postsInRange.length})` },
                      { id: 'bp', label: `ความดันโลหิต (${bpReadings.length})` },
                      { id: 'glucose', label: `ระดับน้ำตาล (${gluReadings.length})` },
                      { id: 'weight', label: `น้ำหนัก (${weightReadings.length})` },
                      { id: 'other', label: `ค่าอื่น ๆ และผลตรวจ (${extraCount})` },
                      { id: 'meds', label: `การ${cw.phrase} (${doseReport.days.length} วัน)` },
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
                  <SectionTitle icon={BookHeart}>บันทึกประจำวัน (อาการ อารมณ์ และค่าที่วัด)</SectionTitle>
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
                                  {p.moodMain && <MoodDino mood={p.moodMain} className="h-6 w-6 -my-1 shrink-0" />}
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
                            {hasVitals(p.vitals) && (
                              <div className="flex flex-wrap gap-1.5">
                                {vitalChips(p.vitals).map((c) => (
                                  <span
                                    key={c.key}
                                    className="rounded-full bg-sky-soft border border-sky-200 px-2.5 py-0.5 text-xs font-extrabold text-sky-900 tabular-nums"
                                  >
                                    {c.label} {c.value}
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
                      <Button size="sm" variant="soft" onClick={() => openRecord()}>
                        + บันทึกความดัน
                      </Button>
                    )}
                  </div>
                  {bpReadings.length === 0 ? (
                    <EmptyNote>ไม่มีประวัติการวัดความดันโลหิตในช่วงเวลานี้</EmptyNote>
                  ) : (
                    <>
                    <TrendBlock
                      label="ความดันโลหิต"
                      unit="mmHg"
                      series={[
                        { label: 'ตัวบน', color: '#15703A', points: sysSeries },
                        { label: 'ตัวล่าง', color: '#E5557A', points: diaSeries },
                      ]}
                    />
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
                    </>
                  )}
                </Card>
              )}

              {/* 3) ประวัติระดับน้ำตาล */}
              {(historyFilter === 'all' || historyFilter === 'glucose') && (
                <Card className="shadow-xs space-y-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <SectionTitle icon={Droplet}>ประวัติระดับน้ำตาลในเลือด</SectionTitle>
                    {editable && (
                      <Button size="sm" variant="soft" onClick={() => openRecord()}>
                        + บันทึกค่าน้ำตาล
                      </Button>
                    )}
                  </div>
                  {gluReadings.length === 0 ? (
                    <EmptyNote>ไม่มีประวัติการตรวจระดับน้ำตาลในช่วงเวลานี้</EmptyNote>
                  ) : (
                    <>
                    <TrendBlock
                      label="ระดับน้ำตาล"
                      unit="มก./ดล."
                      series={[{ label: 'น้ำตาล', color: '#E8913A', points: gluSeries }]}
                    />
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
                    </>
                  )}
                </Card>
              )}

              {/* 4) ประวัติน้ำหนัก */}
              {(historyFilter === 'all' || historyFilter === 'weight') && (
                <Card className="shadow-xs space-y-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <SectionTitle icon={Scale}>ประวัติน้ำหนักตัว</SectionTitle>
                    {editable && (
                      <Button size="sm" variant="soft" onClick={() => openRecord()}>
                        + บันทึกน้ำหนัก
                      </Button>
                    )}
                  </div>
                  {weightReadings.length === 0 ? (
                    <EmptyNote>ไม่มีประวัติการชั่งน้ำหนักในช่วงเวลานี้</EmptyNote>
                  ) : (
                    <>
                    <TrendBlock
                      label="น้ำหนัก"
                      unit="กก."
                      decimals={1}
                      series={[{ label: 'น้ำหนัก', color: '#1FA38A', points: weightSeries }]}
                    />
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
                    </>
                  )}
                </Card>
              )}

              {/* 4.5) ค่าสุขภาพอื่น ๆ พร้อมกราฟ */}
              {(historyFilter === 'all' || historyFilter === 'other') && (
                <ExtraMetricsHistory readings={readingsInRange} editable={editable} onAdd={() => openRecord()} />
              )}

              {/* 5) ประวัติการกิน/ใช้ยา (คำตามรูปแบบยา) */}
              {(historyFilter === 'all' || historyFilter === 'meds') && (
                <Card className="shadow-xs space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <SectionTitle icon={Activity}>ประวัติการ{cw.phrase}</SectionTitle>
                    {doseReport.adherence !== null && (
                      <span className="rounded-full bg-purple-50 border border-purple-200 px-3 py-1 text-xs sm:text-sm font-extrabold text-purple-900">
                        ความสม่ำเสมอ {doseReport.adherence}% ({cw.done} {doseReport.totals.taken}/{doseReport.totals.expected - doseReport.totals.skipped} มื้อ)
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
                                <DoseStateChip state={e.state} form={e.med.form} className="px-2 py-0.5 text-xs" />
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

      {composer.element}

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
