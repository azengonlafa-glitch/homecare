import React from 'react';
import { NavLink } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { BrandMark } from './BrandMark';

interface TopBarProps {
  user: { name?: string; email?: string } | null;
  onLogout: () => void;
}

/** แถบบน: มือถือแสดงโลโก้ (เพราะไม่มี Sidebar) ฝั่งขวาแสดงผู้ใช้หรือปุ่มเข้าสู่ระบบ */
export const TopBar: React.FC<TopBarProps> = ({ user, onLogout }) => (
  <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur-md border-b border-slate-200">
    <div className="h-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
      <div className="md:hidden min-w-0">
        <BrandMark />
      </div>
      <p className="hidden md:block text-sm text-slate-500">ดูแลยาและสุขภาพของครอบครัว</p>

      {user ? (
        <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 pl-2 pr-1 py-1 rounded-xl min-w-0">
          <div
            aria-hidden="true"
            className="w-8 h-8 shrink-0 rounded-full bg-purple-700 text-white flex items-center justify-center text-sm font-bold"
          >
            {user.name ? user.name.slice(0, 1) : 'U'}
          </div>
          <span className="text-sm font-semibold text-purple-900 hidden sm:inline truncate max-w-[10rem]">
            {user.name || user.email}
          </span>
          <button
            type="button"
            onClick={onLogout}
            title="ออกจากระบบ"
            className="min-h-[40px] px-3 rounded-lg text-sm text-slate-600 hover:text-red-600 hover:bg-white cursor-pointer transition-colors"
          >
            ออกจากระบบ
          </button>
        </div>
      ) : (
        <NavLink
          to="/login"
          className="flex items-center gap-1.5 shrink-0 whitespace-nowrap min-h-[44px] px-3 sm:px-4 rounded-xl text-sm sm:text-base font-semibold text-purple-700 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors"
        >
          <LogIn className="w-4 h-4" aria-hidden="true" />
          <span>เข้าสู่ระบบ</span>
        </NavLink>
      )}
    </div>
  </header>
);
