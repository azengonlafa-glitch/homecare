import React from 'react';
import { colorOf, type FolderColor } from '../../lib/folders';
import { cn } from '../../lib/cn';

interface FolderIconProps {
  color: FolderColor;
  /** จำนวนเอกสาร ใช้กำหนดจำนวนกระดาษที่โผล่พ้นปากโฟลเดอร์ */
  count: number;
  className?: string;
  /** ไม่ตอบสนองเมื่อเอาเมาส์ผ่าน (ไอคอนในหัวหน้า) */
  still?: boolean;
}

/**
 * โฟลเดอร์หน้ายิ้มตามสไตล์ตัวการ์ตูนของแอป: เอาเมาส์ผ่านแล้วกระดาษโผล่ขึ้นมาและฝาโฟลเดอร์เอียงเปิด
 * ใส่ใน group เพื่อให้ hover ของการ์ดทั้งใบสั่งให้ไอคอนขยับ
 */
export const FolderIcon: React.FC<FolderIconProps> = ({ color, count, className, still }) => {
  const c = colorOf(color);
  const sheets = Math.min(3, count);
  return (
    <svg viewBox="0 0 140 112" aria-hidden="true" focusable="false" className={cn('overflow-visible', !still && 'folder-icon', className)}>
      {/* ด้านหลังพร้อมแท็บ */}
      <path d="M10 22c0-7 5-12 12-12h28c5 0 8 2 11 6l4 6h53c7 0 12 5 12 12v62c0 7-5 12-12 12H22c-7 0-12-5-12-12z" fill={c.back} />
      {/* กระดาษ */}
      <g className="folder-sheets">
        {sheets >= 3 && <rect x="26" y="26" width="86" height="64" rx="8" fill="#FFFFFF" opacity="0.8" transform="rotate(-5 69 58)" />}
        {sheets >= 2 && <rect x="28" y="24" width="86" height="64" rx="8" fill="#FFFFFF" opacity="0.92" transform="rotate(3 71 56)" />}
        {sheets >= 1 && (
          <g>
            <rect x="28" y="24" width="84" height="64" rx="8" fill="#FFFFFF" />
            <path d="M42 40h48M42 52h36M42 64h42" stroke={c.front} strokeWidth="5" strokeLinecap="round" />
          </g>
        )}
      </g>
      {/* ฝาหน้า */}
      <g className="folder-lid">
        <path d="M10 46c0-7 5-12 12-12h96c7 0 12 5 12 12v38c0 7-5 12-12 12H22c-7 0-12-5-12-12z" fill={c.front} />
        <g>
          <ellipse cx="55" cy="62" rx="3.8" ry="4.8" fill="#2B2547" className="mascot-eye" />
          <ellipse cx="85" cy="62" rx="3.8" ry="4.8" fill="#2B2547" className="mascot-eye" />
          <circle cx="56.2" cy="60.2" r="1.3" fill="#FFFFFF" />
          <circle cx="86.2" cy="60.2" r="1.3" fill="#FFFFFF" />
          <ellipse cx="46" cy="72" rx="5.5" ry="3.6" fill="#FF8FA8" opacity="0.8" />
          <ellipse cx="94" cy="72" rx="5.5" ry="3.6" fill="#FF8FA8" opacity="0.8" />
          <path d="M63 70q7 8 14 0" stroke="#2B2547" strokeWidth="3" strokeLinecap="round" fill="none" />
        </g>
      </g>
    </svg>
  );
};
