import type { JournalPost } from './journal';
import { loadMemberRecord, saveMemberRecord, type GlucoseTiming, type MemberRecord, type VitalReading } from './members';
import { loadOnboarding, saveOnboarding } from './onboarding';
import { CURRENT_MEMBER_ID, type HouseholdMember } from './settings';
import { ALL_METRICS, METRIC_CATEGORIES, formatMetric, metricValue, shortLabel, type MetricCategoryId } from './vitalMetrics';

/**
 * บันทึกประจำวัน = โพสต์ในบันทึกอาการ ที่ใส่ค่าสุขภาพได้ด้วย (ความดัน น้ำตาล น้ำหนัก ชีพจร ฯลฯ)
 * ค่าสุขภาพของโพสต์ถูกคัดลอกเป็น "ประวัติค่าสุขภาพ" ของสมาชิกคนนั้น (record.vitals โดยมี postId ผูกไว้)
 * จึงขึ้นกราฟพัฒนาการในหน้าสมาชิกทันที และแก้/ลบโพสต์แล้วประวัติเปลี่ยนตาม
 */

/** ค่าสุขภาพที่วัดได้ในหนึ่งครั้ง (ไม่ใส่ = ไม่ได้วัด) */
export interface VitalValues {
  /** เวลาที่วัด (ISO) ไม่ใส่ = เวลาที่โพสต์ */
  at?: string;
  systolic?: number;
  diastolic?: number;
  glucose?: number;
  glucoseTiming?: GlucoseTiming;
  weightKg?: number;
  pulseBpm?: number;
  spo2?: number;
  tempC?: number;
  hba1c?: number;
  waistCm?: number;
  painScore?: number;
  sleepHours?: number;
  /** ค่าอื่นตามรหัสใน vitalMetrics (ผลตรวจเลือด อัตราการหายใจ น้ำเข้า-ออก ฯลฯ) */
  more?: Record<string, number>;
}

/** ค่าในช่องกรอก (ข้อความตามที่ผู้ใช้พิมพ์) ตามรหัสของแต่ละค่าใน ALL_METRICS */
export interface VitalDraft {
  nums: Record<string, string>;
  glucoseTiming: GlucoseTiming;
  /** วัน/เวลาที่วัด รูปแบบ datetime-local ว่าง = ตอนบันทึก */
  at: string;
}

export const emptyVitalDraft = (): VitalDraft => ({ nums: {}, glucoseTiming: 'fasting', at: '' });

export const toLocalInput = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** ค่าเดิมของโพสต์ -> ช่องกรอก (ใช้ตอนแก้ไขโพสต์) */
export function draftFromVitals(v: VitalValues | null | undefined): VitalDraft {
  const draft = emptyVitalDraft();
  if (!v) return draft;
  for (const metric of ALL_METRICS) {
    const n = metricValue(v, metric);
    if (n != null) draft.nums[metric.key] = String(n);
  }
  if (v.glucoseTiming) draft.glucoseTiming = v.glucoseTiming;
  if (v.at) draft.at = toLocalInput(new Date(v.at));
  return draft;
}

export const hasVitals = (v: VitalValues | null | undefined): v is VitalValues =>
  !!v && ALL_METRICS.some((metric) => metricValue(v, metric) != null);

/** จำนวนช่องที่กรอกไว้ (ทั้งหมด หรือเฉพาะหมวด) */
export const filledCount = (d: VitalDraft, category?: MetricCategoryId) =>
  ALL_METRICS.filter((metric) => (!category || metric.category === category) && (d.nums[metric.key] ?? '').trim() !== '').length;

export const draftHasValues = (d: VitalDraft) => filledCount(d) > 0;

export type ParseResult = { ok: true; values: VitalValues | null } | { ok: false; error: string; category?: MetricCategoryId };

/** ตรวจและแปลงช่องกรอก: ไม่กรอกเลย = null (ไม่ใช่ข้อผิดพลาด เพราะค่าสุขภาพไม่บังคับ) */
export function parseVitalDraft(draft: VitalDraft, now = Date.now()): ParseResult {
  const values: VitalValues = {};
  const more: Record<string, number> = {};
  for (const metric of ALL_METRICS) {
    const raw = (draft.nums[metric.key] ?? '').trim();
    if (!raw) continue;
    const n = Number(raw.replace(',', '.'));
    if (!Number.isFinite(n) || n < metric.min || n > metric.max) {
      return {
        ok: false,
        category: metric.category,
        error: `${shortLabel(metric)}ควรอยู่ระหว่าง ${metric.min}–${metric.max}${metric.unit ? ` ${metric.unit}` : ''} กรุณาตรวจสอบตัวเลขอีกครั้ง`,
      };
    }
    if (metric.field) values[metric.field] = n;
    else more[metric.key] = n;
  }
  if (Object.keys(more).length > 0) values.more = more;
  if ((values.systolic == null) !== (values.diastolic == null)) {
    return { ok: false, category: 'vitals', error: 'กรุณากรอกความดันทั้งตัวบนและตัวล่างให้ครบ' };
  }
  if (!hasVitals(values)) return { ok: true, values: null };
  if (values.glucose != null) values.glucoseTiming = draft.glucoseTiming;
  if (draft.at) {
    const at = new Date(draft.at);
    if (Number.isNaN(at.getTime())) return { ok: false, error: 'กรุณาเลือกวันและเวลาที่วัดให้ถูกต้อง' };
    if (at.getTime() > now + 5 * 60_000) return { ok: false, error: 'วันและเวลาที่วัดต้องไม่เป็นอนาคต' };
    values.at = at.toISOString();
  }
  return { ok: true, values };
}

/** ป้ายสั้น ๆ ของค่าแต่ละตัว ใช้แสดงในโพสต์ */
export function vitalChips(v: VitalValues): { key: string; label: string; value: string; category: MetricCategoryId }[] {
  const out: { key: string; label: string; value: string; category: MetricCategoryId }[] = [];
  if (v.systolic != null && v.diastolic != null) {
    out.push({ key: 'bp', label: 'ความดัน', value: `${v.systolic}/${v.diastolic} mmHg`, category: 'vitals' });
  }
  for (const metric of ALL_METRICS) {
    if (metric.key === 'systolic' || metric.key === 'diastolic') continue;
    const n = metricValue(v, metric);
    if (n == null) continue;
    let value = formatMetric(metric, n);
    if (metric.key === 'glucose') {
      value += v.glucoseTiming === 'fasting' ? ' (ก่อนอาหาร)' : v.glucoseTiming === 'after-meal' ? ' (หลังอาหาร)' : '';
    }
    out.push({ key: metric.key, label: metric.key === 'glucose' ? 'น้ำตาล' : shortLabel(metric), value, category: metric.category });
  }
  // เรียงตามลำดับหมวด
  const order = METRIC_CATEGORIES.map((c) => c.id);
  return out.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
}

/** โพสต์นี้เป็นของสมาชิกคนไหน (ใช้ชื่อในช่อง "บันทึกของใคร") ไม่พบ = null */
export function memberIdForAbout(about: string, members: HouseholdMember[], selfLabel = 'ตัวฉันเอง'): string | null {
  if (!about || about === selfLabel) return CURRENT_MEMBER_ID;
  return members.find((m) => m.name === about)?.id ?? null;
}

/** อัปเดตค่าล่าสุดที่หน้าอื่นใช้ (ความดัน น้ำตาล น้ำหนัก) จากการวัดล่าสุดที่มีค่านั้น */
function withLatest(record: MemberRecord, vitals: VitalReading[]): MemberRecord {
  const newest = <T,>(pick: (r: VitalReading) => T | undefined) => {
    let best: VitalReading | null = null;
    for (const r of vitals) if (pick(r) != null && (!best || r.at > best.at)) best = r;
    return best;
  };
  const bp = newest((r) => (r.systolic != null && r.diastolic != null ? r.systolic : undefined));
  const glu = newest((r) => r.glucose);
  const wt = newest((r) => r.weightKg);
  return {
    ...record,
    vitals,
    weightKg: wt?.weightKg ?? record.weightKg,
    health: {
      ...record.health,
      bloodPressure: bp ? `${bp.systolic}/${bp.diastolic}` : record.health.bloodPressure,
      bloodSugar: glu ? String(glu.glucose) : record.health.bloodSugar,
    },
  };
}

/**
 * เขียนค่าสุขภาพของโพสต์ลงประวัติของสมาชิก (แทนที่ค่าเดิมของโพสต์เดียวกัน)
 * values = null คือโพสต์ไม่มีค่าสุขภาพแล้ว -> ลบค่าเดิมของโพสต์ออก
 */
export function syncPostVitals(
  memberId: string,
  post: Pick<JournalPost, 'id' | 'createdAt' | 'authorName'>,
  values: VitalValues | null
): void {
  const record = loadMemberRecord(memberId);
  const others = (record.vitals ?? []).filter((r) => r.postId !== post.id);
  const reading: VitalReading | null = hasVitals(values)
    ? {
        ...values,
        id: `vital-post-${post.id}`,
        at: values.at ?? post.createdAt,
        postId: post.id,
        byName: post.authorName,
      }
    : null;
  if (!reading && others.length === (record.vitals ?? []).length) return; // ไม่มีอะไรเปลี่ยน
  const next = withLatest(record, reading ? [reading, ...others] : others);
  saveMemberRecord(next);

  // ของตัวเอง: ค่าในแบบสอบถามสุขภาพตอนสมัครเป็นค่าล่าสุดด้วย
  if (memberId === CURRENT_MEMBER_ID && reading && (record.vitals ?? []).every((r) => r.at <= reading.at)) {
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
}

/** ลบค่าสุขภาพของโพสต์ออกจากประวัติของทุกคน (ใช้ตอนลบโพสต์ หรือเปลี่ยนว่าเป็นบันทึกของใคร) */
export function removePostVitals(postId: string, memberIds: string[]): void {
  for (const id of memberIds) {
    const record = loadMemberRecord(id);
    if (!(record.vitals ?? []).some((r) => r.postId === postId)) continue;
    saveMemberRecord(withLatest(record, (record.vitals ?? []).filter((r) => r.postId !== postId)));
  }
}

// ---------- สรุปพัฒนาการสำหรับหน้าสมาชิก ----------

/** อาการที่พบบ่อยในช่วงนี้ เรียงจากมากไปน้อย */
export function symptomFrequency(posts: JournalPost[], limit = 6): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const p of posts) for (const s of new Set(p.symptoms)) map.set(s, (map.get(s) ?? 0) + 1);
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'th'))
    .slice(0, limit);
}

export interface DayCell {
  /** YYYY-MM-DD */
  day: string;
  /** อารมณ์ของโพสต์ล่าสุดในวันนั้นที่ระบุอารมณ์ */
  mood: JournalPost['moodMain'];
  /** จำนวนอาการ (ไม่ซ้ำ) ที่บันทึกในวันนั้น */
  symptoms: number;
  /** จำนวนบันทึกในวันนั้น */
  posts: number;
}

/** ข้อมูลรายวันสำหรับปฏิทินพัฒนาการ: อารมณ์และจำนวนอาการของแต่ละวันในช่วง */
export function dayCells(posts: JournalPost[], dayKeys: string[], keyOf: (iso: string) => string): DayCell[] {
  const byDay = new Map<string, JournalPost[]>();
  for (const p of posts) {
    const k = keyOf(p.createdAt);
    byDay.set(k, [...(byDay.get(k) ?? []), p]);
  }
  return dayKeys.map((day) => {
    const list = byDay.get(day) ?? [];
    const withMood = list.filter((p) => p.moodMain).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return {
      day,
      mood: withMood[0]?.moodMain ?? null,
      symptoms: new Set(list.flatMap((p) => p.symptoms)).size,
      posts: list.length,
    };
  });
}
