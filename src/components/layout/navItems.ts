import { Home, Pill, Calendar } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

/** รายการเมนูหลัก ใช้ร่วมกันระหว่าง Sidebar และเมนูล่างบนมือถือ */
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'หน้าหลัก', icon: Home, end: true },
  { to: '/meds', label: 'ตู้ยา', icon: Pill },
  { to: '/appointments', label: 'นัดหมอ', icon: Calendar },
];
