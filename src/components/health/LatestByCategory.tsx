import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { CATEGORY_ICON } from './VitalsStepModal';
import { cn } from '../../lib/cn';
import type { VitalReading } from '../../lib/members';
import { EXTRA_METRICS, METRIC_CATEGORIES, formatMetric, metricValue, type ExtraMetric } from '../../lib/vitalMetrics';

const relative = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'วันนี้';
  if (days === 1) return 'เมื่อวาน';
  if (days < 30) return `${days} วันก่อน`;
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
};

/**
 * ค่าล่าสุดของค่าอื่น ๆ (นอกจากความดัน น้ำตาล น้ำหนัก) แบ่งเป็นหมวด
 * แถวหมวดบอกจำนวนค่าและวันล่าสุด กดแล้วจึงแตกเป็นรายการค่า (คนทั่วไปไม่ต้องเห็นตัวเลขเยอะ ผู้ดูแลกดดูได้)
 */
export const LatestByCategory: React.FC<{ readings: VitalReading[] }> = ({ readings }) => {
  const [open, setOpen] = useState<string | null>(null);

  const latest = (m: ExtraMetric) => {
    let best: VitalReading | null = null;
    for (const r of readings) if (metricValue(r, m) != null && (!best || r.at > best.at)) best = r;
    return best ? { m, v: metricValue(best, m) as number, at: best.at } : null;
  };
  const rows = EXTRA_METRICS.map(latest).filter((x): x is { m: ExtraMetric; v: number; at: string } => !!x);
  const groups = METRIC_CATEGORIES.map((c) => ({ c, rows: rows.filter((r) => r.m.category === c.id) })).filter((g) => g.rows.length > 0);
  if (groups.length === 0) return null;

  return (
    <div className="border-t border-slate-100 pt-3">
      <p className="mb-1.5 text-xs font-bold text-slate-500">ค่าอื่น ๆ ล่าสุด (กดหมวดเพื่อดู)</p>
      <ul className="space-y-1.5">
        {groups.map(({ c, rows: list }) => {
          const Icon = CATEGORY_ICON[c.id];
          const isOpen = open === c.id;
          const newest = list.reduce((a, b) => (b.at > a.at ? b : a)).at;
          return (
            <li key={c.id} className="rounded-xl bg-slate-50/80 ring-1 ring-slate-100">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : c.id)}
                className="flex w-full min-h-[52px] items-center gap-2.5 rounded-xl px-2.5 py-2 text-left cursor-pointer hover:bg-white"
              >
                <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', c.tint)}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-slate-900">{c.label}</span>
                  <span className="block text-xs text-slate-600">
                    {list.length} ค่า · ล่าสุด {relative(newest)}
                  </span>
                </span>
                <ChevronDown className={cn('h-5 w-5 shrink-0 text-slate-500 transition-transform', isOpen && 'rotate-180')} aria-hidden="true" />
              </button>
              {isOpen && (
                <ul className="anim-fade-up divide-y divide-slate-100 px-3 pb-2">
                  {list.map(({ m, v, at }) => (
                    <li key={m.key} className="flex items-baseline justify-between gap-3 py-2">
                      <span className="min-w-0 text-sm text-slate-700">
                        {m.group && <span className="block text-xs text-slate-500">{m.group}</span>}
                        {m.label}
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-base font-extrabold tabular-nums text-slate-900">{formatMetric(m, v)}</span>
                        <span className="block text-xs text-slate-500">{relative(at)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
