import React, { useState } from 'react';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Gauge,
  HeartPulse,
  NotebookPen,
  Pill,
  Plus,
  Stethoscope,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Dino } from '../ui/Dino';
import { Sparkline } from './TrendChart';
import { cn } from '../../lib/cn';
import { dayCells, symptomFrequency, type DayCell } from '../../lib/dailyRecord';
import type { JournalPost } from '../../lib/journal';
import type { VitalReading } from '../../lib/members';
import { CATEGORY_ICON } from './VitalsStepModal';
import {
  EXTRA_METRICS,
  METRIC_CATEGORIES,
  metricValue,
  seriesOf,
  shortLabel,
  summarize,
  type MetricCategoryId,
  type TrendPoint,
} from '../../lib/vitalMetrics';
import { moodMeta, type MoodKey } from '../../data/journalOptions';

/** หมวดในแท็บประวัติที่กดไปดูต่อได้ */
export type ProgressTarget = 'symptoms' | 'bp' | 'glucose' | 'weight' | 'other' | 'meds';

interface ProgressOverviewProps {
  memberName: string;
  /** ช่วงวันที่ (YYYY-MM-DD) */
  range: { from: string; to: string };
  rangeLabel: string;
  readings: VitalReading[];
  posts: JournalPost[];
  /** % กินยาตามนัดในช่วงนี้ (null = ไม่มียา/ยังไม่มีข้อมูล) */
  adherence: number | null;
  keyOf: (iso: string) => string;
  onOpen: (target: ProgressTarget) => void;
  /** มีสิทธิ์บันทึก -> แสดงปุ่มบันทึกวันนี้ */
  onRecord?: () => void;
}

const pad = (n: number) => String(n).padStart(2, '0');
const keyOfDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};
function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const end = parseKey(to);
  for (let d = parseKey(from); d <= end && out.length < 400; d.setDate(d.getDate() + 1)) out.push(keyOfDate(d));
  return out;
}
const shortDay = (k: string) => parseKey(k).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
const weekday = (k: string) => parseKey(k).toLocaleDateString('th-TH', { weekday: 'short' });

const MOOD_CELL: Record<MoodKey, string> = {
  great: 'bg-emerald-400',
  complicated: 'bg-amber-300',
  down: 'bg-rose-400',
};

interface MetricTile {
  key: string;
  category: MetricCategoryId;
  target: ProgressTarget;
  label: string;
  unit: string;
  decimals: number;
  color: string;
  points: TrendPoint[];
  /** ข้อความค่าล่าสุด (เช่น ความดันแสดง 125/80) */
  latestText?: string;
  /** ข้อความค่าเฉลี่ย (เช่น ความดันแสดง 125/80) */
  avgText?: string;
  /** คำนำหน้าการเปลี่ยนแปลง (เช่น "ตัวบน") เมื่อกราฟใช้ค่าเดียวจากหลายค่า */
  changePrefix?: string;
}

const fmt = (v: number, d: number) => v.toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d });

/** การ์ดค่าสุขภาพหนึ่งตัว: ค่าล่าสุด เปลี่ยนไปเท่าไรจากต้นช่วง ค่าเฉลี่ย และกราฟเส้นเล็ก (ไม่ตัดสินว่าดีหรือไม่ดี) */
const MetricCard: React.FC<{ tile: MetricTile; onOpen: () => void }> = ({ tile, onOpen }) => {
  const s = summarize(tile.points, tile.decimals);
  if (!s) return null;
  const avg = tile.points.reduce((sum, p) => sum + p.v, 0) / tile.points.length;
  const lastAt = tile.points[tile.points.length - 1].t;
  const Arrow = s.direction === 'up' ? ArrowUpRight : s.direction === 'down' ? ArrowDownRight : ArrowRight;
  const change =
    s.count < 2
      ? 'วัดครั้งเดียวในช่วงนี้'
      : s.direction === 'flat'
        ? 'เท่าเดิมจากต้นช่วง'
        : `${tile.changePrefix ? `${tile.changePrefix}` : ''}${s.direction === 'up' ? 'เพิ่มขึ้น' : 'ลดลง'} ${fmt(Math.abs(s.delta), tile.decimals)} ${tile.unit} จากต้นช่วง`;

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="group flex h-full w-full flex-col gap-2 rounded-2xl border border-slate-200 bg-white/85 p-4 text-left cursor-pointer hover:border-slate-300 hover:bg-white"
      >
        <span className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: tile.color }} />
            {tile.label}
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
        <span className="flex items-end justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-2xl font-extrabold leading-tight tabular-nums text-slate-900">
              {tile.latestText ?? fmt(s.last, tile.decimals)}
              <span className="ml-1 text-sm font-bold text-slate-600">{tile.unit}</span>
            </span>
            <span className="block text-xs text-slate-600">ล่าสุด {new Date(lastAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span>
          </span>
          <Sparkline points={tile.points} color={tile.color} label={`แนวโน้ม${tile.label}`} />
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-dashed border-slate-200 pt-2 text-sm">
          <span className="inline-flex items-center gap-1 font-bold text-slate-800">
            <Arrow className="h-4 w-4 shrink-0" aria-hidden="true" />
            {change}
          </span>
          <span className="text-slate-600">
            เฉลี่ย {tile.avgText ?? fmt(avg, tile.decimals)} · {s.count} ครั้ง
          </span>
        </span>
      </button>
    </li>
  );
};

/** ปฏิทินอารมณ์และอาการรายวัน: สีช่อง = อารมณ์ · จุดแดง = มีอาการ */
const DayGrid: React.FC<{ cells: DayCell[] }> = ({ cells }) => {
  const compact = cells.length > 10;
  // จัดเป็นสัปดาห์ (จันทร์–อาทิตย์) ให้อ่านง่ายแบบปฏิทิน
  const lead = compact ? (parseKey(cells[0].day).getDay() + 6) % 7 : 0;
  const describe = (c: DayCell) =>
    `${shortDay(c.day)}: ${c.mood ? moodMeta(c.mood)?.label : c.posts > 0 ? 'บันทึกแล้ว ไม่ระบุอารมณ์' : 'ไม่มีบันทึก'}${c.symptoms > 0 ? ` · อาการ ${c.symptoms} อย่าง` : ''}`;

  return (
    <div>
      {compact && (
        <div className="mb-1 grid grid-cols-7 gap-1.5 text-center text-xs font-semibold text-slate-500" aria-hidden="true">
          {['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
      )}
      <ul className={cn('grid gap-1.5', compact ? 'grid-cols-7' : 'grid-cols-7')}>
        {Array.from({ length: lead }, (_, i) => (
          <li key={`lead-${i}`} aria-hidden="true" />
        ))}
        {cells.map((c) => (
          <li key={c.day} title={describe(c)} className="flex flex-col items-center gap-1">
            <span className="sr-only">{describe(c)}</span>
            <span
              aria-hidden="true"
              className={cn(
                'relative w-full rounded-lg',
                compact ? 'aspect-square' : 'h-12',
                c.mood ? MOOD_CELL[c.mood] : c.posts > 0 ? 'bg-slate-300' : 'border-2 border-dashed border-slate-200 bg-white/60'
              )}
            >
              {c.symptoms > 0 && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-600 ring-2 ring-white" />
              )}
            </span>
            {!compact && (
              <span aria-hidden="true" className="text-xs font-semibold text-slate-600">
                {weekday(c.day)}
              </span>
            )}
          </li>
        ))}
      </ul>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-semibold text-slate-700" aria-label="คำอธิบายสี">
        {(['great', 'complicated', 'down'] as MoodKey[]).map((k) => (
          <li key={k} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={cn('h-3.5 w-3.5 rounded', MOOD_CELL[k])} />
            {moodMeta(k)?.label}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-3.5 w-3.5 rounded bg-slate-300" />
          ไม่ระบุอารมณ์
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-red-600" />
          มีอาการ
        </li>
      </ul>
    </div>
  );
};

const Stat: React.FC<{ icon: React.ComponentType<{ className?: string }>; label: string; value: string; tint: string }> = ({
  icon: Icon,
  label,
  value,
  tint,
}) => (
  <li className="flex items-center gap-3 rounded-2xl bg-white/85 p-3 ring-1 ring-slate-200">
    <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', tint)}>
      <Icon className="h-6 w-6" aria-hidden="true" />
    </span>
    <span className="min-w-0">
      <span className="block text-xl font-extrabold leading-tight tabular-nums text-slate-900">{value}</span>
      <span className="block text-xs font-semibold text-slate-600">{label}</span>
    </span>
  </li>
);

/**
 * ภาพรวมพัฒนาการในช่วงเวลา: สรุปตัวเลข, การ์ดค่าสุขภาพแต่ละตัว (กดเพื่อดูกราฟเต็มในแท็บประวัติ),
 * ปฏิทินอารมณ์/อาการรายวัน และอาการที่พบบ่อย
 * แสดงเฉพาะการเปลี่ยนแปลง ไม่ตัดสินว่าค่าดีหรือไม่ดี (การแปลผลเป็นหน้าที่ของแพทย์/เภสัชกร)
 */
export const ProgressOverview: React.FC<ProgressOverviewProps> = ({
  memberName,
  range,
  rangeLabel,
  readings,
  posts,
  adherence,
  keyOf,
  onOpen,
  onRecord,
}) => {
  // หมวดที่เปิดอยู่ (เริ่มเปิด 2 หมวดแรกที่มีข้อมูล ที่เหลือพับไว้ ให้หน้าไม่ยาวเกินไป)
  const [openCats, setOpenCats] = useState<Set<MetricCategoryId> | null>(null);
  const inRange = (k: string) => k >= range.from && k <= range.to;
  const rs = readings.filter((r) => inRange(keyOf(r.at)));
  const ps = posts.filter((p) => inRange(keyOf(p.createdAt)));
  const days = daysBetween(range.from, range.to);
  const cells = dayCells(ps, days, keyOf);
  const daysRecorded = cells.filter((c) => c.posts > 0).length;
  const symptoms = symptomFrequency(ps);
  const maxSym = symptoms[0]?.count ?? 1;

  const sys = seriesOf(rs, (r) => (r.diastolic != null ? r.systolic : undefined));
  const bpPairs = rs.filter((r) => r.systolic != null && r.diastolic != null);
  const avgOf = (vals: number[]) => Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  const bpAvgText = bpPairs.length
    ? `${avgOf(bpPairs.map((r) => r.systolic as number))}/${avgOf(bpPairs.map((r) => r.diastolic as number))}`
    : undefined;
  const lastBp = [...rs].filter((r) => r.systolic != null && r.diastolic != null).sort((a, b) => b.at.localeCompare(a.at))[0];
  const allTiles: MetricTile[] = [
    { key: 'bp', category: 'vitals', target: 'bp' as const, label: 'ความดัน', unit: 'mmHg', decimals: 0, color: '#15703A', points: sys, latestText: lastBp ? `${lastBp.systolic}/${lastBp.diastolic}` : undefined, avgText: bpAvgText, changePrefix: 'ตัวบน' },
    { key: 'glucose', category: 'sugar', target: 'glucose' as const, label: 'น้ำตาลในเลือด', unit: 'มก./ดล.', decimals: 0, color: '#E8913A', points: seriesOf(rs, (r) => r.glucose) },
    { key: 'weight', category: 'body', target: 'weight' as const, label: 'น้ำหนัก', unit: 'กก.', decimals: 1, color: '#1FA38A', points: seriesOf(rs, (r) => r.weightKg) },
    ...EXTRA_METRICS.map((m) => ({
      key: m.key,
      category: m.category,
      target: 'other' as const,
      label: shortLabel(m),
      unit: m.unit,
      decimals: m.decimals,
      color: m.color,
      points: seriesOf(rs, (r) => metricValue(r, m)),
    })),
  ];
  const tiles = allTiles.filter((t) => t.points.length > 0);
  const groups = METRIC_CATEGORIES.map((c) => ({ c, tiles: tiles.filter((t) => t.category === c.id) })).filter((g) => g.tiles.length > 0);

  const moodCounts = (['great', 'complicated', 'down'] as MoodKey[]).map((k) => ({ k, n: cells.filter((c) => c.mood === k).length }));
  const symptomDays = cells.filter((c) => c.symptoms > 0).length;

  if (rs.length === 0 && ps.length === 0) {
    return (
      <Card className="py-10 text-center">
        <Dino pose="sleep" bob className="mx-auto mb-3 h-28 w-32" />
        <p className="text-lg font-bold text-slate-900">ยังไม่มีบันทึกของ{memberName}ในช่วง {rangeLabel}</p>
        <p className="mt-1 text-base text-slate-600">บันทึกอาการและค่าสุขภาพทุกวัน แล้วพัฒนาการจะขึ้นที่นี่</p>
        {onRecord && (
          <Button className="mt-5" onClick={onRecord}>
            <Plus className="h-5 w-5" aria-hidden="true" />
            บันทึกวันนี้
          </Button>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* 1) ตัวเลขสรุป */}
      <ul className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={NotebookPen} tint="bg-peach text-orange-800" label="บันทึกประจำวัน" value={`${ps.length} ครั้ง`} />
        <Stat icon={CalendarDays} tint="bg-sun-soft text-amber-800" label={`วันที่มีบันทึก (จาก ${days.length} วัน)`} value={`${daysRecorded} วัน`} />
        <Stat icon={Gauge} tint="bg-sky-soft text-sky-800" label="วัดค่าสุขภาพ" value={`${rs.length} ครั้ง`} />
        <Stat icon={Pill} tint="bg-mint-soft text-teal-800" label="กินยาตามนัด" value={adherence === null ? '–' : `${adherence}%`} />
      </ul>

      {/* 2) ค่าสุขภาพแต่ละตัว */}
      <Card className="p-4 sm:p-6 space-y-4">
        <div className="fit-row justify-between">
          <h2 className="flex-1 flex items-center gap-2 text-lg sm:text-xl font-bold text-slate-900">
            <HeartPulse className="h-6 w-6 shrink-0 text-purple-700" aria-hidden="true" />
            ค่าสุขภาพช่วง {rangeLabel}
          </h2>
          {onRecord && (
            <Button size="sm" variant="soft" onClick={onRecord}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              บันทึกค่า
            </Button>
          )}
        </div>
        {tiles.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-slate-200 p-5 text-center text-base text-slate-600">
            ยังไม่ได้วัดค่าสุขภาพในช่วงนี้ · ใส่ค่าได้ในบันทึกประจำวัน
          </p>
        ) : (
          <ul className="space-y-2.5">
            {groups.map(({ c, tiles: list }, i) => {
              const Icon = CATEGORY_ICON[c.id];
              const isOpen = openCats ? openCats.has(c.id) : i < 2;
              const toggle = () =>
                setOpenCats((prev) => {
                  const next = new Set(prev ?? groups.slice(0, 2).map((g) => g.c.id));
                  if (next.has(c.id)) next.delete(c.id);
                  else next.add(c.id);
                  return next;
                });
              return (
                <li key={c.id} className="rounded-2xl border border-slate-200 bg-white/60">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={toggle}
                    className="flex w-full min-h-[60px] items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left cursor-pointer hover:bg-white"
                  >
                    <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', c.tint)}>
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-bold text-slate-900">
                        {c.label} <span className="font-semibold text-slate-600">· {list.length} ค่า</span>
                      </span>
                      <span className="block truncate text-sm text-slate-600">{list.map((t) => t.label).join(' · ')}</span>
                    </span>
                    <ChevronDown className={cn('h-5 w-5 shrink-0 text-slate-500 transition-transform', isOpen && 'rotate-180')} aria-hidden="true" />
                  </button>
                  {isOpen && (
                    <ul className="stagger grid grid-cols-1 gap-3 p-3 pt-0 sm:grid-cols-2 xl:grid-cols-3">
                      {list.map((t) => (
                        <MetricCard key={t.key} tile={t} onOpen={() => onOpen(t.target)} />
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-slate-600">
          แสดงการเปลี่ยนแปลงเท่านั้น ไม่ได้ประเมินว่าค่าดีหรือไม่ดี · กดการ์ดเพื่อดูกราฟเต็มและรายการทั้งหมด
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-5 lg:items-start">
        {/* 3) ปฏิทินอารมณ์และอาการ */}
        <Card className="p-4 sm:p-6 space-y-3 lg:col-span-3">
          <h2 className="flex items-center gap-2 text-lg sm:text-xl font-bold text-slate-900">
            <CalendarDays className="h-6 w-6 shrink-0 text-purple-700" aria-hidden="true" />
            อารมณ์และอาการรายวัน
          </h2>
          <p className="text-sm text-slate-700">
            {moodCounts.map(({ k, n }) => `${moodMeta(k)?.label} ${n} วัน`).join(' · ')} · มีอาการ {symptomDays} วัน
          </p>
          <DayGrid cells={cells} />
        </Card>

        {/* 4) อาการที่พบบ่อย */}
        <Card className="p-4 sm:p-6 space-y-3 lg:col-span-2">
          <div className="fit-row justify-between">
            <h2 className="flex-1 flex items-center gap-2 text-lg sm:text-xl font-bold text-slate-900">
              <Stethoscope className="h-6 w-6 shrink-0 text-purple-700" aria-hidden="true" />
              อาการที่พบบ่อย
            </h2>
            {ps.length > 0 && (
              <button type="button" onClick={() => onOpen('symptoms')} className="inline-flex min-h-[44px] items-center gap-1 rounded-full px-3 text-sm font-bold text-purple-800 hover:bg-white cursor-pointer">
                ดูบันทึกทั้งหมด
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
          {symptoms.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-slate-200 p-5 text-center text-base text-slate-600">ไม่มีการบันทึกอาการในช่วงนี้</p>
          ) : (
            <ul className="space-y-2.5">
              {symptoms.map((s) => (
                <li key={s.name}>
                  <div className="flex items-baseline justify-between gap-3 text-base">
                    <span className="min-w-0 break-words font-bold text-slate-900">{s.name}</span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-700">{s.count} ครั้ง</span>
                  </div>
                  <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                    <div className="progress-grow h-full rounded-full bg-rose-400" style={{ width: `${Math.max(8, (s.count / maxSym) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
};
