import React from 'react';
import { NavLink } from 'react-router-dom';
import { NAV_ITEMS, NAV_TINT } from './navItems';
import { cn } from '../../lib/cn';
import { canManageHome } from '../../lib/settings';
import { useSettings } from '../../lib/useSettings';
import { useNavBadges } from '../../lib/navBadges';

/**
 * เมนูล่างสำหรับมือถือและแท็บเล็ต (ซ่อนเมื่อจอกว้าง lg: 1024px ขึ้นไป ซึ่งใช้ Sidebar ซ้ายแทน)
 * - แถบสีขาวลอยเหนือขอบจอ มุมโค้งเต็ม (pill) มีเงา
 * - แต่ละเมนูเป็นวงกลม ไอคอนล้วน (ชื่อเมนูอ่านโดย screen reader ผ่าน aria-label)
 * - ป้ายแจ้งเตือนจำนวนการอัพเดตสีม่วงที่มุมบนขวาของไอคอน
 */
export const MobileNav: React.FC = () => {
  const isOwner = canManageHome(useSettings());
  const badges = useNavBadges();
  const VISIBLE_ITEMS = NAV_ITEMS.filter((item) => !item.hidden && !item.mobileHidden && (isOwner || !item.ownerOnly));

  return (
    <nav
      aria-label="เมนูหลักบนมือถือ"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none"
    >
      <ul className="pointer-events-auto mx-auto flex w-full max-w-md items-center gap-0.5 rounded-[1.75rem] bg-white p-1.5 ring-1 ring-purple-200 shadow-[0_14px_34px_-10px_rgba(90,90,208,0.55)]">
        {VISIBLE_ITEMS.map(({ to, label, mobileLabel, icon: Icon, end, tint }) => {
          const count = badges[to] ?? 0;
          return (
            <li key={to} className="flex flex-1 min-w-0 justify-center">
              <NavLink
                to={to}
                end={end}
                aria-label={mobileLabel ?? label}
                className={({ isActive }) =>
                  cn(
                    'nav-item relative flex aspect-square w-full max-w-[3.25rem] items-center justify-center rounded-[1.25rem]',
                    isActive
                      ? 'nav-item-active bg-purple-700 text-white'
                      : NAV_TINT[tint]
                  )
                }
              >
                <Icon className="w-6 h-6" strokeWidth={2.2} aria-hidden="true" />
                {count > 0 && (
                  <span
                    aria-label={`${count} รายการใหม่`}
                    className="anim-pop absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[22px] h-[22px] px-1 rounded-full bg-sun text-slate-900 text-xs font-extrabold ring-2 ring-white"
                  >
                    {count > 9 ? '9+' : count}
                  </span>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
