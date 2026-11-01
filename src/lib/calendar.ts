import type { Attachment } from './onboarding';

const CALENDAR_KEY = 'growa_calendar_v1';

export type RepeatUnit = 'day' | 'week' | 'month' | 'year';
export type RepeatEnd = 'never' | 'on' | 'after';

export interface RepeatRule {
  every: number;
  unit: RepeatUnit;
  endMode: RepeatEnd;
  /** yyyy-mm-dd (ใช้เมื่อ endMode = on) */
  endDate: string;
  /** จำนวนครั้งรวมครั้งแรก (ใช้เมื่อ endMode = after) */
  count: number;
}

export interface EventLocation {
  name: string;
  address1: string;
  address2: string;
  country: string;
  state: string;
  city: string;
  zip: string;
}

export interface EventComment {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  /** ปักธงแดง = สำคัญ */
  important: boolean;
  tags: string[];
  allDay: boolean;
  /** yyyy-mm-dd */
  startDate: string;
  /** HH:mm (ว่างเมื่อเป็นกิจกรรมทั้งวัน) */
  startTime: string;
  endDate: string;
  endTime: string;
  timeZone: string;
  /** เตือนก่อนเริ่มกี่นาที (null = ไม่เตือน) */
  reminderMinutes: number | null;
  repeat: RepeatRule | null;
  location: EventLocation | null;
  /** รหัสสมาชิกที่รับผิดชอบหรืออาสา */
  assignees: string[];
  needVolunteer: boolean;
  attachments: Attachment[];
  comments: EventComment[];
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string | null;
}

/** กิจกรรมหนึ่งครั้งที่ปรากฏบนวันใดวันหนึ่ง (กิจกรรมทำซ้ำหรือหลายวันจะมีหลาย occurrence) */
export interface Occurrence {
  event: CalendarEvent;
  /** วันที่แสดง yyyy-mm-dd */
  day: string;
  /** ลำดับวันของกิจกรรมหลายวัน เริ่มที่ 0 */
  dayIndex: number;
  /** จำนวนวันที่กิจกรรมนี้คร่อม (1 = วันเดียว) */
  totalDays: number;
}

export const REMINDER_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'ตอนเริ่ม' },
  { value: 5, label: 'ก่อน 5 นาที' },
  { value: 10, label: 'ก่อน 10 นาที' },
  { value: 15, label: 'ก่อน 15 นาที' },
  { value: 30, label: 'ก่อน 30 นาที' },
  { value: 60, label: 'ก่อน 1 ชั่วโมง' },
  { value: 120, label: 'ก่อน 2 ชั่วโมง' },
  { value: 1440, label: 'ก่อน 1 วัน' },
  { value: 2880, label: 'ก่อน 2 วัน' },
];

export const REPEAT_UNIT_LABEL: Record<RepeatUnit, string> = {
  day: 'วัน',
  week: 'สัปดาห์',
  month: 'เดือน',
  year: 'ปี',
};

// ---------- วันที่ ----------

export const pad = (n: number) => String(n).padStart(2, '0');

/** yyyy-mm-dd ตามเวลาท้องถิ่น (ไม่ใช้ toISOString เพราะจะเลื่อนวันตามโซนเวลา) */
export const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const parseKey = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** ตัดเวลาออก เหลือเที่ยงคืนของวันนั้น (ใช้เทียบวันที่เท่านั้น) */
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

/** บวกเดือน ถ้าเดือนปลายทางสั้นกว่าให้ใช้วันสุดท้ายของเดือน (เช่น 31 ม.ค. + 1 เดือน = 28 ก.พ.) */
export const addMonths = (d: Date, n: number) => {
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  return new Date(
    target.getFullYear(),
    target.getMonth(),
    Math.min(d.getDate(), daysInMonth(target.getFullYear(), target.getMonth()))
  );
};

export const diffDays = (a: Date, b: Date) =>
  Math.round(
    (Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) -
      Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) /
      86_400_000
  );

export const isSameDay = (a: Date, b: Date) => dateKey(a) === dateKey(b);

// ---------- การทำซ้ำ ----------

const nthStart = (start: Date, n: number, rule: RepeatRule) => {
  const every = Math.max(1, rule.every);
  switch (rule.unit) {
    case 'day':
      return addDays(start, n * every);
    case 'week':
      return addDays(start, n * every * 7);
    case 'month':
      return addMonths(start, n * every);
    case 'year':
      return addMonths(start, n * every * 12);
  }
};

/** วันเริ่มของทุกครั้งที่กิจกรรมเกิดขึ้นและคาบเกี่ยวช่วง [from, to] */
export function occurrenceStarts(event: CalendarEvent, fromInput: Date, toInput: Date): Date[] {
  const from = startOfDay(fromInput);
  const to = startOfDay(toInput);
  const start = parseKey(event.startDate);
  const span = Math.max(0, diffDays(start, parseKey(event.endDate)));
  const overlaps = (s: Date) => addDays(s, span) >= from && s <= to;
  const rule = event.repeat;

  if (!rule) return overlaps(start) ? [start] : [];

  const limitDate = rule.endMode === 'on' && rule.endDate ? parseKey(rule.endDate) : null;
  const maxCount = rule.endMode === 'after' ? Math.max(1, rule.count) : Infinity;
  const result: Date[] = [];

  // กิจกรรมรายวัน/รายสัปดาห์ที่เริ่มนานแล้ว: ข้ามรอบที่อยู่ก่อนช่วงที่ดูอยู่
  let n = 0;
  if (rule.unit === 'day' || rule.unit === 'week') {
    const step = Math.max(1, rule.every) * (rule.unit === 'week' ? 7 : 1);
    n = Math.max(0, Math.floor((diffDays(start, from) - span) / step) - 1);
  }

  for (; n < maxCount && n < 5000; n++) {
    const s = nthStart(start, n, rule);
    if (s > to) break;
    if (limitDate && s > limitDate) break;
    if (overlaps(s)) result.push(s);
  }
  return result;
}

const sortOccurrences = (a: Occurrence, b: Occurrence) => {
  if (a.event.allDay !== b.event.allDay) return a.event.allDay ? -1 : 1;
  if (a.event.important !== b.event.important) return a.event.important ? -1 : 1;
  return (
    a.event.startTime.localeCompare(b.event.startTime) || a.event.title.localeCompare(b.event.title, 'th')
  );
};

/** จัดกิจกรรมเป็นรายวันในช่วง [from, to] */
export function eventsByDay(
  events: CalendarEvent[],
  fromInput: Date,
  toInput: Date
): Map<string, Occurrence[]> {
  const from = startOfDay(fromInput);
  const to = startOfDay(toInput);
  const map = new Map<string, Occurrence[]>();
  for (const event of events) {
    const span = Math.max(0, diffDays(parseKey(event.startDate), parseKey(event.endDate)));
    for (const start of occurrenceStarts(event, from, to)) {
      for (let i = 0; i <= span; i++) {
        const day = addDays(start, i);
        if (day < from || day > to) continue;
        const key = dateKey(day);
        map.set(key, [...(map.get(key) ?? []), { event, day: key, dayIndex: i, totalDays: span + 1 }]);
      }
    }
  }
  for (const list of map.values()) list.sort(sortOccurrences);
  return map;
}

// ---------- ข้อความแสดงผล ----------

/** ช่วงเวลาของกิจกรรมในวันนั้น เช่น "ทั้งวัน" "09:00–10:00" */
export function timeLabel(occ: Occurrence): string {
  const { event, dayIndex, totalDays } = occ;
  if (event.allDay) return 'ทั้งวัน';
  if (totalDays === 1) return `${event.startTime}–${event.endTime} น.`;
  if (dayIndex === 0) return `เริ่ม ${event.startTime} น.`;
  if (dayIndex === totalDays - 1) return `สิ้นสุด ${event.endTime} น.`;
  return 'ทั้งวัน';
}

export function repeatLabel(rule: RepeatRule): string {
  const unit = REPEAT_UNIT_LABEL[rule.unit];
  const base = rule.every === 1 ? `ทุก${unit}` : `ทุก ${rule.every} ${unit}`;
  if (rule.endMode === 'on' && rule.endDate) {
    return `${base} จนถึง ${parseKey(rule.endDate).toLocaleDateString('th-TH', { dateStyle: 'long' })}`;
  }
  if (rule.endMode === 'after') return `${base} รวม ${rule.count} ครั้ง`;
  return base;
}

export function reminderLabel(minutes: number): string {
  return (
    REMINDER_OPTIONS.find((o) => o.value === minutes)?.label.replace('ก่อน', 'เตือนก่อน') ??
    `เตือนก่อน ${minutes} นาที`
  );
}

export const reminderText = (minutes: number) => (minutes === 0 ? 'เตือนตอนเริ่ม' : reminderLabel(minutes));

export function locationLines(loc: EventLocation): string {
  return [loc.address1, loc.address2, loc.city, loc.state, loc.zip, loc.country]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' ');
}

// ---------- เก็บข้อมูล ----------

export function loadEvents(): CalendarEvent[] {
  try {
    const item = localStorage.getItem(CALENDAR_KEY);
    if (item) return JSON.parse(item) as CalendarEvent[];
  } catch {
    // ข้อมูลเสีย: เริ่มใหม่
  }
  return [];
}

export function saveEvents(events: CalendarEvent[]): void {
  try {
    localStorage.setItem(CALENDAR_KEY, JSON.stringify(events));
  } catch (err) {
    console.error('Failed to save calendar to localStorage', err);
  }
}

export function clearCalendar(): void {
  try {
    localStorage.removeItem(CALENDAR_KEY);
  } catch {
    // ข้ามได้
  }
}

export const emptyLocation = (): EventLocation => ({
  name: '',
  address1: '',
  address2: '',
  country: 'ประเทศไทย',
  state: '',
  city: '',
  zip: '',
});

export const defaultRepeat = (startDate: string): RepeatRule => ({
  every: 1,
  unit: 'day',
  endMode: 'never',
  endDate: startDate,
  count: 10,
});
