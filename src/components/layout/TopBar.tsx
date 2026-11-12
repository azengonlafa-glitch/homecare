import React from 'react';
import { NavLink } from 'react-router-dom';
import { LogIn, LogOut } from 'lucide-react';
import { HomeHeader } from './HomeHeader';
import { Avatar } from '../ui/Avatar';
import { NotificationBell } from './NotificationBell';

interface TopBarProps {
  user: { name?: string; email?: string } | null;
  /** รูปโปรไฟล์ (data URL) ว่าง = ใช้ตัวอักษรแรกของชื่อ */
  photo?: string;
  onLogout: () => void;
}

/** แถบบน: ขนาดใหญ่เต็มตา ฟอนต์อ่านง่าย ตอบสนองทั้งจอมือถือและจอคอม */
export const TopBar: React.FC<TopBarProps> = ({ user, photo, onLogout }) => (
  <header className="sticky top-0 z-40 h-20 [@media(max-height:500px)]:static [@media(max-height:500px)]:h-16 border-b border-[#EADBCC]/70 bg-[#FFFDF7]/75 backdrop-blur-md lg:border-b-0 lg:bg-transparent lg:bg-gradient-to-b lg:from-[#FFFDF7]/70 lg:to-[#FFFDF7]/0 lg:backdrop-blur-none">
    <div className="h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-2 sm:gap-4">
      <div className="lg:hidden min-w-0 flex-1">
        <HomeHeader variant="topbar" />
      </div>
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 min-w-0 ml-auto">
        <NotificationBell />
        {user ? (
          <div className="flex items-center gap-1.5 sm:gap-2.5 bg-purple-50 border border-purple-200 p-1 sm:pl-3 sm:pr-2 sm:py-1.5 rounded-2xl min-w-0">
            <Avatar
              src={photo}
              name={user.name || user.email || 'U'}
              className="w-9 h-9 text-sm sm:w-10 sm:h-10 sm:text-base shadow-xs shrink-0"
            />
            <span className="text-base font-bold text-purple-900 hidden sm:inline truncate max-w-[12rem]">
              {user.name || user.email}
            </span>
            <button
              type="button"
              onClick={onLogout}
              title="ออกจากระบบ"
              aria-label="ออกจากระบบ"
              className="inline-flex items-center justify-center min-h-[44px] px-2 sm:px-3.5 shrink-0 whitespace-nowrap rounded-xl text-base font-semibold text-slate-600 hover:text-red-600 hover:bg-white cursor-pointer transition-colors"
            >
              <LogOut className="w-5 h-5 sm:hidden" aria-hidden="true" />
              <span className="hidden sm:inline">ออกจากระบบ</span>
            </button>
          </div>
        ) : (
          <NavLink
            to="/login"
            aria-label="เข้าสู่ระบบ"
            className="flex items-center gap-2 shrink-0 whitespace-nowrap min-h-[50px] px-3.5 sm:px-5 rounded-2xl text-base sm:text-lg font-bold text-purple-700 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors shadow-xs"
          >
            <LogIn className="w-5 h-5" aria-hidden="true" />
            <span className="hidden sm:inline">เข้าสู่ระบบ</span>
          </NavLink>
        )}
      </div>
    </div>
  </header>
);
