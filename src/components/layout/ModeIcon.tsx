import React from 'react';
import { cn } from '../../lib/cn';

/**
 * ไอคอนโหมดสไตล์การ์ตูนแบนอวบ (flat, มุมมน, ไม่มีเส้นขอบ, เอียงนิด ๆ, 2-3 สีต่อชิ้น)
 * ใช้คู่กับพื้นการ์ดสีพาสเทลและชื่อโหมดสีเข้มของตระกูลเดียวกัน (ดู ART_STYLE)
 */
export type ArtKey =
  | 'journal'
  | 'calendar'
  | 'members'
  | 'house'
  | 'meds'
  | 'bell'
  | 'folder'
  | 'health'
  | 'consult'
  | 'settings'
  | 'menu';

/** พื้นการ์ด + สีชื่อโหมดของแต่ละไอคอน (ตระกูลสีเดียวกับตัวไอคอน) */
export const ART_STYLE: Record<ArtKey, { tile: string; label: string }> = {
  journal: { tile: 'bg-[#FFEBC9]', label: 'text-[#DC5A28]' },
  calendar: { tile: 'bg-[#DDF3FF]', label: 'text-[#2272D9]' },
  members: { tile: 'bg-[#FFE0F6]', label: 'text-[#C23AA8]' },
  house: { tile: 'bg-[#E4FACB]', label: 'text-[#3A9440]' },
  meds: { tile: 'bg-[#FFDCCB]', label: 'text-[#DB4F26]' },
  bell: { tile: 'bg-[#FFF1C7]', label: 'text-[#C98010]' },
  folder: { tile: 'bg-[#D8F7EA]', label: 'text-[#1C9E82]' },
  health: { tile: 'bg-[#FFD6DD]', label: 'text-[#DE3C5E]' },
  consult: { tile: 'bg-[#DCE8FF]', label: 'text-[#2F62D6]' },
  settings: { tile: 'bg-[#E6DFFF]', label: 'text-[#7A58E0]' },
  menu: { tile: 'bg-[#E6DFFF]', label: 'text-[#7A58E0]' },
};

const ART: Record<ArtKey, React.ReactNode> = {
  // สมุดบันทึก: เล่มสีส้ม มีห่วงเกลียวและบรรทัด
  journal: (
    <g transform="rotate(8 32 32)">
      <rect x="17" y="9" width="35" height="46" rx="9" fill="#FFB23F" />
      {[19, 30, 41].map((y) => (
        <rect key={y} x="8" y={y} width="15" height="6.5" rx="3.2" fill="#DC5A28" />
      ))}
      <rect x="29" y="21" width="16" height="4.6" rx="2.3" fill="#DC5A28" />
      <rect x="29" y="31" width="19" height="4.6" rx="2.3" fill="#DC5A28" />
      <rect x="29" y="41" width="12" height="4.6" rx="2.3" fill="#DC5A28" />
    </g>
  ),
  // ปฏิทิน: ห่วงสองข้าง แถบหัวสีน้ำเงิน ช่องวัน และวันที่เน้นสีเหลือง
  calendar: (
    <g transform="rotate(-8 32 32)">
      <rect x="10" y="14" width="44" height="42" rx="10" fill="#4DB8FF" />
      <path d="M10 25a11 11 0 0 1 11-11h22a11 11 0 0 1 11 11v5H10z" fill="#1F6FDB" />
      <rect x="19" y="7" width="7" height="14" rx="3.5" fill="#1F6FDB" />
      <rect x="38" y="7" width="7" height="14" rx="3.5" fill="#1F6FDB" />
      {[18, 29, 40].map((x) =>
        [37, 46].map((y) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="7" height="6" rx="2.4" fill={x === 29 && y === 37 ? '#FFD25E' : '#FFFFFF'} />
        ))
      )}
    </g>
  ),
  // สมาชิกในบ้าน: คนสองคนหน้ายิ้ม
  members: (
    <g transform="rotate(-6 32 32)">
      <circle cx="42" cy="20" r="9.5" fill="#C45BD8" />
      <path d="M26 55v-7a16 16 0 0 1 32 0v7z" fill="#B046C7" />
      <circle cx="24" cy="26" r="10.5" fill="#FF7BC0" />
      <path d="M7 56v-8a17 17 0 0 1 34 0v8z" fill="#FF55A8" />
      <circle cx="20.5" cy="26" r="1.9" fill="#6B1D5A" />
      <circle cx="27.5" cy="26" r="1.9" fill="#6B1D5A" />
      <path d="M20.5 31q3.5 3.4 7 0" stroke="#6B1D5A" strokeWidth="2.2" strokeLinecap="round" fill="none" />
    </g>
  ),
  // บ้าน: หลังคาเขียว ตัวบ้านเขียวอ่อน ประตูกลม
  house: (
    <g transform="rotate(-6 32 32)">
      <rect x="40" y="9" width="8" height="14" rx="2.5" fill="#2F8A3F" />
      <rect x="12" y="27" width="40" height="28" rx="7" fill="#B6E87A" />
      <path d="M11 30L32 12l21 18" stroke="#46BC58" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <rect x="27" y="38" width="11" height="17" rx="5.5" fill="#3A9440" />
      <rect x="16.5" y="34" width="7" height="7" rx="2.2" fill="#FFFFFF" />
    </g>
  ),
  // ยา: แคปซูลสองสี กับเม็ดยากลม
  meds: (
    <g>
      <g transform="rotate(-40 28 28)">
        <path d="M28 17H18a11 11 0 0 0 0 22h10z" fill="#FF6B4A" />
        <path d="M28 17h10a11 11 0 0 1 0 22H28z" fill="#FFF1E8" />
        <rect x="14" y="22" width="9" height="3.6" rx="1.8" fill="#FFFFFF" opacity="0.65" />
      </g>
      <circle cx="46" cy="46" r="9.5" fill="#FFB23F" />
      <rect x="38" y="44.6" width="16" height="2.8" rx="1.4" fill="#E27A1E" transform="rotate(-30 46 46)" />
    </g>
  ),
  // กระดิ่งแจ้งเตือน: สีทอง มีจุดแดง
  bell: (
    <g>
      <g transform="rotate(10 32 32)">
        <circle cx="32" cy="9" r="3.6" fill="#E8902A" />
        <path d="M32 11c-10 0-16 8-16 18v7l-5 8h42l-5-8v-7c0-10-6-18-16-18z" fill="#FFC53D" />
        <path d="M22 18c-4 3-6 7-6 12v6l-5 8h6l4-7v-8c0-4 1-8 3-11z" fill="#FFD86B" />
        <circle cx="32" cy="52" r="5.6" fill="#E8902A" />
      </g>
      <circle cx="49" cy="15" r="7" fill="#FF5C6C" />
    </g>
  ),
  // โฟลเดอร์เอกสาร: กระดาษโผล่จากโฟลเดอร์สีมิ้นต์
  folder: (
    <g transform="rotate(-6 32 32)">
      <path d="M7 17a6 6 0 0 1 6-6h13l6 7h19a6 6 0 0 1 6 6v27a6 6 0 0 1-6 6H13a6 6 0 0 1-6-6z" fill="#2FBF9E" />
      <rect x="15" y="17" width="31" height="16" rx="3" fill="#FFFFFF" transform="rotate(-5 30 25)" />
      <path d="M7 29a6 6 0 0 1 6-6h38a6 6 0 0 1 6 6v21a6 6 0 0 1-6 6H13a6 6 0 0 1-6-6z" fill="#7FE3C6" />
    </g>
  ),
  // ข้อมูลสุขภาพ: หัวใจมีเส้นชีพจร
  health: (
    <g transform="rotate(-6 32 32)">
      <path d="M32 55C11 41 7 29 11 20c4-8 15-8 21 0 6-8 17-8 21 0 4 9 0 21-21 35z" fill="#FF5C7A" />
      <ellipse cx="19.5" cy="22" rx="4.2" ry="2.6" fill="#FF9DB0" transform="rotate(-35 19.5 22)" />
      <path d="M13 34h9l4-8 6 16 4-8h13" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </g>
  ),
  // ปรึกษา: ฟองสนทนาสีน้ำเงินมีกากบาทขาว และฟองเล็กสีฟ้า
  consult: (
    <g transform="rotate(-5 32 32)">
      <circle cx="51" cy="14" r="7.5" fill="#6FD0FF" />
      <path d="M13 12h34a8 8 0 0 1 8 8v21a8 8 0 0 1-8 8H31l-12 10V49h-6a8 8 0 0 1-8-8V20a8 8 0 0 1 8-8z" fill="#3A78F2" />
      <rect x="27.5" y="20" width="9" height="22" rx="3.5" fill="#FFFFFF" />
      <rect x="21" y="26.5" width="22" height="9" rx="3.5" fill="#FFFFFF" />
    </g>
  ),
  // ตั้งค่า: เฟืองสีม่วง
  settings: (
    <g transform="rotate(10 32 32)">
      {[0, 45, 90, 135].map((a) => (
        <rect key={a} x="26" y="6" width="12" height="52" rx="5" fill="#A184F7" transform={`rotate(${a} 32 32)`} />
      ))}
      <circle cx="32" cy="32" r="20" fill="#8A68F0" />
      <circle cx="32" cy="32" r="7.5" fill="#E6DFFF" />
    </g>
  ),
  // โหมดทั้งหมด: สี่ช่องหลากสี
  menu: (
    <g transform="rotate(-8 32 32)">
      <rect x="9" y="9" width="21" height="21" rx="7" fill="#FF9F43" />
      <rect x="34" y="9" width="21" height="21" rx="7" fill="#4DB8FF" />
      <rect x="9" y="34" width="21" height="21" rx="7" fill="#FF6FB5" />
      <rect x="34" y="34" width="21" height="21" rx="7" fill="#5ED06E" />
    </g>
  ),
};

/** ไอคอนโหมดแบบภาพวาด (ตกแต่ง ชื่อโหมดต้องมีข้อความหรือ aria-label กำกับเสมอ) */
export const ModeIcon: React.FC<{ name: ArtKey; className?: string }> = ({ name, className }) => (
  <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" className={cn('block shrink-0', className)}>
    {ART[name]}
  </svg>
);
