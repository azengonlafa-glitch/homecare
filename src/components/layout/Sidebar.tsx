import React from 'react';
import { NavLink } from 'react-router-dom';
import { BrandMark } from './BrandMark';
import { NAV_ITEMS } from './navItems';
import { cn } from '../../lib/cn';

/**
 * Sidebar ซ้าย: แท็บเล็ต (md) แสดงเฉพาะไอคอน, จอคอม (lg) แสดงไอคอน + ชื่อเมนู
 * มือถือซ่อน แล้วใช้ MobileNav แทน
 */
export const Sidebar: React.FC = () => (
  <aside className="hidden md:flex md:w-20 lg:w-64 shrink-0 flex-col sticky top-0 h-dvh bg-white border-r border-slate-200">
    <div className="h-16 shrink-0 flex items-center justify-center lg:justify-start px-3 lg:px-5 border-b border-slate-200">
      <BrandMark compact />
    </div>

    <nav aria-label="เมนูหลัก" className="flex-1 overflow-y-auto p-3">
      <p className="hidden lg:block px-3 pt-2 pb-2 text-xs font-semibold text-slate-500">
        เมนูหลัก
      </p>
      <ul className="space-y-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center justify-center lg:justify-start gap-3 min-h-[48px] px-3 rounded-xl text-base transition-colors',
                  isActive
                    ? 'bg-purple-100 text-purple-800 font-semibold'
                    : 'font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                )
              }
            >
              <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
              <span className="sr-only lg:not-sr-only">{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>

    <div className="hidden lg:block shrink-0 border-t border-slate-200 p-5">
      <p className="text-xs text-slate-500 leading-relaxed">
        ดูแลยาและสุขภาพของครอบครัว
      </p>
    </div>
  </aside>
);
