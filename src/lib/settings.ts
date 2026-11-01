import { loadHomeData } from './storage';
import { loadHomeSetup } from './homeSetup';

/**
 * ข้อมูลหน้าตั้งค่าของต้นแบบ เก็บใน localStorage (ยังไม่มีเซิร์ฟเวอร์)
 * ทุกค่าที่นี่เป็นข้อมูลสมมติ ใช้เพื่อทดลองการใช้งานเท่านั้น
 */
const SETTINGS_KEY = 'growa_settings_v1';

export type FontScale = 'normal' | 'large' | 'xlarge';
export type MemberPermission = 'edit' | 'view';
export type LowStockDays = 3 | 5 | 7 | 10;

export interface HouseholdMember {
  id: string;
  name: string;
  /** ความสัมพันธ์กับเจ้าของบ้าน เช่น ลูกสาว พี่ชาย */
  relation: string;
  permission: MemberPermission;
  /** ผู้ดูแลหลัก (เจ้าของบ้าน) เปลี่ยนหรือนำตัวเองออกไม่ได้ */
  isOwner: boolean;
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
}

export interface AppSettings {
  nickname: string;
  homeName: string;
  /** รหัสชวน 6 หลัก */
  inviteCode: string;
  members: HouseholdMember[];
  reminders: ReminderSettings;
  fontScale: FontScale;
}

/** ผู้ใช้ที่กำลังใช้งานอยู่ (เจ้าของบัญชีนี้) */
export const CURRENT_MEMBER_ID = 'me';

export const FONT_SCALES: { value: FontScale; label: string; px: number }[] = [
  { value: 'normal', label: 'ปกติ', px: 18 },
  { value: 'large', label: 'ใหญ่', px: 20 },
  { value: 'xlarge', label: 'ใหญ่มาก', px: 22 },
];

export const LOW_STOCK_DAY_OPTIONS: LowStockDays[] = [3, 5, 7, 10];

export const PERMISSION_LABELS: Record<MemberPermission, string> = {
  edit: 'แก้ไขได้',
  view: 'ดูอย่างเดียว',
};

const DEFAULT_INVITE_CODE = '482916';

const isLowStockDays = (value: unknown): value is LowStockDays =>
  LOW_STOCK_DAY_OPTIONS.includes(value as LowStockDays);

const isFontScale = (value: unknown): value is FontScale =>
  FONT_SCALES.some((option) => option.value === value);

/** ชื่อเล่นของผู้ใช้จากบัญชีที่ล็อกอิน (ใช้เป็นค่าเริ่มต้นเท่านั้น) */
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
  return fromHomeData || fromSetup || 'บ้านสุขใจ (ครอบครัว)';
};

/** สร้างรหัสชวน 6 หลักแบบสุ่ม (ต้นแบบ: ยังไม่มีเซิร์ฟเวอร์ตรวจความซ้ำ) */
export function generateInviteCode(): string {
  const [value] = crypto.getRandomValues(new Uint32Array(1));
  return String(100000 + (value % 900000));
}

export function defaultSettings(): AppSettings {
  const nickname = readAuthName() || 'ฉัน';
  return {
    nickname,
    homeName: readHomeName(),
    inviteCode: DEFAULT_INVITE_CODE,
    members: [
      { id: CURRENT_MEMBER_ID, name: nickname, relation: 'ฉัน', permission: 'edit', isOwner: true },
      { id: 'mint', name: 'น้องมิ้นท์', relation: 'ลูกสาว', permission: 'edit', isOwner: false },
      { id: 'chai', name: 'พี่ชัย', relation: 'พี่ชาย', permission: 'view', isOwner: false },
      { id: 'daeng', name: 'ป้าแดง', relation: 'ป้า', permission: 'view', isOwner: false },
    ],
    reminders: { lowStock: true, doseWindow: true, appointment: true, lowStockDays: 7 },
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
    const members = Array.isArray(parsed.members) && parsed.members.length > 0 ? parsed.members : base.members;
    const reminders = { ...base.reminders, ...(parsed.reminders ?? {}) };

    return {
      nickname: typeof parsed.nickname === 'string' && parsed.nickname.trim() ? parsed.nickname : base.nickname,
      homeName: typeof parsed.homeName === 'string' && parsed.homeName.trim() ? parsed.homeName : base.homeName,
      inviteCode: /^\d{6}$/.test(parsed.inviteCode ?? '') ? parsed.inviteCode! : base.inviteCode,
      members,
      reminders: {
        lowStock: !!reminders.lowStock,
        doseWindow: !!reminders.doseWindow,
        appointment: !!reminders.appointment,
        lowStockDays: isLowStockDays(reminders.lowStockDays) ? reminders.lowStockDays : 7,
      },
      fontScale: isFontScale(parsed.fontScale) ? parsed.fontScale : 'normal',
    };
  } catch (err) {
    console.error('Failed to load settings from localStorage', err);
    return base;
  }
}

export function saveSettings(settings: AppSettings): AppSettings {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save settings to localStorage', err);
  }
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
