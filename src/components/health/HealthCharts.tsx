import React from 'react';
import { AlertTriangle, Check, Info, type LucideIcon } from 'lucide-react';
import { zoneOf, type AxisScore, type GaugeSpec, type Tone } from '../../lib/healthAnalysis';
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

interface ScoreRingProps {
  score: number;
  label: string;
  tone: Tone;
}

const RING_STROKE: Record<Tone, string> = {
  good: 'stroke-emerald-500',
  warn: 'stroke-amber-400',
  bad: 'stroke-red-500',
};

/** วงกลมคะแนนรวม (100 = เหมือนคนสุขภาพดี) */
export const ScoreRing: React.FC<ScoreRingProps> = ({ score, label, tone }) => {
  const r = 54;
  const c = 2 * Math.PI * r;
  return (
    <div
      role="img"
      aria-label={`คะแนนสุขภาพโดยรวม ${score} จาก 100 ระดับ ${label}`}
      className="relative w-40 h-40 shrink-0"
    >
      <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90" aria-hidden="true">
        <circle cx="70" cy="70" r={r} fill="none" strokeWidth="14" className="stroke-slate-200" />
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          className={RING_STROKE[tone]}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
        <span className="text-4xl font-extrabold text-slate-900 leading-none">{score}</span>
        <span className="text-sm text-slate-500">จาก 100</span>
      </div>
    </div>
  );
};

/** กราฟใยแมงมุม: เส้นประเขียว = คนสุขภาพดี (100 ทุกด้าน) พื้นม่วง = คุณ */
export const RadarChart: React.FC<{ axes: AxisScore[] }> = ({ axes }) => {
  const cx = 200;
  const cy = 165;
  const R = 100;
  const n = axes.length;
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const point = (i: number, ratio: number) => ({
    x: cx + Math.cos(angle(i)) * R * ratio,
    y: cy + Math.sin(angle(i)) * R * ratio,
  });
  const poly = (ratio: (i: number) => number | null) =>
    axes
      .map((_, i) => ({ r: ratio(i), i }))
      .filter((p): p is { r: number; i: number } => p.r !== null)
      .map(({ r, i }) => {
        const pt = point(i, r);
        return `${pt.x},${pt.y}`;
      })
      .join(' ');

  const summary = axes.map((a) => `${a.label} ${a.score ?? 'ไม่มีข้อมูล'}`).join(', ');

  return (
    <svg
      viewBox="0 0 400 330"
      role="img"
      aria-label={`กราฟเทียบกับคนสุขภาพดี ${summary}`}
      className="w-full max-w-md mx-auto h-auto"
    >
      {[0.25, 0.5, 0.75, 1].map((ring) => (
        <polygon
          key={ring}
          points={axes
            .map((_, i) => {
              const pt = point(i, ring);
              return `${pt.x},${pt.y}`;
            })
            .join(' ')}
          fill="none"
          className="stroke-slate-200"
          strokeWidth="1"
        />
      ))}
      {axes.map((_, i) => {
        const pt = point(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={pt.x} y2={pt.y} className="stroke-slate-200" strokeWidth="1" />;
      })}

      {/* คนสุขภาพดี */}
      <polygon
        points={poly(() => 1)}
        className="fill-emerald-400/10 stroke-emerald-500"
        strokeWidth="2"
        strokeDasharray="6 4"
      />

      {/* คุณ */}
      <polygon
        points={poly((i) => (axes[i].score === null ? null : axes[i].score! / 100))}
        className="fill-purple-600/25 stroke-purple-700"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {axes.map((a, i) => {
        if (a.score === null) return null;
        const pt = point(i, a.score / 100);
        return <circle key={a.key} cx={pt.x} cy={pt.y} r="4.5" className="fill-purple-700 stroke-white" strokeWidth="2" />;
      })}

      {axes.map((a, i) => {
        const pt = point(i, 1.2);
        const cos = Math.cos(angle(i));
        const anchor = Math.abs(cos) < 0.2 ? 'middle' : cos > 0 ? 'start' : 'end';
        return (
          <text
            key={a.key}
            x={pt.x}
            y={pt.y}
            textAnchor={anchor}
            dominantBaseline="middle"
            className={cn('text-[13px] font-semibold', a.score === null ? 'fill-slate-400' : 'fill-slate-700')}
          >
            {a.label}
          </text>
        );
      })}
    </svg>
  );
};
