import React, { useState } from 'react';
import { Activity, ChevronDown, Plus } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { EmptyNote, SectionTitle, shortDateTime } from '../member/memberUi';
import { TrendBlock } from './TrendChart';
import { CATEGORY_ICON } from './VitalsStepModal';
import { cn } from '../../lib/cn';
import {
  EXTRA_METRICS,
  METRIC_CATEGORIES,
  formatMetric,
  metricValue,
  seriesOf,
  type ExtraMetric,
} from '../../lib/vitalMetrics';
import type { VitalReading } from '../../lib/members';

const MetricCard: React.FC<{ def: ExtraMetric; readings: VitalReading[] }> = ({ def, readings }) => {
  const [all, setAll] = useState(false);
  const points = seriesOf(readings, (r) => metricValue(r, def));
  if (points.length === 0) return null;
  const rows = readings.filter((r) => metricValue(r, def) != null).sort((a, b) => b.at.localeCompare(a.at));
  const shown = all ? rows : rows.slice(0, 4);

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-base sm:text-lg font-extrabold text-slate-900">{def.label}</h3>
        <p className="shrink-0 text-base font-extrabold text-slate-900 tabular-nums">{formatMetric(def, points[points.length - 1].v)}</p>
      </div>
      <TrendBlock series={[{ label: def.label, color: def.color, points }]} unit={def.unit} decimals={def.decimals} label={def.label} />
      <ul className="divide-y divide-slate-100">
        {shown.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="text-slate-500">{shortDateTime(r.at)}</span>
            <span className="font-extrabold text-slate-900 tabular-nums">{formatMetric(def, metricValue(r, def) as number)}</span>
          </li>
        ))}
      </ul>
      {rows.length > 4 && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="w-full rounded-xl py-1.5 text-sm font-extrabold text-purple-800 hover:bg-purple-50 cursor-pointer"
        >
          {all ? 'แสดงน้อยลง' : `ดูทั้งหมด (${rows.length})`}
        </button>
      )}
    </div>
  );
};

/** ค่าสุขภาพอื่น ๆ และผลตรวจ แบ่งตามหมวด กดหัวหมวดเพื่อเปิด/ปิด แต่ละค่ามีกราฟและรายการย้อนหลัง */
export const ExtraMetricsHistory: React.FC<{
  readings: VitalReading[];
  editable: boolean;
  onAdd: () => void;
}> = ({ readings, editable, onAdd }) => {
  const withData = EXTRA_METRICS.filter((m) => readings.some((r) => metricValue(r, m) != null));
  const groups = METRIC_CATEGORIES.map((c) => ({ c, metrics: withData.filter((m) => m.category === c.id) })).filter((g) => g.metrics.length > 0);
  const [open, setOpen] = useState<Set<string>>(() => new Set(groups.slice(0, 1).map((g) => g.c.id)));
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Card className="shadow-xs space-y-3.5">
      <div className="fit-row justify-between">
        <div className="flex-1">
          <SectionTitle icon={Activity}>ค่าสุขภาพอื่น ๆ และผลตรวจ</SectionTitle>
        </div>
        {editable && (
          <Button size="sm" variant="soft" onClick={onAdd}>
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>บันทึกค่า</span>
          </Button>
        )}
      </div>
      {groups.length === 0 ? (
        <EmptyNote>ยังไม่มีค่าสัญญาณชีพอื่น ผลตรวจเลือด น้ำเข้า-ออก ความปวด หรือการนอนในช่วงเวลานี้</EmptyNote>
      ) : (
        <ul className="space-y-2.5">
          {groups.map(({ c, metrics }) => {
            const Icon = CATEGORY_ICON[c.id];
            const isOpen = open.has(c.id);
            return (
              <li key={c.id} className="rounded-2xl border border-slate-200 bg-white/70">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => toggle(c.id)}
                  className="flex w-full min-h-[60px] items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left cursor-pointer hover:bg-white"
                >
                  <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', c.tint)}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-bold text-slate-900">{c.label}</span>
                    <span className="block text-sm text-slate-600">{metrics.map((m) => m.label.replace(/\s*\(.*\)$/, '')).join(' · ')}</span>
                  </span>
                  <ChevronDown className={cn('h-5 w-5 shrink-0 text-slate-500 transition-transform', isOpen && 'rotate-180')} aria-hidden="true" />
                </button>
                {isOpen && (
                  <div className="anim-fade-up grid grid-cols-1 gap-3.5 p-3 pt-0 lg:grid-cols-2">
                    {metrics.map((m) => (
                      <MetricCard key={m.key} def={m} readings={readings} />
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
};
