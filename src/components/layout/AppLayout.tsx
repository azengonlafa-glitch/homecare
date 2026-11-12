import React, { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileNav } from './MobileNav';
import { MENU_PATH, NAV_ITEMS } from './navItems';
import { ToastProvider } from '../ui/Toast';
import { CanvasDecor } from '../ui/Decor';
import { PageLoading } from '../ui/PageLoading';
import { SETTINGS_CHANGED_EVENT, loadSettings } from '../../lib/settings';
import { cloudEnabled } from '../../cloud/client';
import { signOutAll } from '../../cloud/engine';
import { unsubscribeOnSignOut } from '../../consult/push';
import { PrivacyIntroModal } from '../settings/PrivacyIntroModal';

/** หมวดแรกของที่อยู่ที่มีหน้าจริงในเลย์เอาต์นี้ */
const KNOWN_SECTIONS = ['journal', 'calendar', 'appointments', 'members', 'health', 'folders', 'notifications', 'settings', 'home-settings', 'menu', 'consult', 'meds'];

/** หมวดของหน้า: กำหนดสีผ้ากิงแฮม สีด้ายเย็บ สีเทป และสีเมนูที่เลือก (ดู [data-section] ใน index.css) */
const sectionOf = (pathname: string): string => {
  const first = pathname.split('/')[1] ?? '';
  const known = KNOWN_SECTIONS;
  if (first === 'appointments') return 'calendar';
  if (first === 'home-settings' || first === 'menu') return 'settings';
  return known.includes(first) ? first : 'meds';
};

export const AppLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // บันทึกหน้าที่เข้าล่าสุด เพื่อใช้เป็นหน้าเริ่มต้น (default)
  useEffect(() => {
    // จำเฉพาะหน้าที่มีจริง (หมวดที่รู้จัก) ที่อยู่ผิดจะไม่ถูกจำ จึงไม่พาวนกลับมาที่หน้าว่าง
    const first = location.pathname.split('/')[1] ?? '';
    if (location.pathname !== '/menu' && KNOWN_SECTIONS.includes(first)) {
      localStorage.setItem('growa_last_visited_path', location.pathname);
    }
  }, [location.pathname]);

  // ชื่อแท็บเบราว์เซอร์ตามหน้า (เดิมเป็น "Growa Homecare" เหมือนกันทุกหน้า ผู้ใช้โปรแกรมอ่านหน้าจอและคนเปิดหลายแท็บแยกไม่ออก)
  useEffect(() => {
    const match = NAV_ITEMS.filter((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)).sort(
      (a, b) => b.to.length - a.to.length
    )[0];
    const label = location.pathname === MENU_PATH ? 'เมนู' : match?.label;
    document.title = label ? `${label} · Growa Homecare` : 'Growa Homecare';
  }, [location.pathname]);

  // ให้ป๊อปอัป/Toast ที่ถูกวางไว้นอกกรอบนี้ (portal) ใช้สีของหมวดเดียวกับหน้า
  const section = sectionOf(location.pathname);
  useEffect(() => {
    document.documentElement.dataset.section = section;
  }, [section]);

  // ดึงข้อมูลผู้ใช้จาก localStorage (ถ้าไม่ได้ล็อกอิน จะเป็น null เพื่อให้แสดงปุ่มเข้าสู่ระบบ)
  const [user, setUser] = useState<{ name?: string; email?: string } | null>(() => {
    const saved = localStorage.getItem('growa_auth_user');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    const saved = localStorage.getItem('growa_auth_user');
    setUser(saved ? JSON.parse(saved) : null);
  }, [location.pathname]);

  const [photo, setPhoto] = useState(() => loadSettings().profile.photo);
  useEffect(() => {
    const sync = () => setPhoto(loadSettings().profile.photo);
    window.addEventListener(SETTINGS_CHANGED_EVENT, sync);
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, sync);
  }, []);

  const handleLogout = () => {
    if (cloudEnabled) {
      // ต้องลบการสมัครก่อน เพราะหลังออกจากระบบไม่มีสิทธิ์ลบแล้ว และเครื่องนี้ไม่ควรรับแจ้งเตือนของบัญชีนี้ต่อ
      void unsubscribeOnSignOut().finally(() => void signOutAll());
      return;
    }
    localStorage.removeItem('growa_auth_user');
    setUser(null);
    navigate('/login', { replace: true });
  };

  return (
    <ToastProvider>
      <div className="relative isolate min-h-dvh text-slate-900 lg:flex" data-section={section}>
        <CanvasDecor />
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
          <main id="main-content" className="flex-1 w-full max-w-7xl mx-auto p-4 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8 pb-36 [@media(max-height:500px)]:pb-24 lg:pb-8">
            {/* เปลี่ยนหน้าเมื่อไรเนื้อหาจะค่อย ๆ เลื่อนขึ้นมาเบา ๆ */}
            <div key={location.pathname} className="anim-page">
              <Suspense fallback={<PageLoading />}><Outlet /></Suspense>
            </div>
          </main>
        </div>

        {/* เมนูล่าง (มือถือ) */}
        <MobileNav />

        {/* เข้าบ้านครั้งแรก: อธิบายความเป็นส่วนตัว (ขึ้นครั้งเดียว) */}
        <PrivacyIntroModal />
      </div>
    </ToastProvider>
  );
};
