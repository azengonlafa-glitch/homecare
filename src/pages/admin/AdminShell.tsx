import React from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { ErrorCard, LoadingCard } from '../../components/consult/ConsultUI';
import { Card } from '../../components/ui/Card';
import { useConsultData } from '../../consult/hooks';
import { cloudEnabled } from '../../cloud/client';
import { readAuthUser } from '../../cloud/identity';
import { Frame } from '../pharmacist/StaffShell';

const TITLE = 'จัดการ Growa';

/** ด่านของหน้าแอดมินทุกหน้า: ต้องเข้าสู่ระบบและเป็นแอดมิน หน้านี้ไม่แสดงข้อมูลสุขภาพของผู้ใช้เลย */
export const AdminShell: React.FC = () => {
  const location = useLocation();
  const loggedIn = !cloudEnabled || !!readAuthUser()?.id;
  const { data: isAdmin, loading, error, reload } = useConsultData((b) => b.getAdminAccess(), [loggedIn]);

  if (!loggedIn) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (loading && isAdmin === null) {
    return (
      <Frame title={TITLE} homeHref="/admin">
        <LoadingCard />
      </Frame>
    );
  }
  if (error && isAdmin === null) {
    return (
      <Frame title={TITLE} homeHref="/admin">
        <ErrorCard message={error} onRetry={reload} />
      </Frame>
    );
  }
  if (!isAdmin) {
    return (
      <Frame title={TITLE} homeHref="/admin">
        <Card className="py-12 text-center">
          <ShieldAlert className="w-12 h-12 text-slate-400 mx-auto mb-3" aria-hidden="true" />
          <h1 className="text-xl font-bold text-slate-900">บัญชีนี้ไม่ใช่แอดมิน</h1>
          <Link to="/" className="mt-3 inline-block font-bold text-purple-800 underline">
            กลับหน้าหลัก
          </Link>
        </Card>
      </Frame>
    );
  }
  return (
    <Frame title={TITLE} homeHref="/admin">
      <div className="mx-auto w-full max-w-6xl">
        <Outlet />
      </div>
    </Frame>
  );
};
