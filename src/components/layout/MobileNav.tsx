import React from 'react';
import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from './navItems';
import { cn } from '../../lib/cn';

/** เมนูล่าง 3 แท็บ แสดงเฉพาะมือถือ (ต่ำกว่า md) */
export const MobileNav: React.FC = () => (
  <nav
    aria-label="เมนูหลักบนมือถือ"
    className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]"
  >
    <ul className="grid grid-cols-3 gap-1 max-w-md mx-auto">
      {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
        <li key={to}>
          <NavLink
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center min-h-[56px] py-1 rounded-xl transition-colors',
                isActive
                  ? 'text-purple-700 bg-purple-50 font-semibold'
                  : 'font-medium text-slate-600 hover:text-slate-900 active:bg-slate-100'
              )
            }
          >
            <Icon className="w-6 h-6 mb-0.5" strokeWidth={2.2} aria-hidden="true" />
            <span className="text-xs">{label}</span>
          </NavLink>
        </li>
      ))}
    </ul>
  </nav>
);
