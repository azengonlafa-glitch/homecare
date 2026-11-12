import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Stethoscope } from 'lucide-react';

/** ทางเข้าระบบปรึกษาบนมือถือ (เมนูล่างเต็มแล้ว จอกว้างเข้าจาก Sidebar) */
export const ConsultEntryCard: React.FC = () => (
  <Link
    to="/consult"
    className="lg:hidden flex min-h-[64px] items-center gap-3 rounded-2xl border border-purple-200 bg-purple-50 p-3 hover:bg-purple-100"
  >
    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-700 text-white">
      <Stethoscope className="w-6 h-6" aria-hidden="true" />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-base font-bold text-purple-950">ปรึกษาเภสัชกรหรือคลินิก</span>
      <span className="block text-sm text-slate-700">ส่งเฉพาะข้อมูลสุขภาพที่คุณเลือก</span>
    </span>
    <ChevronRight className="w-6 h-6 shrink-0 text-purple-800" aria-hidden="true" />
  </Link>
);
