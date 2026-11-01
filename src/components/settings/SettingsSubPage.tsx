import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

interface SettingsSubPageProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  /** ปุ่มสำคัญของหน้า แสดงไว้ท้ายเนื้อหาเพื่อให้กดด้วยมือเดียวได้ */
  footer?: React.ReactNode;
}

/** กรอบหน้าหน่วยของหน้าตั้งค่า: ปุ่มย้อนกลับชัดเจน + หัวข้อ + เนื้อหา + ปุ่มท้ายหน้า */
export const SettingsSubPage: React.FC<SettingsSubPageProps> = ({
  title,
  description,
  children,
  footer,
}) => (
  <div className="flex min-h-[calc(100dvh-11rem)] flex-col">
    <Link
      to="/settings"
      aria-label="ย้อนกลับไปหน้าตั้งค่า"
      className="inline-flex items-center gap-1 self-start min-h-[48px] pl-1 pr-4 -ml-1 mb-2 rounded-xl text-base font-semibold text-slate-700 hover:text-purple-800 hover:bg-purple-50 transition-colors"
    >
      <ChevronLeft className="w-6 h-6 shrink-0" aria-hidden="true" />
      <span>ตั้งค่า</span>
    </Link>

    <div className="mb-5 min-w-0">
      <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight break-words">
        {title}
      </h1>
      {description && (
        <p className="mt-2 text-base text-slate-600 font-medium break-words">{description}</p>
      )}
    </div>

    <div className="space-y-5">{children}</div>

    {footer && <div className="mt-auto pt-8">{footer}</div>}
  </div>
);
