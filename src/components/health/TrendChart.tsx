import React from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { summarize, type TrendPoint } from '../../lib/vitalMetrics';

export interface TrendSeries {
  label: string;
  color: string;
  points: TrendPoint[];
}

const shortDate = (t: number) => new Date(t).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });

const fmt = (v: number, decimals: number) => v.toFixed(decimals);

/** กราฟเส้นแนวโน้มตามเวลา (SVG ล้วน) ไม่ตัดสินว่าค่าดีหรือไม่ดี แสดงเฉพาะการเปลี่ยนแปลง */
export const TrendChart: React.FC<{
  series: TrendSeries[];
  unit: string;
  decimals?: number;
  ariaLabel: string;
}> = ({ series, unit, decimals = 0, ariaLabel }) => {
  const W = 600;
  const H = 210;
  const L = 46;
  const R = 16;
  const T = 16;
  const B = 30;

  const all = series.flatMap((s) => s.points);
  if (all.length === 0) return null;

  const tMin = Math.min(...all.map((p) => p.t));
  const tMax = Math.max(...all.map((p) => p.t));
  let vMin = Math.min(...all.map((p) => p.v));
  let vMax = Math.max(...all.map((p) => p.v));
  if (vMin === vMax) {
    vMin -= 1;
    vMax += 1;
  } else {
    const pad = (vMax - vMin) * 0.15;
    vMin -= pad;
    vMax += pad;
  }

  const x = (t: number) => (tMax === tMin ? (L + W - R) / 2 : L + ((t - tMin) / (tMax - tMin)) * (W - L - R));
  const y = (v: number) => T + (1 - (v - vMin) / (vMax - vMin)) * (H - T - B);
  const ticks = [vMin + (vMax - vMin) * 0.1, (vMin + vMax) / 2, vMax - (vMax - vMin) * 0.1];

  return (
    <div>
      {series.length > 1 && (
        <ul className="mb-1 flex flex-wrap gap-x-4 gap-y-1 text-xs sm:text-sm font-bold text-slate-700">
          {series.map((s) => (
            <li key={s.label} className="inline-flex items-center gap-1.5">
              <span className="h-1 w-5 rounded-full" style={{ background: s.color }} aria-hidden="true" />
              {s.label}
            </li>
          ))}
        </ul>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="w-full h-auto">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="stroke-slate-200" strokeWidth="1" />
            <text x={L - 8} y={y(v)} textAnchor="end" dominantBaseline="middle" className="fill-slate-500 text-[13px]">
              {fmt(v, decimals)}
            </text>
          </g>
        ))}
        <text x={L} y={H - 8} textAnchor="start" className="fill-slate-500 text-[13px]">
          {shortDate(tMin)}
        </text>
        {tMax !== tMin && (
          <text x={W - R} y={H - 8} textAnchor="end" className="fill-slate-500 text-[13px]">
            {shortDate(tMax)}
          </text>
        )}

        {series.map((s) => (
          <g key={s.label}>
            {s.points.length > 1 && (
              <polyline
                points={s.points.map((p) => `${x(p.t)},${y(p.v)}`).join(' ')}
                fill="none"
                stroke={s.color}
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
            {s.points.map((p, i) => (
              <circle key={i} cx={x(p.t)} cy={y(p.v)} r="4.5" fill="#fff" stroke={s.color} strokeWidth="3">
                <title>{`${s.label}: ${fmt(p.v, decimals)} ${unit} (${shortDate(p.t)})`}</title>
              </circle>
            ))}
            {(() => {
              const last = s.points[s.points.length - 1];
              return (
                <text
                  x={Math.min(x(last.t), W - R - 4)}
                  y={y(last.v) - 11}
                  textAnchor="middle"
                  className="text-[14px] font-bold"
                  fill={s.color}
                >
                  {fmt(last.v, decimals)}
                </text>
              );
            })()}
          </g>
        ))}
      </svg>
    </div>
  );
};

/** กราฟเล็กไม่มีแกน ใช้เห็นแนวโน้มคร่าว ๆ ในแถวสรุป */
export const Sparkline: React.FC<{ points: TrendPoint[]; color?: string; label: string }> = ({
  points,
  color = '#15703A',
  label,
}) => {
  if (points.length < 2) return null;
  const pts = points.slice(-12);
  const W = 80;
  const H = 28;
  const t0 = pts[0].t;
  const t1 = pts[pts.length - 1].t;
  const lo = Math.min(...pts.map((p) => p.v));
  const hi = Math.max(...pts.map((p) => p.v));
  const x = (t: number) => 3 + (t1 === t0 ? 0 : ((t - t0) / (t1 - t0)) * (W - 6));
  const y = (v: number) => (hi === lo ? H / 2 : 3 + (1 - (v - lo) / (hi - lo)) * (H - 6));
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="h-7 w-20 shrink-0">
      <polyline
        points={pts.map((p) => `${x(p.t)},${y(p.v)}`).join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={x(last.t)} cy={y(last.v)} r="3" fill={color} />
    </svg>
  );
};

/** สรุปการเปลี่ยนแปลง + กราฟ (ถ้ามีข้อมูลน้อยกว่า 2 ครั้ง บอกให้บันทึกเพิ่ม) */
export const TrendBlock: React.FC<{
  series: TrendSeries[];
  unit: string;
  decimals?: number;
  label: string;
}> = ({ series, unit, decimals = 0, label }) => {
  const main = series[0];
  const sum = summarize(main.points, decimals);
  if (!sum) return null;
  const Icon = sum.direction === 'up' ? ArrowUpRight : sum.direction === 'down' ? ArrowDownRight : Minus;
  const dirText = sum.direction === 'up' ? 'เพิ่มขึ้น' : sum.direction === 'down' ? 'ลดลง' : 'คงที่';

  return (
    <div className="rounded-2xl bg-purple-50/50 p-3.5 space-y-2">
      {sum.count < 2 ? (
        <p className="text-sm font-semibold text-slate-700">
          มีข้อมูล 1 ครั้ง บันทึกอีกครั้งเพื่อดูแนวโน้ม
        </p>
      ) : (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm sm:text-base font-bold text-slate-800">
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 ring-1 ring-purple-200">
            <Icon className="w-4 h-4 text-purple-700" aria-hidden="true" />
            {dirText}
            {sum.direction !== 'flat' && ` ${Math.abs(sum.delta).toFixed(decimals)} ${unit}`}
          </span>
          <span className="text-xs sm:text-sm font-semibold text-slate-600">
            จาก {sum.first.toFixed(decimals)} เป็น {sum.last.toFixed(decimals)} {unit} ({sum.count} ครั้งในช่วงนี้)
          </span>
        </p>
      )}
      <TrendChart
        series={series}
        unit={unit}
        decimals={decimals}
        ariaLabel={`กราฟ${label} ${sum.count} ครั้ง ล่าสุด ${sum.last.toFixed(decimals)} ${unit}`}
      />
    </div>
  );
};
