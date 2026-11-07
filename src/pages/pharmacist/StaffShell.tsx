import React from 'react';
import { Link, Navigate, NavLink, Outlet } from 'react-router-dom';
import { BarChart3, Inbox, LogOut, ShieldAlert, Stethoscope } from 'lucide-react';
import { ErrorCard, LoadingCard, ModeBanner } from '../../components/consult/ConsultUI';
import { Card } from '../../components/ui/Card';
import { ToastProvider } from '../../components/ui/Toast';
import { useConsultData } from '../../consult/hooks';
import { cloudEnabled } from '../../cloud/client';
import { signOutAll } from '../../cloud/engine';
import { readAuthUser } from '../../cloud/identity';

export const Frame: React.FC<{ title?: string; homeHref?: string; children: React.ReactNode }> = ({ title = 'พื้นที่ผู้ให้บริการ Growa', homeHref = '/pharmacist', children }) => (
  <ToastProvider>
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="mx-auto flex min-h-[72px] max-w-[110rem] items-center justify-between gap-3 px-4 sm:px-6">
          <Link to={homeHref} className="flex min-w-0 items-center gap-2.5 text-lg sm:text-xl font-extrabold text-purple-900">
            <Stethoscope className="w-7 h-7 shrink-0" aria-hidden="true" />
            <span className="truncate">{title}</span>
          </Link>
          {cloudEnabled && readAuthUser() && (
            <button type="button" onClick={() => void signOutAll()} className="inline-flex min-h-[48px] shrink-0 items-center gap-2 rounded-xl px-3 text-base font-semibold text-slate-600 hover:text-red-600 hover:bg-slate-100 cursor-pointer">
              <LogOut className="w-5 h-5" aria-hidden="true" />
              <span className="hidden sm:inline">ออกจากระบบ</span>
            </button>
          )}
        </div>
      </header>
      <main id="main-content" className="mx-auto max-w-[110rem] space-y-4 p-4 sm:p-6">
        <ModeBanner />
        {children}
      </main>
    </div>
  </ToastProvider>
);

/** กรอบพื้นที่ผู้ให้บริการ แยกจากหน้าผู้ใช้ เข้าได้เฉพาะบัญชีที่มีบทบาทใน consult_staff */
export const StaffShell: React.FC = () => {
  const loggedIn = !cloudEnabled || !!readAuthUser()?.id;
  const { data: staff, loading, error, reload } = useConsultData((b) => b.getStaffContext(), [loggedIn]);

  if (!loggedIn) return <Navigate to="/login?next=/pharmacist" replace />;
  if (loading) return <Frame><LoadingCard label="กำลังตรวจสิทธิ์..." /></Frame>;
  if (error) return <Frame><ErrorCard message={error} onRetry={reload} /></Frame>;
  if (!staff || staff.role === 'admin') {
    return (
      <Frame>
        <Card className="py-12 text-center">
          <ShieldAlert className="w-12 h-12 text-slate-400 mx-auto mb-3" aria-hidden="true" />
          <h1 className="text-xl font-bold text-slate-900">บัญชีนี้ไม่มีสิทธิ์เข้าถึงข้อมูลผู้รับบริการ</h1>
          <p className="mt-1 text-base text-slate-600">
            {staff?.role === 'admin' ? 'แอดมินจัดการผู้ให้บริการได้ แต่เปิดข้อมูลสุขภาพไม่ได้' : 'พื้นที่นี้สำหรับเภสัชกรและคลินิกที่ลงทะเบียนแล้ว'}
          </p>
          <Link to="/" className="mt-4 inline-block font-bold text-purple-800 underline">
            กลับหน้าหลัก
          </Link>
        </Card>
      </Frame>
    );
  }
  const tab = ({ isActive }: { isActive: boolean }) =>
    `inline-flex min-h-[48px] items-center gap-2 rounded-xl px-4 text-base font-bold transition-colors ${isActive ? 'bg-purple-700 text-white' : 'text-slate-700 hover:bg-slate-100'}`;
  return (
    <Frame>
      <nav aria-label="เมนูหลักของทีมงาน" className="flex gap-2">
        <NavLink to="/pharmacist" end className={tab}>
          <Inbox className="h-5 w-5" aria-hidden="true" />
          คิวปรึกษา
        </NavLink>
        <NavLink to="/pharmacist/dashboard" className={tab}>
          <BarChart3 className="h-5 w-5" aria-hidden="true" />
          สถิติและรีวิว
        </NavLink>
      </nav>
      <Outlet />
    </Frame>
  );
};
