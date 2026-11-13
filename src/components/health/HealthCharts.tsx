import React from 'react';
import { AlertTriangle, Check, Info, type LucideIcon } from 'lucide-react';
import { zoneOf, type GaugeSpec, type Tone } from '../../lib/healthAnalysis';
import { cn } from '../../lib/cn';

export const TONE_BG: Record<Tone, string> = {
  good: 'bg-emerald-400',
  warn: 'bg-amber-300',
  bad: 'bg-red-400',
};

export const TONE_TEXT: Record<Tone, string> = {
  good: 'text-emerald-800',
  warn: 'text-amber-800',
  bad: 'text-red-800',
};

export const TONE_SOFT: Record<Tone, string> = {
  good: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  warn: 'bg-amber-50 border-amber-200 text-amber-900',
  bad: 'bg-red-50 border-red-200 text-red-900',
};

interface ZoneCardProps {
  spec: GaugeSpec;
  /** null = ยังไม่มีข้อมูล */
  value: number | null;
  onAdd?: () => void;
}

const TONE_ICON_SM: Record<Tone, LucideIcon> = { good: Check, warn: Info, bad: AlertTriangle };

/** การ์ดค่าเดียว: ตัวเลขใหญ่ + ป้ายสถานะ (มีไอคอนและคำเสมอ) + แถบเล็กบอกตำแหน่ง + ช่วงปกติบรรทัดเดียว */
export const ZoneCard: React.FC<ZoneCardProps> = ({ spec, value, onAdd }) => {
  const span = spec.max - spec.min;
  const pct = (v: number) => ((Math.min(spec.max, Math.max(spec.min, v)) - spec.min) / span) * 100;
  const zone = value === null ? null : zoneOf(spec, value);
  const good = spec.zones.find((z) => z.tone === 'good');
  const goodText = good
    ? good.from === spec.min
      ? `ต่ำกว่า ${good.to}`
      : good.to === spec.max
        ? `ตั้งแต่ ${good.from} ขึ้นไป`
        : `${good.from}–${good.to}`
    : null;

  if (value === null || !zone) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-4">
        <p className="text-sm font-bold text-slate-600">{spec.title}</p>
        <p className="mt-1 text-base font-semibold text-slate-500">ยังไม่มีข้อมูล</p>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="mt-2 text-sm font-extrabold text-purple-800 hover:underline cursor-pointer"
          >
            + เพิ่มข้อมูล
          </button>
        )}
      </div>
    );
  }

  const Icon = TONE_ICON_SM[zone.tone];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-bold text-slate-600">{spec.title}</p>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <p className="text-2xl font-extrabold text-slate-900 tabular-nums">
          {value.toFixed(spec.decimals)}
          <span className="ml-1 text-sm font-bold text-slate-500">{spec.unit}</span>
        </p>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-sm font-extrabold',
            TONE_SOFT[zone.tone]
          )}
        >
          <Icon className="w-4 h-4" aria-hidden="true" />
          {zone.label}
        </span>
      </div>

      <div
        role="img"
        aria-label={`${spec.title} ${value.toFixed(spec.decimals)} ${spec.unit} อยู่ในช่วง ${zone.label}`}
        className="relative mt-3 h-3"
      >
        <div className="absolute inset-x-0 top-0.5 flex h-2 overflow-hidden rounded-full">
          {spec.zones.map((z) => (
            <div
              key={z.label}
              className={cn(TONE_BG[z.tone], z === zone ? 'opacity-100' : 'opacity-35')}
              style={{ width: `${((z.to - z.from) / span) * 100}%` }}
            />
          ))}
        </div>
        <span
          aria-hidden="true"
          className="absolute top-0 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-white bg-slate-900 shadow"
          style={{ left: `${pct(value)}%` }}
        />
      </div>

      {goodText && (
        <p className="mt-2 text-xs sm:text-sm text-slate-500">
          ช่วงปกติ {goodText} {spec.unit}
        </p>
      )}
    </div>
  );
};
