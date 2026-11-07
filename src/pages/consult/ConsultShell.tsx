import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { ModeBanner } from '../../components/consult/ConsultUI';
import { cn } from '../../lib/cn';

const TABS = [
  { to: '/consult', label: 'ศูนย์ปรึกษา', end: true },
  { to: '/consult/history', label: 'ประวัติและติดตามผล', end: false },
];

/** กรอบของทุกหน้าในระบบปรึกษา (ฝั่งผู้ใช้) */
export const ConsultShell: React.FC = () => (
  <div className="space-y-5">
    <nav aria-label="เมนูระบบปรึกษา" className="grid grid-cols-2 gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            cn('flex min-h-[48px] items-center justify-center rounded-xl px-2 text-center text-base font-bold transition-colors', isActive ? 'bg-purple-700 text-white' : 'text-slate-700 hover:bg-white')
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
    <ModeBanner />
    <Outlet />
  </div>
);
