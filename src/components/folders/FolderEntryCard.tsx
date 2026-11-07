import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, FolderOpen } from 'lucide-react';

/** ทางเข้าโฟลเดอร์เอกสารบนมือถือ (เมนูล่างเต็มแล้ว จอกว้างเข้าจาก Sidebar) */
export const FolderEntryCard: React.FC = () => (
  <Link to="/folders" className="lg:hidden flex min-h-[64px] items-center gap-3 rounded-[1.5rem] bg-peach-soft p-3 ring-1 ring-peach hover:bg-peach">
    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sun text-slate-900">
      <FolderOpen className="w-6 h-6" aria-hidden="true" />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-base font-bold text-slate-900">โฟลเดอร์เอกสาร</span>
      <span className="block text-sm text-slate-700">เก็บผลตรวจและใบสั่งยา หยิบส่งตอนปรึกษาได้</span>
    </span>
    <ChevronRight className="w-6 h-6 shrink-0 text-slate-700" aria-hidden="true" />
  </Link>
);
