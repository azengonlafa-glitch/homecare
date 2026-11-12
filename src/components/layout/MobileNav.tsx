import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { MENU_PATH, NAV_ITEMS } from './navItems';
import { ART_STYLE, ModeIcon } from './ModeIcon';
import { cn } from '../../lib/cn';
import { canManageHome } from '../../lib/settings';
import { useSettings } from '../../lib/useSettings';
import { useNavBadges } from '../../lib/navBadges';

const BADGE_CLASS =
  'badge-beat absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[22px] h-[22px] px-1 rounded-full bg-sun text-slate-900 text-xs font-extrabold ring-2 ring-white';

/** ปุ่มเมนูล่าง: ไอคอนบน ชื่อเมนูล่าง (เดิมเป็นไอคอนล้วน ผู้ใช้ต้องเดาว่าอยู่หน้าไหน) */
const NAV_TILE =
  'nav-item relative flex min-h-[4.5rem] w-full max-w-[5rem] flex-col items-center justify-center gap-0.5 rounded-[1.35rem] px-1 py-1.5 [@media(max-height:500px)]:min-h-[3rem] [@media(max-height:500px)]:max-w-[9rem] [@media(max-height:500px)]:flex-row [@media(max-height:500px)]:gap-2 [@media(max-height:500px)]:py-1';
const NAV_LABEL = 'block max-w-full truncate text-xs font-bold leading-tight text-slate-900';

/**
 * เมนูล่างสำหรับมือถือและแท็บเล็ต (ซ่อนเมื่อจอกว้าง lg: 1024px ขึ้นไป ซึ่งใช้ Sidebar ซ้ายแทน)
 * - ประหยัดพื้นที่: มีเฉพาะโหมดสำคัญ (บันทึกอาการ ปฏิทิน สมาชิก ยาและการดูแล) กับปุ่ม "เมนู"
 *   โหมดอื่นเข้าทางหน้ารวมโหมด (/menu)
 * - แถบสีขาวลอยเหนือขอบจอ มุมโค้งเต็ม (pill) มีเงา
 * - แต่ละเมนูมีไอคอนและชื่อสั้นใต้ไอคอน (ชื่อที่เห็นเป็นชื่อเดียวกับที่ screen reader อ่าน)
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
      <ul className="mobile-paper pointer-events-auto mx-auto flex w-full max-w-md items-center gap-1 rounded-[1.75rem] p-2 [@media(max-height:500px)]:max-w-xl [@media(max-height:500px)]:p-1.5">
        {primary.map(({ to, label, mobileLabel, art, end }) => {
          const count = badges[to] ?? 0;
          return (
            <li key={to} className="flex flex-1 min-w-0 justify-center">
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(NAV_TILE, ART_STYLE[art].tile, isActive && 'nav-item-active ring-[3px] ring-[color:var(--accent)]')
                }
              >
                <ModeIcon name={art} className="h-8 w-8 [@media(max-height:500px)]:h-7 [@media(max-height:500px)]:w-7" />
                <span className={NAV_LABEL}>{mobileLabel ?? label}</span>
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
            className={cn(NAV_TILE, ART_STYLE.menu.tile, menuActive && 'nav-item-active ring-[3px] ring-[color:var(--accent)]')}
          >
            <ModeIcon name="menu" className="h-8 w-8 [@media(max-height:500px)]:h-7 [@media(max-height:500px)]:w-7" />
            <span className={NAV_LABEL}>เมนู</span>
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
