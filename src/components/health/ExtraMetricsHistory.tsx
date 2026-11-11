import React, { useState } from 'react';
import { Activity, Plus } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { EmptyNote, SectionTitle, shortDateTime } from '../member/memberUi';
import { TrendBlock } from './TrendChart';
import { EXTRA_METRICS, seriesOf, type ExtraMetric } from '../../lib/vitalMetrics';
import type { VitalReading } from '../../lib/members';

const MetricCard: React.FC<{ def: ExtraMetric; readings: VitalReading[] }> = ({ def, readings }) => {
  const [all, setAll] = useState(false);
  const points = seriesOf(readings, (r) => r[def.field]);
  if (points.length === 0) return null;
  const rows = readings
    .filter((r) => r[def.field] != null)
    .sort((a, b) => b.at.localeCompare(a.at));
  const shown = all ? rows : rows.slice(0, 4);

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-base sm:text-lg font-extrabold text-slate-900">{def.label}</h3>
        <p className="text-base font-extrabold text-slate-900 tabular-nums">
          {points[points.length - 1].v.toFixed(def.decimals)}
          <span className="ml-1 text-xs font-bold text-slate-500">{def.unit}</span>
        </p>
      </div>
      <TrendBlock
        series={[{ label: def.label, color: def.color, points }]}
        unit={def.unit}
        decimals={def.decimals}
        label={def.label}
      />
      <ul className="divide-y divide-slate-100">
        {shown.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="text-slate-500">{shortDateTime(r.at)}</span>
            <span className="font-extrabold text-slate-900 tabular-nums">
              {(r[def.field] as number).toFixed(def.decimals)} {def.unit}
            </span>
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

/** ค่าสุขภาพอื่น ๆ (ชีพจร SpO₂ อุณหภูมิ HbA1c รอบเอว ความปวด การนอน) พร้อมกราฟ */
export const ExtraMetricsHistory: React.FC<{
  readings: VitalReading[];
  editable: boolean;
  onAdd: () => void;
}> = ({ readings, editable, onAdd }) => {
  const withData = EXTRA_METRICS.filter((m) => readings.some((r) => r[m.field] != null));
  return (
    <Card className="shadow-xs space-y-3.5">
      <div className="flex items-center justify-between gap-2">
        <SectionTitle icon={Activity}>ค่าสุขภาพอื่น ๆ</SectionTitle>
        {editable && (
          <Button size="sm" variant="soft" onClick={onAdd}>
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>บันทึกค่า</span>
          </Button>
        )}
      </div>
      {withData.length === 0 ? (
        <EmptyNote>
          ยังไม่มีค่าชีพจร ออกซิเจน อุณหภูมิ HbA1c รอบเอว ความปวด หรือการนอนในช่วงเวลานี้
        </EmptyNote>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          {withData.map((m) => (
            <MetricCard key={m.key} def={m} readings={readings} />
          ))}
        </div>
      )}
    </Card>
  );
};
