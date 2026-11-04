import { loadHomeData } from './storage';
import { loadHomeSetup } from './homeSetup';
import { loadOnboarding } from './onboarding';
import { DEFAULT_COUNTRY } from '../data/addressOptions';
import { DEFAULT_TIME_ZONE } from '../data/timeZones';
import { cloudEnabled } from '../cloud/client';
import { CURRENT_MEMBER_ID as CLOUD_MEMBER_ID } from '../cloud/identity';
import { queueSync } from '../cloud/queue';

/**
 * ข้อมูลหน้าตั้งค่าของต้นแบบ เก็บใน localStorage (ยังไม่มีเซิร์ฟเวอร์)
 * ทุกค่าที่นี่เป็นข้อมูลสมมติ ใช้เพื่อทดลองการใช้งานเท่านั้น
 */
const SETTINGS_KEY = 'growa_settings_v1';

export type FontScale = 'normal' | 'large' | 'xlarge';
/** บทบาทในบ้าน: owner มีได้คนเดียว (ผู้สร้างบ้านหรือผู้ที่ได้รับมอบ) */
export type MemberRole = 'owner' | 'member' | 'external';
export type LowStockDays = 3 | 5 | 7 | 10;
/** เพศของสมาชิก (ใช้แสดงบนบัตรสมาชิก) */
export type Gender = 'male' | 'female' | 'other';

export interface HouseholdMember {
  id: string;
  name: string;
  /** ความสัมพันธ์กับเจ้าของบ้าน เช่น ลูกสาว พี่ชาย */
  relation: string;
  role: MemberRole;
  /** อายุ (ปี) ไม่ระบุ = null */
  age?: number | null;
  /** เพศ ว่าง = ไม่ระบุ */
  gender?: Gender | '';
  /** รูปโปรไฟล์ (data URL ที่ย่อแล้ว) ว่าง = ใช้ตัวอักษรแรกของชื่อ */
  photo?: string;
}

export interface ReminderSettings {
  /** เตือนเมื่อยาใกล้หมด */
  lowStock: boolean;
  /** เตือนในช่วงเวลากินยา */
  doseWindow: boolean;
  /** เตือนก่อนถึงวันนัดหมอ */
  appointment: boolean;
  /** เตือนเมื่อยาเหลือกี่วัน (ค่าเริ่มต้น 7) */
  lowStockDays: LowStockDays;
  /** เตือนซ้ำได้กี่ครั้งต่อมื้อยา (1–10 ครั้ง ตั้งได้ตามต้องการ) */
  repeatCount: number;
  /** เว้นระยะระหว่างการเตือนแต่ละครั้ง (นาที) */
  repeatIntervalMinutes: number;
  /** ตั้งแต่การเตือนครั้งที่ 2 ถ้ายังไม่กินยา ให้แจ้งทุกคนในบ้านด้วย */
  escalateToFamily: boolean;
}

/** ข้อมูลส่วนตัวในหน้า "โปรไฟล์ของฉัน" (นอกเหนือจากชื่อเล่น) */
export interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  /** ซ่อนอีเมลจากสมาชิกคนอื่นในบ้าน */
  hideEmail: boolean;
  timeZone: string;
  phone: string;
  address1: string;
  address2: string;
  country: string;
  /** จังหวัด (ถ้าเลือกประเทศไทย) หรือรัฐ/แคว้นที่พิมพ์เอง */
  state: string;
  city: string;
  zip: string;
  /** รูปโปรไฟล์ (data URL ที่ย่อแล้ว) ว่าง = ไม่มีรูป */
  photo: string;
}

/** ข้อมูลของบ้าน (ระบบบ้าน ทุกคนในบ้านเห็น) นอกเหนือจากชื่อบ้านและรหัสชวน */
export interface HomeInfo {
  /** รูปบ้าน (data URL ที่ย่อแล้ว) ว่าง = ไม่มีรูป */
  photo: string;
  /** ภาพพื้นหลังบ้าน (แบนเนอร์ที่มุมบนซ้ายของแอป เหมือนแบนเนอร์เซิร์ฟเวอร์ใน Discord) data URL ที่ย่อแล้ว ว่าง = ไม่มี */
  banner?: string;
  timeZone: string;
  address1: string;
  address2: string;
  country: string;
  state: string;
  city: string;
  zip: string;
  /** โรคและภาวะสุขภาพของคนในบ้าน ใช้ให้คำแนะนำเฉพาะบ้าน */
  conditions: string[];
  /** false = ปิดใช้งานบ้านชั่วคราว */
  active: boolean;
  /** ผู้ที่บ้านนี้ดูแล (ตั้งตอนสร้างบ้าน) */
  recipient?: { firstName: string; lastName: string };
}

export interface AppSettings {
  profile: UserProfile;
  home: HomeInfo;
  nickname: string;
  homeName: string;
  /** รหัสชวน 6 หลัก */
  inviteCode: string;
  members: HouseholdMember[];
  reminders: ReminderSettings;
  fontScale: FontScale;
}

/** ผู้ใช้ที่กำลังใช้งานอยู่ (เจ้าของบัญชีนี้) */
export const CURRENT_MEMBER_ID = CLOUD_MEMBER_ID;

export const FONT_SCALES: { value: FontScale; label: string; px: number }[] = [
  { value: 'normal', label: 'ปกติ', px: 18 },
  { value: 'large', label: 'ใหญ่', px: 22 },
  { value: 'xlarge', label: 'ใหญ่มาก', px: 26 },
];

export const LOW_STOCK_DAY_OPTIONS: LowStockDays[] = [3, 5, 7, 10];

/** จำนวนครั้งที่เตือนซ้ำได้ต่อมื้อ (ผู้ใช้ตั้งเท่าไรก็ได้ในช่วงนี้) */
export const REPEAT_COUNT_MIN = 1;
export const REPEAT_COUNT_MAX = 10;
/** ตัวเลือก "เว้นกี่นาทีต่อครั้ง" ถ้าค่าที่บันทึกไว้ไม่อยู่ในลิสต์ หน้าตั้งค่าจะแสดงค่านั้นเพิ่มเอง */
export const REPEAT_INTERVAL_OPTIONS = [5, 10, 15, 30, 60];

export interface RoleMeta {
  label: string;
  description: string;
  /** สีจุดหน้าชื่อบทบาท (คล้ายบทบาทใน Discord) */
  dot: string;
}

export const ROLE_ORDER: MemberRole[] = ['owner', 'member', 'external'];

export const ROLE_META: Record<MemberRole, RoleMeta> = {
  owner: {
    label: 'ผู้ดูแลหลักของบ้าน',
    description: 'เห็นหน้าตั้งค่าบ้าน จัดการบ้านและมอบบทบาทได้ ทำได้ทุกอย่าง มีได้แค่คนเดียว (ผู้สร้างบ้าน)',
    dot: 'bg-amber-500',
  },
  member: {
    label: 'สมาชิกในบ้าน',
    description: 'ใช้งานทุกอย่างในบ้านได้ ยกเว้นหน้าตั้งค่าบ้านและการมอบบทบาท',
    dot: 'bg-purple-500',
  },
  external: {
    label: 'ผู้ดูแลภายนอก',
    description: 'เช่น พยาบาลหรือผู้ดูแลที่มาช่วย สิทธิ์เท่าสมาชิกในบ้าน',
    dot: 'bg-teal-500',
  },
};

/** แปลงข้อมูลสมาชิกที่เคยบันทึกไว้แบบเก่า (permission / isOwner) เป็น role และให้มีเจ้าของบ้านคนเดียวเสมอ */
function normalizeMembers(raw: unknown[], fallback: HouseholdMember[]): HouseholdMember[] {
  const valid = (r: unknown): r is MemberRole => r === 'owner' || r === 'member' || r === 'external';
  const members = raw.map((item) => {
    const m = item as HouseholdMember & { isOwner?: boolean };
    const role: MemberRole = valid(m.role) ? m.role : m.isOwner ? 'owner' : 'member';
    const { isOwner: _legacyOwner, ...rest } = m as HouseholdMember & { isOwner?: boolean; permission?: string };
    delete (rest as { permission?: string }).permission;
    return { ...rest, role } as HouseholdMember;
  });
  if (members.length === 0) return fallback;
  // โหมดคลาวด์: บทบาทมาจากเซิร์ฟเวอร์ ไม่ต้องเดาเจ้าของบ้านเอง
  if (cloudEnabled) return members;
  const firstOwner = members.findIndex((m) => m.role === 'owner');
  const ownerIndex = firstOwner >= 0 ? firstOwner : Math.max(0, members.findIndex((m) => m.id === CURRENT_MEMBER_ID));
  return members.map((m, i) =>
    i === ownerIndex ? { ...m, role: 'owner' } : m.role === 'owner' ? { ...m, role: 'member' } : m
  );
}

const DEFAULT_INVITE_CODE = '482916';

const isLowStockDays = (value: unknown): value is LowStockDays =>
  LOW_STOCK_DAY_OPTIONS.includes(value as LowStockDays);

const isFontScale = (value: unknown): value is FontScale =>
  FONT_SCALES.some((option) => option.value === value);

/** ชื่อเล่นของผู้ใช้จากบัญชีที่ล็อกอิน (ใช้เป็นค่าเริ่มต้นเท่านั้น) */
const readAuthEmail = (): string => {
  try {
    const raw = localStorage.getItem('growa_auth_user');
    const email = raw ? (JSON.parse(raw) as { email?: string }).email : '';
    return typeof email === 'string' ? email.trim() : '';
  } catch {
    return '';
  }
};

/** ค่าเริ่มต้นของโปรไฟล์: ดึงจากข้อมูลที่ผู้ใช้เคยกรอกตอนสมัครและตอนกรอกข้อมูลพื้นฐาน */
export function defaultProfile(): UserProfile {
  const onboarding = loadOnboarding().profile;
  const fullName = (onboarding.fullName || readAuthName()).trim();
  const [firstName = '', ...rest] = fullName.split(/\s+/);
  return {
    firstName,
    lastName: rest.join(' '),
    email: readAuthEmail(),
    hideEmail: false,
    timeZone: DEFAULT_TIME_ZONE,
    phone: onboarding.phone ?? '',
    address1: onboarding.address ?? '',
    address2: '',
    country: DEFAULT_COUNTRY,
    state: '',
    city: '',
    zip: '',
    photo: '',
  };
}

const readAuthName = (): string => {
  try {
    const raw = localStorage.getItem('growa_auth_user');
    if (!raw) return '';
    const name = (JSON.parse(raw) as { name?: string }).name;
    return typeof name === 'string' ? name.trim().slice(0, 20) : '';
  } catch {
    return '';
  }
};

const readHomeName = (): string => {
  const fromHomeData = loadHomeData().homeName?.trim();
  const fromSetup = loadHomeSetup()?.homeName?.trim();
  return fromHomeData || fromSetup || (cloudEnabled ? '' : 'บ้านสุขใจ (ครอบครัว)');
};

/** สร้างรหัสชวน 6 หลักแบบสุ่ม (ต้นแบบ: ยังไม่มีเซิร์ฟเวอร์ตรวจความซ้ำ) */
export function generateInviteCode(): string {
  const [value] = crypto.getRandomValues(new Uint32Array(1));
  return String(100000 + (value % 900000));
}

export function defaultHome(): HomeInfo {
  return {
    photo: '',
    timeZone: loadHomeSetup()?.timeZone || DEFAULT_TIME_ZONE,
    address1: '',
    address2: '',
    country: DEFAULT_COUNTRY,
    state: '',
    city: '',
    zip: '',
    conditions: [],
    active: true,
  };
}

export function defaultSettings(): AppSettings {
  const nickname = readAuthName() || 'ฉัน';
  return {
    profile: defaultProfile(),
    home: defaultHome(),
    nickname,
    homeName: readHomeName(),
    inviteCode: cloudEnabled ? '' : DEFAULT_INVITE_CODE,
    members: cloudEnabled
      ? [{ id: CURRENT_MEMBER_ID, name: nickname, relation: 'ฉัน', role: 'member' }]
      : [
          { id: CURRENT_MEMBER_ID, name: nickname, relation: 'ฉัน', role: 'owner' },
          { id: 'mint', name: 'น้องมิ้นท์', relation: 'ลูกสาว', role: 'member' },
          { id: 'chai', name: 'พี่ชัย', relation: 'พี่ชาย', role: 'member' },
          { id: 'daeng', name: 'ป้าแดง', relation: 'ป้า', role: 'external' },
        ],
    reminders: { lowStock: true, doseWindow: true, appointment: true, lowStockDays: 7, repeatCount: 3, escalateToFamily: true, repeatIntervalMinutes: 15 },
    fontScale: 'normal',
  };
}

/** อ่านค่าที่บันทึกไว้ ถ้าข้อมูลไม่ครบหรือเสียหายให้ใช้ค่าเริ่มต้นแทน */
export function loadSettings(): AppSettings {
  const base = defaultSettings();
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return base;

    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    const members = Array.isArray(parsed.members)
      ? normalizeMembers(parsed.members, base.members)
      : base.members;
    const reminders = { ...base.reminders, ...(parsed.reminders ?? {}) };

    return {
      nickname:
        typeof parsed.nickname === 'string' && parsed.nickname.trim() ? parsed.nickname : base.nickname,
      homeName:
        typeof parsed.homeName === 'string' && parsed.homeName.trim() ? parsed.homeName : base.homeName,
      inviteCode: /^\d{6,8}$/.test(parsed.inviteCode ?? '') ? parsed.inviteCode! : base.inviteCode,
      members,
      reminders: {
        lowStock: !!reminders.lowStock,
        doseWindow: !!reminders.doseWindow,
        appointment: !!reminders.appointment,
        lowStockDays: isLowStockDays(reminders.lowStockDays) ? reminders.lowStockDays : 7,
        repeatCount:
          typeof reminders.repeatCount === 'number'
            ? Math.min(REPEAT_COUNT_MAX, Math.max(REPEAT_COUNT_MIN, Math.round(reminders.repeatCount)))
            : 3,
        escalateToFamily: reminders.escalateToFamily !== false,
        repeatIntervalMinutes:
          typeof reminders.repeatIntervalMinutes === 'number'
            ? Math.min(120, Math.max(1, Math.round(reminders.repeatIntervalMinutes)))
            : 15,
      },
      fontScale: isFontScale(parsed.fontScale) ? parsed.fontScale : 'normal',
      profile: { ...base.profile, ...(parsed.profile ?? {}) },
      home: { ...base.home, ...(parsed.home ?? {}) },
    };
  } catch (err) {
    console.error('Failed to load settings from localStorage', err);
    return base;
  }
}

export const SETTINGS_CHANGED_EVENT = 'growa-settings-changed';

export function saveSettings(settings: AppSettings): AppSettings {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save settings to localStorage', err);
  }
  // แจ้งส่วนอื่นของแอป (เช่นแถบบน) ให้อัปเดตรูปและชื่อ
  window.dispatchEvent(new Event(SETTINGS_CHANGED_EVENT));
  queueSync('settings');
  return settings;
}

/** คืนค่าตั้งต้นทั้งหมด (ใช้ในเครื่องมือทดสอบ) */
export function resetSettings(): void {
  try {
    localStorage.removeItem(SETTINGS_KEY);
  } catch (err) {
    console.error('Failed to reset settings in localStorage', err);
  }
  applyFontScale('normal');
}

/** ปรับขนาดตัวอักษรทั้งแอปผ่าน attribute ที่ <html> (ดู index.css) */
export function applyFontScale(scale: FontScale): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-font-scale', scale);
}

/** ชื่อเรียกขนาดตัวอักษร เช่น "ใหญ่" */
export function fontScaleLabel(scale: FontScale): string {
  return FONT_SCALES.find((option) => option.value === scale)?.label ?? 'ปกติ';
}

/** สมาชิกที่ตรงกับผู้ใช้ปัจจุบัน */
export function getCurrentMember(settings: AppSettings): HouseholdMember | undefined {
  return settings.members.find((member) => member.id === CURRENT_MEMBER_ID);
}

/** บทบาทของผู้ใช้ปัจจุบัน */
export const roleOf = (settings: AppSettings): MemberRole => getCurrentMember(settings)?.role ?? 'member';

/** เห็นหน้าตั้งค่าบ้านและมอบบทบาทได้เฉพาะผู้ดูแลหลักของบ้าน */
export const canManageHome = (settings: AppSettings): boolean => roleOf(settings) === 'owner';
