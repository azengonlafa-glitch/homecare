import { Pill, Calendar, CalendarDays, NotebookPen, Settings, HeartPulse, House, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/** home = ระบบบ้าน (ทุกคนในบ้านเห็นสิ่งที่เราทำ) · personal = ส่วนตัว (เห็นเฉพาะเรา) */
export type NavGroup = 'home' | 'personal';

export const NAV_GROUP_META: Record<NavGroup, { title: string; hint: string }> = {
  home: { title: 'ระบบบ้าน', hint: 'ทุกคนในบ้านเห็น' },
  personal: { title: 'ส่วนตัว', hint: 'เห็นเฉพาะคุณ' },
};

export interface NavItem {
  group: NavGroup;
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  /** แสดงไอคอนหน้าชื่อเมนูใน Sidebar (เมนูอื่นแสดงเฉพาะชื่อ) เมนูล่างบนมือถือแสดงไอคอนทุกเมนูเสมอ */
  sidebarIcon?: boolean;
  /** ซ่อนจากเมนูทั้ง Sidebar และเมนูล่างบนมือถือ */
  hidden?: boolean;
  /** เห็นเฉพาะผู้ดูแลหลักของบ้าน */
  ownerOnly?: boolean;
  /** ชื่อสั้นสำหรับเมนูล่างบนมือถือ (พื้นที่จำกัด) ไม่ระบุ = ใช้ label */
  mobileLabel?: string;
}

/** รายการเมนูหลัก เรียงตามลำดับ: บันทึกอาการ -> ปฏิทิน -> ตั้งค่าบ้าน */
export const NAV_ITEMS: NavItem[] = [
  { group: 'home', to: '/journal', label: 'บันทึกอาการ', mobileLabel: 'บันทึก', icon: NotebookPen, sidebarIcon: true },
  { group: 'home', to: '/calendar', label: 'ปฏิทิน', icon: CalendarDays, sidebarIcon: true },
  { group: 'home', to: '/appointments', label: 'นัดหมอ', icon: Calendar, hidden: true },
  {
    group: 'home',
    to: '/members',
    label: 'สมาชิกในบ้าน',
    mobileLabel: 'สมาชิก',
    icon: Users,
    sidebarIcon: true,
  },
  {
    group: 'home',
    to: '/home-settings',
    label: 'ตั้งค่าบ้าน',
    mobileLabel: 'บ้าน',
    icon: House,
    sidebarIcon: true,
    ownerOnly: true,
  },
  { group: 'personal', to: '/meds', label: 'ยาและการดูแล', mobileLabel: 'ยา/ดูแล', icon: Pill, sidebarIcon: true },
  { group: 'personal', to: '/health', label: 'ข้อมูลสุขภาพ', mobileLabel: 'สุขภาพ', icon: HeartPulse, sidebarIcon: true },
  { group: 'personal', to: '/settings', label: 'ตั้งค่าส่วนตัว', mobileLabel: 'ตั้งค่า', icon: Settings, sidebarIcon: true },
];
