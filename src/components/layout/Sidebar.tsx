import React from 'react';
import { NavLink } from 'react-router-dom';
import { HomeHeader } from './HomeHeader';
import { NAV_GROUP_META, NAV_ITEMS, NAV_TINT, type NavGroup } from './navItems';
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
    <aside className="hidden lg:flex lg:w-64 2xl:w-72 shrink-0 flex-col sticky top-0 h-dvh bg-peach-soft text-slate-900 rounded-r-[2.5rem] overflow-hidden">
      <span aria-hidden="true" className="blob-morph pointer-events-none absolute -bottom-16 -left-14 h-52 w-52 bg-peach" />
      <span aria-hidden="true" className="drift pointer-events-none absolute bottom-6 right-6 h-8 w-8 rounded-full bg-sun" />
      <div className="relative shrink-0 flex items-center">
        <HomeHeader variant="sidebar" />
      </div>

      <nav aria-label="เมนูหลัก" className="relative flex-1 overflow-y-auto overscroll-contain p-4 pb-32">
        {(['home', 'personal'] as NavGroup[]).map((group, groupIndex) => {
          const items = NAV_ITEMS.filter((item) => !item.hidden && (isOwner || !item.ownerOnly) && item.group === group);
          if (items.length === 0) return null;
          const meta = NAV_GROUP_META[group];
          return (
            <section
              key={group}
              aria-label={meta.title}
              className={groupIndex > 0 ? 'mt-5 pt-5 border-t border-peach' : ''}
            >
              <p className="px-4 mb-2 text-sm font-semibold text-slate-700">
                {meta.title} <span className="font-medium">· {meta.hint}</span>
              </p>
              <ul className="space-y-2">
                {items.map(({ to, label, icon: Icon, end, sidebarIcon, tint }) => {
                  const count = badges[to] ?? 0;
                  return (
                    <li key={to}>
                      <NavLink
                        to={to}
                        end={end}
                        className={({ isActive }) =>
                          cn(
                            'nav-item group flex items-center gap-3 min-h-[56px] pl-2.5 pr-4 rounded-[1.25rem] text-lg',
                            isActive
                              ? 'nav-item-active bg-purple-700 text-white font-semibold'
                              : 'font-medium text-slate-800 hover:bg-peach'
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                        {sidebarIcon && (
                          <span className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-colors', isActive ? 'bg-white/25 text-white' : NAV_TINT[tint])}>
                            <Icon className="w-5 h-5" aria-hidden="true" />
                          </span>
                        )}
                        <span className="flex-1 min-w-0 truncate">{label}</span>
                        {count > 0 && (
                          <span
                            aria-label={`${count} รายการอัพเดตใหม่`}
                            className="ml-auto inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-sun text-slate-900 text-xs font-extrabold shrink-0 anim-pop"
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


    </aside>
  );
};
