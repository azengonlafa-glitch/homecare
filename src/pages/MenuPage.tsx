import React from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { NAV_GROUP_META, NAV_ITEMS, type NavGroup } from '../components/layout/navItems';
import { ART_STYLE, ModeIcon } from '../components/layout/ModeIcon';
import { cn } from '../lib/cn';
import { canManageHome } from '../lib/settings';
import { useSettings } from '../lib/useSettings';
import { useNavBadges } from '../lib/navBadges';

/**
 * หน้ารวมโหมดทั้งหมด: เมนูล่างบนมือถือมีแค่โหมดสำคัญเพื่อประหยัดพื้นที่
 * โหมดอื่นทั้งหมดเข้าได้จากหน้านี้ (ใช้บนจอคอมได้เช่นกัน)
 */
export const MenuPage: React.FC = () => {
  const isOwner = canManageHome(useSettings());
  const badges = useNavBadges();

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <PageHeader title="เมนู" description="เลือกหน้าที่ต้องการใช้งาน" />

      {(['home', 'personal'] as NavGroup[]).map((group) => {
        const items = NAV_ITEMS.filter((item) => !item.hidden && (isOwner || !item.ownerOnly) && item.group === group);
        if (items.length === 0) return null;
        const meta = NAV_GROUP_META[group];
        return (
          <section key={group} aria-label={meta.title} className="space-y-3">
            <h2 className="bg-label text-lg font-extrabold text-slate-900">
              <span aria-hidden="true" className="bg-label-dot" />
              {meta.title} <span className="text-sm font-semibold text-slate-700">· {meta.hint}</span>
            </h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {items.map(({ to, label, art, description }) => {
                const count = badges[to] ?? 0;
                const style = ART_STYLE[art];
                return (
                  <li key={to}>
                    <Link
                      to={to}
                      className={cn(
                        'hover-lift relative flex h-full min-h-[11rem] flex-col items-center justify-center gap-2 rounded-[1.75rem] px-3 py-5 text-center ring-2 ring-transparent hover:ring-white',
                        style.tile
                      )}
                    >
                      <ModeIcon name={art} className="h-20 w-20 sm:h-24 sm:w-24" />
                      <span className={cn('text-base font-extrabold leading-snug sm:text-lg', style.label)}>{label}</span>
                      {description && (
                        <span className="text-xs leading-snug text-slate-600 sm:text-sm">{description}</span>
                      )}
                      {count > 0 && (
                        <span
                          aria-label={`${count} รายการใหม่`}
                          className="absolute right-3 top-3 inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-sun px-1 text-xs font-extrabold text-slate-900"
                        >
                          {count > 9 ? '9+' : count}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
};
