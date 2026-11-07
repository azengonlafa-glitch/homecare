import React from 'react';
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

interface ZoneGaugeProps {
  spec: GaugeSpec;
  /** null = ยังไม่มีข้อมูล */
  value: number | null;
}

/** แถบช่วงค่า: สีเขียว = ช่วงของคนสุขภาพดี ลูกศรชี้ตำแหน่งของคุณ */
export const ZoneGauge: React.FC<ZoneGaugeProps> = ({ spec, value }) => {
  const span = spec.max - spec.min;
  const pct = (v: number) => ((Math.min(spec.max, Math.max(spec.min, v)) - spec.min) / span) * 100;
  const zone = value === null ? null : zoneOf(spec, value);

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-base sm:text-lg font-bold text-slate-900">{spec.title}</h3>
        {value !== null && zone ? (
          <p className={cn('text-base font-bold', TONE_TEXT[zone.tone])}>
            {value.toFixed(spec.decimals)} {spec.unit} · {zone.label}
          </p>
        ) : (
          <p className="text-sm text-slate-500">ยังไม่มีข้อมูล</p>
        )}
      </div>

      <div
        role="img"
        aria-label={
          value !== null && zone
            ? `${spec.title} ${value.toFixed(spec.decimals)} ${spec.unit} อยู่ในช่วง ${zone.label}`
            : `${spec.title} ยังไม่มีข้อมูล`
        }
        className="relative mt-3 pt-6"
      >
        {value !== null && (
          <div
            className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
            style={{ left: `${pct(value)}%` }}
            aria-hidden="true"
          >
            <span className="px-2 py-0.5 rounded-full bg-slate-900 text-white text-xs font-bold whitespace-nowrap">
              คุณ
            </span>
            <span className="w-0 h-0 border-x-[6px] border-x-transparent border-t-[7px] border-t-slate-900" />
          </div>
        )}
        <div className={cn('flex h-4 rounded-full overflow-hidden', value === null && 'opacity-50')}>
          {spec.zones.map((z) => (
            <div
              key={z.label}
              className={cn(TONE_BG[z.tone], 'border-r border-white/70 last:border-r-0')}
              style={{ width: `${((z.to - z.from) / span) * 100}%` }}
            />
          ))}
        </div>
        <div className="flex mt-1.5" aria-hidden="true">
          {spec.zones.map((z) => (
            <div
              key={z.label}
              className={cn(
                'text-center text-xs sm:text-sm leading-tight px-0.5',
                z.tone === 'good' ? 'font-bold text-emerald-800' : 'text-slate-600'
              )}
              style={{ width: `${((z.to - z.from) / span) * 100}%` }}
            >
              {z.tone === 'good' && '✓ '}
              {z.label}
              <span className="block text-xs text-slate-500 font-normal">
                {z.from === spec.min ? `<${z.to}` : z.to === spec.max ? `≥${z.from}` : `${z.from}–${z.to}`}
              </span>
            </div>
          ))}
        </div>
      </div>
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
