import React from 'react';
import { NavLink } from 'react-router-dom';
import { Mascot } from '../ui/Mascot';
import { cn } from '../../lib/cn';

interface BrandMarkProps {
  /** ซ่อนชื่อแอปเหลือแต่โลโก้ (ใช้กับ Sidebar แบบแคบบนแท็บเล็ต) */
  compact?: boolean;
}

export const BrandMark: React.FC<BrandMarkProps> = ({ compact }) => (
  <NavLink to="/" aria-label="Growa Homecare" className="flex items-center gap-3.5 min-w-0">
    <Mascot kind="heart" still className="h-12 w-12 shrink-0" />
    <span
      className={cn(
        'font-display text-xl font-semibold text-purple-700 tracking-tight leading-tight whitespace-nowrap max-[359px]:hidden',
        compact && 'hidden lg:block'
      )}
    >
      Growa Homecare
    </span>
  </NavLink>
);
