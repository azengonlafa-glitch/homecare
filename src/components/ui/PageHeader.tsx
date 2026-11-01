import React from 'react';

interface PageHeaderProps {
  /** ข้อความนำด้านบน เช่น "บ้านของคุณ" */
  eyebrow?: string;
  title: string;
  description?: string;
  /** ปุ่มหรือตัวควบคุมด้านขวาของหัวหน้า เช่น ปุ่มเพิ่มข้อมูล */
  action?: React.ReactNode;
}

/** ส่วนหัวหน้าจอมาตรฐาน: ขนาดใหญ่ ชัดเจน อ่านสบายตา */
export const PageHeader: React.FC<PageHeaderProps> = ({ eyebrow, title, description, action }) => (
  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
    <div>
      {eyebrow && (
        <span className="text-sm sm:text-base font-bold text-purple-700 bg-purple-50 border border-purple-200/60 px-3.5 py-1 rounded-full uppercase tracking-wide inline-block mb-2">
          {eyebrow}
        </span>
      )}
      <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight">
        {title}
      </h1>
      {description && (
        <p className="text-base sm:text-xl text-slate-600 mt-2 font-medium">
          {description}
        </p>
      )}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);
