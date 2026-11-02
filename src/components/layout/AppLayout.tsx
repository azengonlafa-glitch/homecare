import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileNav } from './MobileNav';
import { ToastProvider } from '../ui/Toast';
import { SETTINGS_CHANGED_EVENT, loadSettings } from '../../lib/settings';

export const AppLayout: React.FC = () => {
  const location = useLocation();

  // บันทึกหน้าที่เข้าล่าสุด เพื่อใช้เป็นหน้าเริ่มต้น (default)
  useEffect(() => {
    if (location.pathname && location.pathname !== '/') {
      localStorage.setItem('growa_last_visited_path', location.pathname);
    }
  }, [location.pathname]);

  // ดึงข้อมูลผู้ใช้จาก localStorage หรือ fallback จากการตั้งค่าในแอป
  const savedUser = localStorage.getItem('growa_auth_user');
  const currentSettings = loadSettings();
  const user = savedUser
    ? JSON.parse(savedUser)
    : { name: currentSettings.nickname || currentSettings.profile.firstName || 'ผู้ใช้ทั่วไป', email: '' };

  const [photo, setPhoto] = useState(() => loadSettings().profile.photo);
  useEffect(() => {
    const sync = () => setPhoto(loadSettings().profile.photo);
    window.addEventListener(SETTINGS_CHANGED_EVENT, sync);
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, sync);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('growa_auth_user');
    window.location.reload();
  };

  return (
    <ToastProvider>
      <div className="min-h-dvh bg-slate-50 text-slate-900 lg:flex">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-xl focus:bg-purple-700 focus:text-white"
        >
          ข้ามไปที่เนื้อหาหลัก
        </a>

        {/* Sidebar ซ้าย (แท็บเล็ต/คอมพิวเตอร์) */}
        <Sidebar />

        <div className="flex-1 min-w-0 flex flex-col">
          <TopBar user={user} photo={photo} onLogout={handleLogout} />

          {/* ระยะขอบ: เว้นที่ให้เมนูล่างบนมือถือ (pb-28) และลดเหลือ pb-8 บนจอใหญ่ */}
          <main id="main-content" className="flex-1 w-full max-w-6xl mx-auto p-4 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8 pb-28 lg:pb-8">
            {/* เปลี่ยนหน้าเมื่อไรเนื้อหาจะค่อย ๆ เลื่อนขึ้นมาเบา ๆ */}
            <div key={location.pathname} className="anim-page">
              <Outlet />
            </div>
          </main>
        </div>

        {/* เมนูล่าง (มือถือ) */}
        <MobileNav />
      </div>
    </ToastProvider>
  );
};
