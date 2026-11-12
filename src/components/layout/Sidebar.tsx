import React from 'react';
import { NavLink } from 'react-router-dom';
import { HomeHeader } from './HomeHeader';
import { NAV_GROUP_META, NAV_ITEMS, type NavGroup } from './navItems';
import { ART_STYLE, ModeIcon } from './ModeIcon';
import { cn } from '../../lib/cn';
import { canManageHome } from '../../lib/settings';
import { useSettings } from '../../lib/useSettings';
import { useNavBadges } from '../../lib/navBadges';

/**
 * Sidebar ซ้าย (จอกว้าง lg: 1024px ขึ้นไป เช่น iPad แนวนอน หรือคอมพิวเตอร์)
 * จอเล็ก/มือถือจะใช้เมนูล่างแบบแท็บแทน
 *
 * แสดงป้ายแจ้งเตือนสีม่วงบอกจำนวนการอัพเดตของแต่ละช่องทางขวามือเหมือนใน Discord
 */
export const Sidebar: React.FC = () => {
  const isOwner = canManageHome(useSettings());
  const badges = useNavBadges();

  return (
    <aside className="sidebar-paper hidden lg:flex lg:w-64 2xl:w-72 shrink-0 flex-col sticky top-0 h-dvh text-slate-900 rounded-r-[2.5rem] overflow-hidden">
      <div className="relative shrink-0 flex items-center">
        <HomeHeader variant="sidebar" />
      </div>

      <nav aria-label="เมนูหลัก" className="relative flex-1 overflow-y-auto overscroll-contain p-4 pb-12 [@media(max-height:800px)]:p-3 [@media(max-height:800px)]:pb-12">
        {(['home', 'personal'] as NavGroup[]).map((group, groupIndex) => {
          const items = NAV_ITEMS.filter((item) => !item.hidden && (isOwner || !item.ownerOnly) && item.group === group);
          if (items.length === 0) return null;
          const meta = NAV_GROUP_META[group];
          return (
            <section
              key={group}
              aria-label={meta.title}
              className={groupIndex > 0 ? 'mt-5 pt-5 border-t-2 border-dashed border-slate-200 [@media(max-height:800px)]:mt-3 [@media(max-height:800px)]:pt-3' : ''}
            >
              <p className="px-4 mb-2 text-sm font-semibold text-slate-700">
                {meta.title} <span className="font-medium">· {meta.hint}</span>
              </p>
              <ul className="space-y-2 [@media(max-height:800px)]:space-y-1">
                {items.map(({ to, label, art, end, sidebarIcon }) => {
                  const count = badges[to] ?? 0;
                  return (
                    <li key={to}>
                      <NavLink
                        to={to}
                        end={end}
                        className={({ isActive }) =>
                          cn(
                            'nav-item group flex items-center gap-3 min-h-[56px] [@media(max-height:800px)]:min-h-[48px] pl-2.5 pr-4 rounded-[1.25rem] text-lg',
                            isActive
                              ? 'nav-item-active tab-stripe text-white font-semibold'
                              : 'font-medium text-slate-800 hover:bg-slate-100'
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                        {sidebarIcon && (
                          <span className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-colors', isActive ? 'bg-white' : ART_STYLE[art].tile)}>
                            <ModeIcon name={art} className="h-7 w-7" />
                          </span>
                        )}
                        <span className="flex-1 min-w-0 truncate">{label}</span>
                        {count > 0 && (
                          <span
                            aria-label={`${count} รายการอัปเดตใหม่`}
                            className="badge-beat ml-auto inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-sun text-slate-900 text-xs font-extrabold shrink-0 anim-pop"
                          >
                            {count > 99 ? '99+' : count}
                          </span>
                        )}
                          </>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </nav>

      {/* แถบจางล่างเมนู: บอกว่ายังมีเมนูให้เลื่อนดูต่อ (บนจอเตี้ย "ตั้งค่าส่วนตัว" อยู่ใต้จอ) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#FFFDF7] to-transparent" />
    </aside>
  );
};
