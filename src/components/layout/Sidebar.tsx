import React from 'react';
import { NavLink } from 'react-router-dom';
import { BrandMark } from './BrandMark';
import { NAV_ITEMS } from './navItems';
import { cn } from '../../lib/cn';

/**
 * Sidebar ซ้าย: แสดงชื่อเมนูขนาดตัวอักษรใหญ่ อ่านง่ายสำหรับผู้สูงอายุ (ไอคอนแสดงเฉพาะเมนูที่ตั้ง sidebarIcon ไว้)
 */
export const Sidebar: React.FC = () => (
  <aside className="hidden md:flex md:w-60 lg:w-72 shrink-0 flex-col sticky top-0 h-dvh bg-white border-r border-slate-200">
    <div className="h-20 shrink-0 flex items-center px-4 lg:px-6 border-b border-slate-200">
      <BrandMark />
    </div>

    <nav aria-label="เมนูหลัก" className="flex-1 overflow-y-auto p-4">
      <ul className="space-y-2">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end, sidebarIcon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 min-h-[54px] px-4 rounded-2xl text-lg transition-all',
                  isActive
                    ? 'bg-purple-100 text-purple-900 font-bold shadow-xs'
                    : 'font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                )
              }
            >
              {sidebarIcon && <Icon className="w-6 h-6 shrink-0" aria-hidden="true" />}
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>

    <div className="hidden lg:block shrink-0 border-t border-slate-200 p-6">
      <p className="text-sm text-slate-500 leading-relaxed font-medium">
        ดูแลยาและสุขภาพของครอบครัว
      </p>
    </div>
  </aside>
);
