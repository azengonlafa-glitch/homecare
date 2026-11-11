import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { MENU_PATH, NAV_ITEMS } from './navItems';
import { ART_STYLE, ModeIcon } from './ModeIcon';
import { cn } from '../../lib/cn';
import { canManageHome } from '../../lib/settings';
import { useSettings } from '../../lib/useSettings';
import { useNavBadges } from '../../lib/navBadges';

const BADGE_CLASS =
  'anim-pop absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[22px] h-[22px] px-1 rounded-full bg-sun text-slate-900 text-xs font-extrabold ring-2 ring-white';

/**
 * เมนูล่างสำหรับมือถือและแท็บเล็ต (ซ่อนเมื่อจอกว้าง lg: 1024px ขึ้นไป ซึ่งใช้ Sidebar ซ้ายแทน)
 * - ประหยัดพื้นที่: มีเฉพาะโหมดสำคัญ (บันทึกอาการ ปฏิทิน ยาและการดูแล) กับปุ่ม "โหมดทั้งหมด"
 *   โหมดอื่นเข้าทางหน้ารวมโหมด (/menu)
 * - แถบสีขาวลอยเหนือขอบจอ มุมโค้งเต็ม (pill) มีเงา
 * - แต่ละเมนูเป็นวงกลม ไอคอนล้วน (ชื่อเมนูอ่านโดย screen reader ผ่าน aria-label)
 * - ป้ายแจ้งเตือนจำนวนการอัพเดตสีเหลืองที่มุมบนขวาของไอคอน (ปุ่มโหมดทั้งหมดรวมจำนวนของโหมดที่ซ่อนอยู่)
 */
export const MobileNav: React.FC = () => {
  const isOwner = canManageHome(useSettings());
  const badges = useNavBadges();
  const { pathname } = useLocation();

  const visible = NAV_ITEMS.filter((item) => !item.hidden && (isOwner || !item.ownerOnly));
  const primary = visible.filter((item) => item.mobilePrimary);
  const others = visible.filter((item) => !item.mobilePrimary);
  const othersCount = others.reduce((sum, item) => sum + (badges[item.to] ?? 0), 0);

  // อยู่ในโหมดที่ไม่ได้อยู่บนแถบ (เช่น สมาชิก สุขภาพ) หรืออยู่หน้ารวมโหมด -> ไฮไลต์ปุ่ม "โหมดทั้งหมด"
  const onPrimary = primary.some((item) => pathname === item.to || pathname.startsWith(`${item.to}/`));
  const menuActive = !onPrimary;

  return (
    <nav
      aria-label="เมนูหลักบนมือถือ"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none"
    >
      <ul className="mobile-paper pointer-events-auto mx-auto flex w-full max-w-sm items-center gap-1 rounded-[1.75rem] p-2">
        {primary.map(({ to, label, mobileLabel, art, end }) => {
          const count = badges[to] ?? 0;
          return (
            <li key={to} className="flex flex-1 min-w-0 justify-center">
              <NavLink
                to={to}
                end={end}
                aria-label={mobileLabel ?? label}
                className={({ isActive }) =>
                  cn(
                    'nav-item relative flex aspect-square w-full max-w-[3.75rem] items-center justify-center rounded-[1.35rem]',
                    ART_STYLE[art].tile,
                    isActive && 'nav-item-active ring-[3px] ring-[color:var(--accent)]'
                  )
                }
              >
                <ModeIcon name={art} className="h-9 w-9" />
                {count > 0 && (
                  <span aria-label={`${count} รายการใหม่`} className={BADGE_CLASS}>
                    {count > 9 ? '9+' : count}
                  </span>
                )}
              </NavLink>
            </li>
          );
        })}

        {/* ปุ่มไปหน้ารวมโหมดทั้งหมด */}
        <li className="flex flex-1 min-w-0 justify-center">
          <NavLink
            to={MENU_PATH}
            aria-label="โหมดทั้งหมด"
            className={cn(
              'nav-item relative flex aspect-square w-full max-w-[3.75rem] items-center justify-center rounded-[1.35rem]',
              ART_STYLE.menu.tile,
              menuActive && 'nav-item-active ring-[3px] ring-[color:var(--accent)]'
            )}
          >
            <ModeIcon name="menu" className="h-9 w-9" />
            {othersCount > 0 && (
              <span aria-label={`${othersCount} รายการใหม่ในโหมดอื่น`} className={BADGE_CLASS}>
                {othersCount > 9 ? '9+' : othersCount}
              </span>
            )}
          </NavLink>
        </li>
      </ul>
    </nav>
  );
};
