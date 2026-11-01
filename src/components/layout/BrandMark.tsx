import React from 'react';
import { NavLink } from 'react-router-dom';
import { Pill } from 'lucide-react';
import { cn } from '../../lib/cn';

interface BrandMarkProps {
  /** ซ่อนชื่อแอปเหลือแต่โลโก้ (ใช้กับ Sidebar แบบแคบบนแท็บเล็ต) */
  compact?: boolean;
}

export const BrandMark: React.FC<BrandMarkProps> = ({ compact }) => (
  <NavLink to="/" aria-label="Growa Homecare หน้าหลัก" className="flex items-center gap-3.5 min-w-0">
    <div className="w-11 h-11 shrink-0 rounded-2xl bg-purple-700 flex items-center justify-center text-white shadow-xs">
      <Pill className="w-6 h-6" aria-hidden="true" />
    </div>
    <span
      className={cn(
        'text-xl font-bold text-purple-700 tracking-tight leading-tight whitespace-nowrap max-[359px]:hidden',
        compact && 'hidden lg:block'
      )}
    >
      Growa Homecare
    </span>
  </NavLink>
);
