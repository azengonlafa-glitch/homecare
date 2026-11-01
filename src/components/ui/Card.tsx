import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** เพิ่ม hover state สำหรับการ์ดที่เป็นรายการ */
  interactive?: boolean;
}

/** การ์ดมาตรฐาน: มุมโค้งพอดี เส้นขอบบาง ไม่มีเงา */
export const Card: React.FC<CardProps> = ({ interactive, className, ...props }) => (
  <div
    className={cn(
      'bg-white border border-slate-200 rounded-2xl p-5 sm:p-6',
      interactive && 'transition-colors hover:border-purple-300',
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
  <div className="flex items-center justify-between gap-3 mb-4">
    <h2 className="min-w-0 text-xl font-bold text-slate-900 flex items-center gap-2">
      {Icon && <Icon className="w-6 h-6 shrink-0 text-purple-700" aria-hidden="true" />}
      <span>{title}</span>
    </h2>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);
