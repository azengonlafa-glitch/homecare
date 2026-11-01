import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Home, Pill, Calendar, LogIn } from 'lucide-react';

export const AppLayout: React.FC = () => {
  // ดึงข้อมูลผู้ใช้จาก localStorage ถ้ามี
  const savedUser = localStorage.getItem('growa_auth_user');
  const user = savedUser ? JSON.parse(savedUser) : null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900">
      {/* ส่วนหัวแอป (Responsive Header) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* โลโก้และชื่อแอป */}
          <NavLink to="/" className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-700 flex items-center justify-center text-white shadow-sm shadow-purple-200">
              <Pill className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xl font-bold text-purple-700 tracking-tight block leading-tight">
                Growa Homecare
              </span>
              <span className="text-xs text-slate-500 hidden sm:block">
                ดูแลยาและสุขภาพของครอบครัว
              </span>
            </div>
          </NavLink>

          {/* เมนูนำทางบนหน้าจอคอมพิวเตอร์ (Desktop Navigation Bar) */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `flex items-center space-x-2 px-4 py-2 rounded-xl text-base font-medium transition-all ${
                  isActive
                    ? 'bg-purple-100 text-purple-800 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`
              }
            >
              <Home className="w-5 h-5" />
              <span>หน้าหลัก</span>
            </NavLink>

            <NavLink
              to="/meds"
              className={({ isActive }) =>
                `flex items-center space-x-2 px-4 py-2 rounded-xl text-base font-medium transition-all ${
                  isActive
                    ? 'bg-purple-100 text-purple-800 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`
              }
            >
              <Pill className="w-5 h-5" />
              <span>ตู้ยา</span>
            </NavLink>

            <NavLink
              to="/appointments"
              className={({ isActive }) =>
                `flex items-center space-x-2 px-4 py-2 rounded-xl text-base font-medium transition-all ${
                  isActive
                    ? 'bg-purple-100 text-purple-800 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`
              }
            >
              <Calendar className="w-5 h-5" />
              <span>นัดหมอ</span>
            </NavLink>
          </nav>

          {/* ส่วนผู้ใช้ / เข้าสู่ระบบ */}
          <div className="flex items-center space-x-3">
            {user ? (
              <div className="flex items-center space-x-2 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-xl">
                <div className="w-7 h-7 rounded-full bg-purple-700 text-white flex items-center justify-center text-xs font-bold">
                  {user.name ? user.name.slice(0, 1) : 'U'}
                </div>
                <span className="text-sm font-semibold text-purple-900 hidden sm:inline">
                  {user.name || user.email}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem('growa_auth_user');
                    window.location.reload();
                  }}
                  className="text-xs text-slate-500 hover:text-red-600 ml-1 underline cursor-pointer"
                  title="ออกจากระบบ"
                >
                  ออก
                </button>
              </div>
            ) : (
              <NavLink
                to="/login"
                className="flex items-center space-x-1.5 min-h-[44px] text-sm sm:text-base font-semibold text-purple-700 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-xs"
              >
                <LogIn className="w-4 h-4" />
                <span>เข้าสู่ระบบ</span>
              </NavLink>
            )}
          </div>
        </div>
      </header>

      {/* ส่วนเนื้อหาหลัก (Responsive Main Container ขยายกว้างขึ้นบนจอคอม) */}
      <main className="flex-1 w-full max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 pb-24 md:pb-8">
        <Outlet />
      </main>

      {/* เมนูล่าง 3 แท็บสำหรับมือถือ (แสดงเฉพาะบนจอเล็ก ซ่อนบนคอมพิวเตอร์) */}
      <nav 
        aria-label="เมนูหลักบนมือถือ"
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-30 shadow-lg px-2 py-1"
      >
        <div className="grid grid-cols-3 gap-1 max-w-md mx-auto">
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
