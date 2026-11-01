import { Home, Pill, Calendar, CalendarDays, NotebookPen, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  /** แสดงไอคอนหน้าชื่อเมนูใน Sidebar (เมนูอื่นแสดงเฉพาะชื่อ) เมนูล่างบนมือถือแสดงไอคอนทุกเมนูเสมอ */
  sidebarIcon?: boolean;
  /** ชื่อสั้นสำหรับเมนูล่างบนมือถือ (พื้นที่จำกัด) ไม่ระบุ = ใช้ label */
  mobileLabel?: string;
}

/** รายการเมนูหลัก ใช้ร่วมกันระหว่าง Sidebar และเมนูล่างบนมือถือ */
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'หน้าหลัก', icon: Home, end: true },
  { to: '/meds', label: 'ตู้ยา', icon: Pill },
  { to: '/appointments', label: 'นัดหมอ', icon: Calendar },
  { to: '/calendar', label: 'ปฏิทิน', icon: CalendarDays, sidebarIcon: true },
  { to: '/journal', label: 'บันทึกอาการ', mobileLabel: 'บันทึก', icon: NotebookPen, sidebarIcon: true },
  { to: '/settings', label: 'ตั้งค่า', icon: Settings },
];
