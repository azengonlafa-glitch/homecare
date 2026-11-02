import React from 'react';
import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from './navItems';
import { cn } from '../../lib/cn';
import { canManageHome } from '../../lib/settings';
import { useSettings } from '../../lib/useSettings';

/**
 * เมนูล่างสำหรับมือถือและแท็บเล็ต (ซ่อนเมื่อจอกว้าง lg: 1024px ขึ้นไป ซึ่งใช้ Sidebar ซ้ายแทน)
 * - แถบสีขาวลอยเหนือขอบจอ มุมโค้งเต็ม (pill) มีเงา
 * - แต่ละเมนูเป็นวงกลม ไอคอนล้วน (ชื่อเมนูอ่านโดย screen reader ผ่าน aria-label)
 * - เมนูที่เปิดอยู่เป็นวงกลมสีม่วงไล่เฉด พร้อมเรืองแสงอ่อน ๆ
 */
export const MobileNav: React.FC = () => {
  const isOwner = canManageHome(useSettings());
  const VISIBLE_ITEMS = NAV_ITEMS.filter((item) => !item.hidden && (isOwner || !item.ownerOnly));

  return (
    <nav
      aria-label="เมนูหลักบนมือถือ"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none"
    >
      <ul className="pointer-events-auto mx-auto flex w-full max-w-md items-center gap-0.5 rounded-full bg-white p-1.5 shadow-[0_10px_30px_rgba(15,23,42,0.18)] ring-1 ring-slate-200">
        {VISIBLE_ITEMS.map(({ to, label, mobileLabel, icon: Icon, end }) => (
          <li key={to} className="flex flex-1 min-w-0 justify-center">
            <NavLink
              to={to}
              end={end}
              aria-label={mobileLabel ?? label}
              className={({ isActive }) =>
                cn(
                  'flex aspect-square w-full max-w-[3.25rem] items-center justify-center rounded-full transition-all duration-200',
                  isActive
                    ? 'bg-gradient-to-br from-violet-500 via-purple-600 to-purple-700 text-white shadow-[0_0_16px_rgba(147,51,234,0.45)]'
                    : 'bg-slate-100 text-slate-700 hover:bg-purple-50 hover:text-purple-800 active:bg-purple-100'
                )
              }
            >
              <Icon className="w-6 h-6" strokeWidth={2.2} aria-hidden="true" />
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
};
