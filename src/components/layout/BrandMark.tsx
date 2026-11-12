import React from 'react';
import { NavLink } from 'react-router-dom';
import { GrowaLogo } from '../ui/GrowaLogo';
import { cn } from '../../lib/cn';

interface BrandMarkProps {
  /** ซ่อนข้อความข้างโลโก้เหลือแต่โลโก้ (ใช้กับ Sidebar แบบแคบบนแท็บเล็ต) */
  compact?: boolean;
}

/** โลโก้แอปมุมบน: ตัวโลโก้มีคำว่า GROWA อยู่แล้ว ข้างหน้าจึงเขียนแค่ "Homecare" ไม่ซ้ำชื่อ */
export const BrandMark: React.FC<BrandMarkProps> = ({ compact }) => (
  <NavLink to="/" aria-label="Growa Homecare" className="flex items-center gap-2.5 min-w-0">
    <GrowaLogo className="h-14 w-14 shrink-0 drop-shadow-sm" />
    <span
      className={cn(
        'font-display text-xl font-semibold text-slate-800 tracking-tight leading-tight whitespace-nowrap max-[359px]:hidden',
        compact && 'hidden lg:block'
      )}
    >
      Homecare
    </span>
  </NavLink>
);
