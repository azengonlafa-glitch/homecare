import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Home, Pill, Calendar } from 'lucide-react';

export const AppLayout: React.FC = () => {
  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto bg-white shadow-sm border-x border-slate-200">
      {/* ส่วนหัวแอป */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-purple-700">Growa Homecare</h1>
          <p className="text-sm text-slate-600">ดูแลยาของครอบครัว</p>
        </div>
        <NavLink
          to="/login"
          className="text-sm font-medium text-purple-700 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition-colors"
        >
          เข้าสู่ระบบ
        </NavLink>
      </header>

      {/* ส่วนเนื้อหาหลัก */}
      <main className="flex-1 p-4 pb-24 overflow-y-auto">
        <Outlet />
      </main>

      {/* เมนูล่าง 3 แท็บตามข้อกำหนด: มือถือก่อน เมนูล่าง 3 แท็บมีไอคอนและข้อความ ปุ่มสูงอย่างน้อย 48px */}
      <nav 
        aria-label="เมนูหลัก"
        className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-200 z-30 shadow-lg px-2 py-1"
      >
        <div className="grid grid-cols-3 gap-1">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex flex-col items-center justify-center min-h-[48px] py-1 rounded-xl font-medium transition-colors ${
                isActive
                  ? 'text-purple-700 bg-purple-50 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 active:bg-slate-100'
              }`
            }
          >
            <Home className="w-6 h-6 mb-0.5" strokeWidth={2.2} />
            <span className="text-xs">หน้าหลัก</span>
          </NavLink>

          <NavLink
            to="/meds"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center min-h-[48px] py-1 rounded-xl font-medium transition-colors ${
                isActive
                  ? 'text-purple-700 bg-purple-50 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 active:bg-slate-100'
              }`
            }
          >
            <Pill className="w-6 h-6 mb-0.5" strokeWidth={2.2} />
            <span className="text-xs">ตู้ยา</span>
          </NavLink>

          <NavLink
            to="/appointments"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center min-h-[48px] py-1 rounded-xl font-medium transition-colors ${
                isActive
                  ? 'text-purple-700 bg-purple-50 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 active:bg-slate-100'
              }`
            }
          >
            <Calendar className="w-6 h-6 mb-0.5" strokeWidth={2.2} />
            <span className="text-xs">นัดหมอ</span>
          </NavLink>
        </div>
      </nav>
    </div>
  );
};

