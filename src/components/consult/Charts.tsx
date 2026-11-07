import React, { useEffect, useRef, useState } from 'react';
import type { DayPoint } from '../../consult/dashboard';

const H = 230;
const PAD = { left: 36, right: 12, top: 14, bottom: 28 };

const shortDate = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });

/** ค่าสูงสุดของแกนตั้ง ปัดเป็นจำนวนเต็มที่อ่านง่าย (อย่างน้อย 4 เพื่อให้เส้นไม่ติดเพดานเมื่อมีน้อย) */
function niceMax(max: number): number {
  if (max <= 4) return 4;
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  return Math.ceil(max / step) * step;
}

interface LineChartProps {
  days: DayPoint[];
  /** ชื่อกราฟสำหรับผู้ใช้โปรแกรมอ่านหน้าจอ */
  label: string;
}

/** กราฟเส้น 2 เส้น: คำขอที่เข้ามา (ม่วง เส้นทึบ) และเคสที่ปิดจบ (เขียว เส้นประ) แยกเส้นด้วยลายเส้นไม่พึ่งสีอย่างเดียว */
export const LineChart: React.FC<LineChartProps> = ({ days, label }) => {
  // วัดความกว้างจริงของกล่อง แล้ววาดด้วยพิกเซลจริง ตัวหนังสือแกนจะไม่เล็กลงเมื่อจอแคบ
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setW(Math.max(280, Math.floor(el.clientWidth)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const max = niceMax(Math.max(0, ...days.map((d) => Math.max(d.requests, d.completed))));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (days.length === 1 ? innerW / 2 : (i / (days.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const path = (pick: (d: DayPoint) => number) => days.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(pick(d)).toFixed(1)}`).join(' ');
  const ticks = [0, max / 2, max];
  const labelIdx = Array.from(new Set([0, Math.floor((days.length - 1) / 2), days.length - 1]));
  const showDots = days.length <= 31;
  const total = days.reduce((s, d) => s + d.requests, 0);

  return (
    <div ref={box}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label} รวม ${total} คำขอ ใน ${days.length} วัน`} className="block max-w-full">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeWidth="1" />
            <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" fontSize="14" fill="#475569">
              {t}
            </text>
          </g>
        ))}
        <path d={path((d) => d.completed)} fill="none" stroke="#047857" strokeWidth="2.5" strokeDasharray="6 4" strokeLinejoin="round" strokeLinecap="round" />
        <path d={path((d) => d.requests)} fill="none" stroke="#5051C3" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {showDots &&
          days.map((d, i) => (
            <g key={d.date}>
              <circle cx={x(i)} cy={y(d.requests)} r="3.5" fill="#5051C3">
                <title>{`${shortDate(d.date)}: คำขอ ${d.requests} เคส, ปิดจบ ${d.completed} เคส`}</title>
              </circle>
            </g>
          ))}
        {labelIdx.map((i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : i === days.length - 1 ? 'end' : 'middle'} fontSize="14" fill="#475569">
            {shortDate(days[i].date)}
          </text>
        ))}
      </svg>
      <ul className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm font-semibold text-slate-700">
        <li className="flex items-center gap-2">
          <svg width="28" height="8" aria-hidden="true">
            <line x1="0" y1="4" x2="28" y2="4" stroke="#5051C3" strokeWidth="3" />
          </svg>
          คำขอที่เข้ามา
        </li>
        <li className="flex items-center gap-2">
          <svg width="28" height="8" aria-hidden="true">
            <line x1="0" y1="4" x2="28" y2="4" stroke="#047857" strokeWidth="2.5" strokeDasharray="6 4" />
          </svg>
          ปรึกษาจบ
        </li>
      </ul>
      <details className="mt-2">
        <summary className="cursor-pointer text-sm font-semibold text-purple-800">ดูตัวเลขรายวันเป็นตาราง</summary>
        <div className="mt-2 max-h-64 overflow-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-slate-700">
              <tr>
                <th scope="col" className="px-3 py-2">วันที่</th>
                <th scope="col" className="px-3 py-2">คำขอ</th>
                <th scope="col" className="px-3 py-2">ปรึกษาจบ</th>
              </tr>
            </thead>
            <tbody>
              {[...days].reverse().map((d) => (
                <tr key={d.date} className="border-t border-slate-100">
                  <td className="px-3 py-1.5">{shortDate(d.date)}</td>
                  <td className="px-3 py-1.5">{d.requests}</td>
                  <td className="px-3 py-1.5">{d.completed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
};

interface BarItem {
  label: string;
  value: number;
  /** ข้อความท้ายแถว เช่น "5 เคส" */
  text?: string;
}

/** แท่งแนวนอนเรียงรายการ ความกว้างเทียบกับค่าสูงสุด */
export const BarList: React.FC<{ items: BarItem[]; color?: string; empty?: string }> = ({ items, color = 'bg-purple-600', empty = 'ยังไม่มีข้อมูล' }) => {
  const max = Math.max(0, ...items.map((i) => i.value));
  if (max === 0) return <p className="text-base text-slate-600">{empty}</p>;
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.label} className="grid grid-cols-[5.5rem_1fr_4.5rem] items-center gap-3 text-sm sm:grid-cols-[7rem_1fr_5rem]">
          <span className="font-semibold text-slate-800">{i.label}</span>
          <span className="h-3 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
            <span className={`block h-full rounded-full ${color}`} style={{ width: `${(i.value / max) * 100}%` }} />
          </span>
          <span className="text-right font-bold text-slate-900">{i.text ?? i.value}</span>
        </li>
      ))}
    </ul>
  );
};

/** แท่งแนวตั้ง 24 ชั่วโมง บอกช่วงเวลาที่คนเข้ามามาก */
export const HourBars: React.FC<{ values: number[] }> = ({ values }) => {
  const max = Math.max(0, ...values);
  if (max === 0) return <p className="text-base text-slate-600">ยังไม่มีข้อมูล</p>;
  return (
    <div>
      <div className="flex h-28 items-end gap-0.5" role="img" aria-label={`จำนวนคำขอแยกตามชั่วโมง ช่วงที่มากที่สุดคือ ${String(values.indexOf(max)).padStart(2, '0')}:00 น. ${max} คำขอ`}>
        {values.map((v, h) => (
          <div key={h} className="flex h-full flex-1 items-end" title={`${String(h).padStart(2, '0')}:00 น. ${v} คำขอ`}>
            <div className={v === max ? 'w-full rounded-t bg-purple-700' : 'w-full rounded-t bg-purple-300'} style={{ height: `${Math.max(v > 0 ? 6 : 2, (v / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-sm font-semibold text-slate-600" aria-hidden="true">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>23:00</span>
      </div>
    </div>
  );
};
