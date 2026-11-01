import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

interface PageLayoutProps {
  title: string;
  description?: string;
  /** ปุ่มย้อนกลับ "‹ ตั้งค่า" (ค่าเริ่มต้น true) ใช้ false เฉพาะหน้ารายการตั้งค่าหลัก */
  back?: boolean;
  children: React.ReactNode;
  /** ปุ่มสำคัญของหน้า วางต่อท้ายเนื้อหาโดยตรง (ไม่ติดขอบล่างของจอ) */
  footer?: React.ReactNode;
}

/**
 * เลย์เอาต์กลางของหน้าตั้งค่าทุกหน้า
 * - เนื้อหากว้างสูงสุด 560px จัดกึ่งกลาง ขอบซ้ายขวาเท่ากันทุกหน้า
 * - ปุ่มย้อนกลับ "‹ ตั้งค่า" อยู่ตำแหน่งเดียวกันเสมอ (บนสุดของเนื้อหา)
 */
export const PageLayout: React.FC<PageLayoutProps> = ({ title, description, back = true, children, footer }) => (
  <div className="mx-auto w-full max-w-[560px]">
    {back && (
      <Link
        to="/settings"
        aria-label="ย้อนกลับไปหน้าตั้งค่า"
        className="inline-flex items-center gap-1 min-h-[48px] pl-1 pr-4 -ml-1 rounded-xl text-lg font-semibold text-slate-700 hover:text-purple-800 hover:bg-purple-50 transition-colors"
      >
        <ChevronLeft className="w-6 h-6 shrink-0" aria-hidden="true" />
        <span>ตั้งค่า</span>
      </Link>
    )}

    <header className="mt-1 mb-6 min-w-0">
      <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight break-words">{title}</h1>
      {description && <p className="mt-2 text-base text-slate-600 break-words">{description}</p>}
    </header>

    <div className="space-y-5">{children}</div>

    {footer && <div className="mt-6">{footer}</div>}
  </div>
);
