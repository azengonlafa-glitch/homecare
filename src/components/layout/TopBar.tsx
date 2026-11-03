import React from 'react';
import { NavLink } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { BrandMark } from './BrandMark';
import { Avatar } from '../ui/Avatar';
import { NotificationBell } from './NotificationBell';

interface TopBarProps {
  user: { name?: string; email?: string } | null;
  /** รูปโปรไฟล์ (data URL) ว่าง = ใช้ตัวอักษรแรกของชื่อ */
  photo?: string;
  onLogout: () => void;
}

/** แถบบน: ขนาดใหญ่เต็มตา ฟอนต์อ่านง่าย */
export const TopBar: React.FC<TopBarProps> = ({ user, photo, onLogout }) => (
  <header className="sticky top-0 z-40 h-20 bg-white/95 backdrop-blur-md border-b border-slate-200">
    <div className="h-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
      <div className="lg:hidden min-w-0 max-[419px]:[&_span]:hidden">
        <BrandMark />
      </div>
      <p className="hidden lg:block text-base font-medium text-slate-600">ดูแลยาและสุขภาพของครอบครัว</p>

      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <NotificationBell />
        {user ? (
          <div className="flex items-center gap-3 bg-purple-50 border border-purple-200 pl-3 pr-2 py-1.5 rounded-2xl min-w-0">
            <Avatar src={photo} name={user.name || user.email || 'U'} className="hidden sm:flex w-10 h-10 text-base shadow-xs" />
            <span className="text-base font-bold text-purple-900 hidden sm:inline truncate max-w-[12rem]">
              {user.name || user.email}
            </span>
            <button
              type="button"
              onClick={onLogout}
              title="ออกจากระบบ"
              className="min-h-[48px] px-3.5 shrink-0 whitespace-nowrap rounded-xl text-base font-semibold text-slate-600 hover:text-red-600 hover:bg-white cursor-pointer transition-colors"
            >
              ออกจากระบบ
            </button>
          </div>
        ) : (
          <NavLink
            to="/login"
            className="flex items-center gap-2 shrink-0 whitespace-nowrap min-h-[50px] px-5 rounded-2xl text-base sm:text-lg font-bold text-purple-700 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors shadow-xs"
          >
            <LogIn className="w-5 h-5" aria-hidden="true" />
            <span>เข้าสู่ระบบ</span>
          </NavLink>
        )}
      </div>
    </div>
  </header>
);
