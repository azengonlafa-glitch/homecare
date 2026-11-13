import React from 'react';
import { NavLink } from 'react-router-dom';
import { House, Users } from 'lucide-react';
import { BrandMark } from './BrandMark';
import { cn } from '../../lib/cn';
import { useSettings } from '../../lib/useSettings';

interface HomeHeaderProps {
  /** sidebar = หัวเมนูซ้ายบนจอกว้าง, topbar = ป้ายเล็กบนแถบบนของมือถือ/แท็บเล็ต */
  variant: 'sidebar' | 'topbar';
}

/**
 * มุมบนซ้ายแบบหัวเซิร์ฟเวอร์ใน Discord: รูปบ้าน ชื่อบ้าน จำนวนสมาชิก
 * ถ้าตั้งภาพพื้นหลังบ้านไว้ (ตั้งค่าบ้าน) จะแสดงเป็นแบนเนอร์ด้านหลังและเปลี่ยนตัวอักษรเป็นสีขาว
 * ยังไม่มีบ้าน (เช่น โหมดต้นแบบก่อนตั้งค่าบ้าน) จะแสดงโลโก้แอปแทน
 */
export const HomeHeader: React.FC<HomeHeaderProps> = ({ variant }) => {
  const settings = useSettings();
  const name = settings.homeName.trim();
  if (!name) return <BrandMark />;

  const banner = settings.home.banner || '';
  const count = settings.members.length;
  const isSidebar = variant === 'sidebar';

  return (
    <NavLink
      to="/"
      aria-label={`บ้าน ${name} สมาชิก ${count} คน`}
      className={cn(
        'relative flex items-center gap-3 min-w-0 overflow-hidden',
        isSidebar ? 'w-full px-4 lg:px-6' : 'rounded-2xl pr-2 pl-1 py-1.5 max-w-full gap-2',
        // แบนเนอร์เมนูข้าง: เป็นการ์ดมุมโค้งเว้นขอบ 12px ให้อยู่ในเส้นประของเมนู ไม่ให้เส้นประพาดผ่านภาพและขอบล่างไม่ตัดตรง
        isSidebar ? (banner ? 'h-28 items-end pb-3.5 mt-3 ml-0 w-[calc(100%-0.75rem)] rounded-r-[1.75rem] rounded-l-none' : 'h-20') : banner ? 'h-14' : ''
      )}
    >
      {banner && (
        <>
          <img src={banner} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover" />
          {/* ไล่เฉดดำด้านล่างให้ตัวอักษรสีขาวอ่านออกบนภาพทุกแบบ */}
          <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/10" />
        </>
      )}

      <span
        className={cn(
          'relative shrink-0 overflow-hidden flex items-center justify-center',
          isSidebar ? 'w-12 h-12 rounded-2xl' : 'w-[44px] h-[44px] rounded-xl',
          settings.home.photo ? 'bg-white' : 'bg-purple-700 text-white',
          banner && 'ring-2 ring-white/80'
        )}
      >
        {settings.home.photo ? (
          <img src={settings.home.photo} alt="" className="w-full h-full object-cover" />
        ) : (
          <House className={isSidebar ? 'w-6 h-6' : 'w-5 h-5'} aria-hidden="true" />
        )}
      </span>

      <span className="relative min-w-0 leading-tight">
        <span
          className={cn(
            'block font-bold tracking-tight',
            // แถบบน: ชื่อบ้านยาวขึ้นบรรทัดที่สองได้ (ตัวอักษรใหญ่สุดเดิมเหลือ "บ้า…") ส่วนเมนูข้างยังตัดบรรทัดเดียว
            isSidebar ? 'truncate text-lg' : 'line-clamp-2 break-words text-base sm:text-lg',
            banner ? 'text-white drop-shadow' : 'text-slate-900'
          )}
        >
          {name}
        </span>
        <span
          className={cn(
            'mt-0.5 flex items-center gap-1 text-sm font-semibold',
            banner ? 'text-white/90 drop-shadow' : 'text-slate-700'
          )}
        >
          <Users className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span className="whitespace-nowrap">{count} สมาชิก</span>
        </span>
      </span>
    </NavLink>
  );
};
