import { Pill, Calendar, CalendarDays, NotebookPen, Settings, HeartPulse, House, Stethoscope, Users, Bell, FolderOpen } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ArtKey } from './ModeIcon';

/** home = ระบบบ้าน (ทุกคนในบ้านเห็นสิ่งที่เราทำ) · personal = ส่วนตัว (เห็นเฉพาะเรา) */
export type NavGroup = 'home' | 'personal';

export const NAV_GROUP_META: Record<NavGroup, { title: string; hint: string }> = {
  home: { title: 'ระบบบ้าน', hint: 'ทุกคนในบ้านเห็น' },
  personal: { title: 'ส่วนตัว', hint: 'เห็นเฉพาะคุณ' },
};

/** สีวงไอคอนของแต่ละเมนู (พื้นพาสเทล ไอคอนสีเข้ม) */
export type NavTint = 'sun' | 'coral' | 'mint' | 'sky' | 'lilac' | 'cream';

export const NAV_TINT: Record<NavTint, string> = {
  sun: 'bg-sun text-slate-900',
  coral: 'bg-coral text-slate-900',
  mint: 'bg-mint text-slate-900',
  sky: 'bg-sky text-slate-900',
  lilac: 'bg-purple-200 text-purple-900',
  cream: 'bg-peach text-slate-900',
};

export interface NavItem {
  /** ไอคอนภาพวาดสไตล์การ์ตูนแบน (ใช้ในเมนูล่าง Sidebar และหน้าโหมดทั้งหมด) */
  art: ArtKey;
  tint: NavTint;
  group: NavGroup;
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  /** แสดงไอคอนหน้าชื่อเมนูใน Sidebar (เมนูอื่นแสดงเฉพาะชื่อ) เมนูล่างบนมือถือแสดงไอคอนทุกเมนูเสมอ */
  sidebarIcon?: boolean;
  /** ซ่อนจากเมนูทั้ง Sidebar และเมนูล่างบนมือถือ */
  hidden?: boolean;
  /** อยู่บนเมนูล่างของมือถือ (เฉพาะโหมดสำคัญ) โหมดที่เหลือเข้าผ่านปุ่ม "โหมดทั้งหมด" ซึ่งพาไปหน้า /menu */
  mobilePrimary?: boolean;
  /** คำอธิบายสั้นใต้ชื่อโหมดในหน้า "โหมดทั้งหมด" */
  description?: string;
  /** เห็นเฉพาะผู้ดูแลหลักของบ้าน */
  ownerOnly?: boolean;
  /** ชื่อสั้นสำหรับเมนูล่างบนมือถือ (พื้นที่จำกัด) ไม่ระบุ = ใช้ label */
  mobileLabel?: string;
}

/** รายการเมนูหลัก เรียงตามลำดับ: บันทึกอาการ -> ปฏิทิน -> ตั้งค่าบ้าน */
export const NAV_ITEMS: NavItem[] = [
  { group: 'home', tint: 'sun', to: '/journal', art: 'journal', label: 'บันทึกอาการ', mobileLabel: 'บันทึก', icon: NotebookPen, sidebarIcon: true, mobilePrimary: true, description: 'บันทึกอาการและอารมณ์ของคนในบ้าน' },
  { group: 'home', tint: 'sky', to: '/calendar', art: 'calendar', label: 'ปฏิทิน', icon: CalendarDays, sidebarIcon: true, mobilePrimary: true, description: 'กิจกรรมและนัดหมายของครอบครัว' },
  { group: 'home', tint: 'sky', to: '/appointments', art: 'calendar', label: 'นัดหมอ', icon: Calendar, hidden: true },
  {
    group: 'home',
    tint: 'coral',
    to: '/members', art: 'members',
    label: 'สมาชิกในบ้าน',
    mobileLabel: 'สมาชิก',
    icon: Users,
    sidebarIcon: true,
    description: 'ดูข้อมูลและตารางยาของแต่ละคน',
  },
  {
    group: 'home',
    tint: 'mint',
    to: '/home-settings', art: 'house',
    label: 'ตั้งค่าบ้าน',
    mobileLabel: 'บ้าน',
    icon: House,
    sidebarIcon: true,
    ownerOnly: true,
    description: 'จัดการบ้านและคนในบ้าน',
  },
  { group: 'personal', tint: 'coral', to: '/meds', art: 'meds', label: 'ยาและการดูแล', mobileLabel: 'ยา/ดูแล', icon: Pill, sidebarIcon: true, mobilePrimary: true, description: 'ตารางยาและการกินยาของคุณ' },
  { group: 'personal', tint: 'sun', to: '/notifications', art: 'bell', label: 'การแจ้งเตือน', mobileLabel: 'แจ้งเตือน', icon: Bell, sidebarIcon: true, description: 'การแจ้งเตือนทั้งหมด' },
  { group: 'personal', tint: 'cream', to: '/folders', art: 'folder', label: 'โฟลเดอร์เอกสาร', mobileLabel: 'โฟลเดอร์', icon: FolderOpen, sidebarIcon: true, description: 'เก็บใบสั่งยา ผลตรวจ และเอกสาร' },
  { group: 'personal', tint: 'coral', to: '/health', art: 'health', label: 'ข้อมูลสุขภาพ', mobileLabel: 'สุขภาพ', icon: HeartPulse, sidebarIcon: true, description: 'ข้อมูลสุขภาพและภาพรวมของคุณ' },
  { group: 'personal', tint: 'lilac', to: '/consult', art: 'consult', label: 'ปรึกษาผู้เชี่ยวชาญ', mobileLabel: 'ปรึกษา', icon: Stethoscope, sidebarIcon: true, description: 'ปรึกษาเภสัชกรและผู้เชี่ยวชาญ' },
  { group: 'personal', tint: 'mint', to: '/settings', art: 'settings', label: 'ตั้งค่าส่วนตัว', mobileLabel: 'ตั้งค่า', icon: Settings, sidebarIcon: true, description: 'ขนาดตัวอักษร บัญชี และอื่นๆ' },
];

/** หน้ารวมโหมดทั้งหมด (ปุ่มสุดท้ายของเมนูล่างบนมือถือ) */
export const MENU_PATH = '/menu';
