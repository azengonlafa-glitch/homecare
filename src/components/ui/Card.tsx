import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** เพิ่ม hover state สำหรับการ์ดที่เป็นรายการ */
  interactive?: boolean;
}

/** การ์ดมาตรฐาน: ขนาดใหญ่ขึ้น นุ่มนวล สบายตา */
export const Card: React.FC<CardProps> = ({ interactive, className, ...props }) => (
  <div
    className={cn(
      'bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs transition-shadow duration-300',
      interactive && 'hover-lift cursor-pointer hover:border-purple-300 hover:shadow-lg',
      className
    )}
    {...props}
  />
);

interface CardHeaderProps {
  icon?: LucideIcon;
  title: string;
  action?: React.ReactNode;
}

/** หัวข้อภายในการ์ด: ไอคอน + ชื่อ + ลิงก์/ปุ่มด้านขวา */
export const CardHeader: React.FC<CardHeaderProps> = ({ icon: Icon, title, action }) => (
  <div className="flex items-center justify-between gap-3 mb-5">
    <h2 className="min-w-0 text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
      {Icon && <Icon className="w-7 h-7 shrink-0 text-purple-700" aria-hidden="true" />}
      <span>{title}</span>
    </h2>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);
