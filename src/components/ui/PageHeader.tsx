import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  /** ข้อความเล็กเหนือชื่อหน้า */
  eyebrow?: string;
  /** ปุ่มหรือช่องค้นหาด้านขวา (ย้ายลงใต้ชื่อบนมือถือ) */
  action?: React.ReactNode;
}

/** หัวข้อหน้ามาตรฐานสำหรับทุกหน้าในแอป */
export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, eyebrow, action }) => (
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div className="min-w-0">
      {eyebrow && <p className="text-sm font-semibold text-purple-700 mb-1">{eyebrow}</p>}
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 break-words">{title}</h1>
      {description && (
        <p className="text-slate-600 text-sm sm:text-base mt-1">{description}</p>
      )}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);
