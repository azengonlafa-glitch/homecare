import React from 'react';
import { cn } from '../../lib/cn';

interface AvatarProps {
  /** data URL ของรูป ว่าง = แสดงตัวอักษรแรกของชื่อ */
  src?: string;
  name: string;
  className?: string;
}

/** รูปโปรไฟล์วงกลม ถ้าไม่มีรูปแสดงตัวอักษรแรกของชื่อ */
export const Avatar: React.FC<AvatarProps> = ({ src, name, className }) =>
  src ? (
    <img src={src} alt="" width="64" height="64" loading="lazy" decoding="async" className={cn('rounded-full object-cover shrink-0', className)} />
  ) : (
    <span
      aria-hidden="true"
      className={cn(
        'rounded-full bg-purple-700 text-white flex items-center justify-center font-bold shrink-0',
        className
      )}
    >
      {name.trim().slice(0, 1) || 'U'}
    </span>
  );
