import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** เพิ่ม hover state สำหรับการ์ดที่เป็นรายการ */
  interactive?: boolean;
}

/** การ์ดมาตรฐาน: กระดาษครีม ขอบเย็บด้ายประตามสีหมวด การ์ดชั้นนอกสุดของหน้ามีเทปวาชิแปะ (ดู .paper ใน index.css) */
export const Card: React.FC<CardProps> = ({ interactive, className, ...props }) => (
  <div
    className={cn(
      'paper card-reveal relative rounded-[2rem] p-6 sm:p-8',
      interactive && 'hover-lift cursor-pointer',
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
