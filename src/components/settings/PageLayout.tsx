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
  /** ใช้ความกว้างมากขึ้นบนจอใหญ่ (สำหรับหน้าฟอร์มยาว ๆ หรือหน้าที่มีหลายคอลัมน์) */
  wide?: boolean;
  /** รูปแบบการจัดคอลัมน์: 1 คอลัมน์, 2 คอลัมน์, หรือ custom (ให้หน้าที่เรียกกำหนด grid เอง) */
  columns?: 1 | 2 | 'custom';
}

/**
 * เลย์เอาต์กลางของหน้าตั้งค่าทุกหน้า
 * - ปรับสัดส่วนให้พอดีกับจอ: บนมือถือเต็มความกว้าง บนแท็บเล็ต/คอมพิวเตอร์ขยายให้พอดีกับหน้าจอ
 * - ปุ่มย้อนกลับ "‹ ตั้งค่า" อยู่ตำแหน่งเดียวกันเสมอ
 */
export const PageLayout: React.FC<PageLayoutProps> = ({
  title,
  description,
  back = true,
  children,
  footer,
  wide = false,
  columns,
}) => {
  const containerClass = wide
    ? 'mx-auto w-full max-w-5xl xl:max-w-6xl'
    : 'mx-auto w-full max-w-3xl';

  const renderContent = () => {
    if (columns === 'custom') {
      return children;
    }
    if (columns === 2 || (wide && columns !== 1)) {
      return (
        <div className="space-y-6 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">
          {children}
        </div>
      );
    }
    return <div className="space-y-6">{children}</div>;
  };

  return (
    <div className={containerClass}>
      {back && (
        <Link
          to="/settings"
          aria-label="ย้อนกลับไปหน้าตั้งค่า"
          className="inline-flex items-center gap-1.5 min-h-[48px] pl-1 pr-4 -ml-1 rounded-xl text-lg font-bold text-slate-700 hover:text-purple-800 hover:bg-purple-50 transition-colors"
        >
          <ChevronLeft className="w-6 h-6 shrink-0" aria-hidden="true" />
          <span>ตั้งค่า</span>
        </Link>
      )}

      <header className="mt-1 mb-6 min-w-0">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight break-words">{title}</h1>
        {description && <p className="mt-2 text-base text-slate-600 break-words">{description}</p>}
      </header>

      {renderContent()}

      {footer && <div className={wide ? 'mt-6 lg:ml-auto lg:max-w-md' : 'mt-6'}>{footer}</div>}
    </div>
  );
};
