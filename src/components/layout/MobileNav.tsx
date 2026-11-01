import React from 'react';
import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from './navItems';
import { cn } from '../../lib/cn';

/** เมนูล่าง 3 แท็บ แสดงเฉพาะมือถือ (ต่ำกว่า md) ปุ่มใหญ่ สัมผัสง่าย */
export const MobileNav: React.FC = () => (
  <nav
    aria-label="เมนูหลักบนมือถือ"
    className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
  >
    <ul
      className="grid gap-1 max-w-md mx-auto"
      style={{ gridTemplateColumns: `repeat(${NAV_ITEMS.length}, minmax(0, 1fr))` }}
    >
      {NAV_ITEMS.map(({ to, label, mobileLabel, icon: Icon, end }) => (
        <li key={to}>
          <NavLink
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center min-h-[60px] py-1 rounded-2xl transition-colors',
                isActive
                  ? 'text-purple-700 bg-purple-50 font-bold'
                  : 'font-semibold text-slate-600 hover:text-slate-900 active:bg-slate-100'
              )
            }
          >
            <Icon className="w-7 h-7 mb-0.5" strokeWidth={2.3} aria-hidden="true" />
            {/* 5 แท็บต้องพอดีจอ 360px: ใช้ขนาดคงที่ ไม่ขยายตามขนาดตัวอักษรของแอป */}
            {/* 6 แท็บต้องพอดีจอ 360px: ขยายตามขนาดตัวอักษรของแอป แต่ไม่เกิน 4.2% ของความกว้างจอ ป้ายจึงไม่ชนกัน */}
            <span className="[font-size:min(0.8333rem,4.2vw)] leading-tight whitespace-nowrap">{mobileLabel ?? label}</span>
          </NavLink>
        </li>
      ))}
    </ul>
  </nav>
);
