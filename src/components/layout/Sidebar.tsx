import React from 'react';
import { NavLink } from 'react-router-dom';
import { HomeHeader } from './HomeHeader';
import { NAV_GROUP_META, NAV_ITEMS, type NavGroup } from './navItems';
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
    <aside className="hidden lg:flex lg:w-64 2xl:w-72 shrink-0 flex-col sticky top-0 h-dvh bg-white border-r border-slate-200">
      <div className="shrink-0 flex items-center border-b border-slate-200">
        <HomeHeader variant="sidebar" />
      </div>

      <nav aria-label="เมนูหลัก" className="flex-1 overflow-y-auto p-4">
        {(['home', 'personal'] as NavGroup[]).map((group, groupIndex) => {
          const items = NAV_ITEMS.filter((item) => !item.hidden && (isOwner || !item.ownerOnly) && item.group === group);
          if (items.length === 0) return null;
          const meta = NAV_GROUP_META[group];
          return (
            <section
              key={group}
              aria-label={meta.title}
              className={groupIndex > 0 ? 'mt-5 pt-5 border-t border-slate-200' : ''}
            >
              <p className="px-4 mb-2 text-sm font-bold text-slate-500">
                {meta.title} <span className="font-medium">· {meta.hint}</span>
              </p>
              <ul className="space-y-2">
                {items.map(({ to, label, icon: Icon, end, sidebarIcon }) => {
                  const count = badges[to] ?? 0;
                  return (
                    <li key={to}>
                      <NavLink
                        to={to}
                        end={end}
                        className={({ isActive }) =>
                          cn(
                            'group flex items-center gap-3 min-h-[54px] px-4 rounded-2xl text-lg transition-all duration-200',
                            isActive
                              ? 'bg-purple-100 text-purple-900 font-bold shadow-xs'
                              : 'font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 hover:translate-x-0.5'
                          )
                        }
                      >
                        {sidebarIcon && <Icon className="w-6 h-6 shrink-0" aria-hidden="true" />}
                        <span className="flex-1 min-w-0 truncate">{label}</span>
                        {count > 0 && (
                          <span
                            aria-label={`${count} รายการอัพเดตใหม่`}
                            className="ml-auto inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-purple-600 text-white text-xs font-extrabold shadow-xs shrink-0 anim-pop"
                          >
                            {count > 99 ? '99+' : count}
                          </span>
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

      <div className="p-4 border-t border-slate-200">
        <p className="text-xs text-slate-500 text-center">ดูแลยาและสุขภาพของครอบครัว</p>
      </div>
    </aside>
  );
};
