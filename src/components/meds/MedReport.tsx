import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Card } from '../ui/Card';
import { DayStrip, adherenceTone } from './MedDetailModal';
import {
  DOSE_STATUS_LABEL,
  LATE_THRESHOLD_MIN,
  PERIOD_LABEL,
  medStats,
  thaiDate,
  todayKey,
  type DoseLog,
  type Medication,
} from '../../lib/meds';
import { addDays } from '../../lib/calendar';
import { cn } from '../../lib/cn';

interface MedReportProps {
  meds: Medication[];
  logs: DoseLog[];
  onOpen: (med: Medication) => void;
}

const RANGES: { value: number | null; label: string }[] = [
  { value: 7, label: '7 วัน' },
  { value: 30, label: '30 วัน' },
  { value: 90, label: '90 วัน' },
  { value: null, label: 'ตั้งแต่เริ่ม' },
];

const barColor = (pct: number | null) =>
  pct === null ? 'bg-slate-300' : pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-500';

/** รายงานการใช้ยา: สรุปรวมทุกยาตามช่วงเวลา แยกรายยา และประวัติล่าสุด (กดยาเพื่อดูรายละเอียด) */
export const MedReport: React.FC<MedReportProps> = ({ meds, logs, onOpen }) => {
  const [range, setRange] = useState<number | null>(30);

  const rows = meds.map((med) => ({ med, stats: medStats(med, logs, { sinceDays: range }) }));
  const total = rows.reduce(
    (acc, { stats }) => ({
      expected: acc.expected + stats.expected,
      taken: acc.taken + stats.taken,
      missed: acc.missed + stats.missed + stats.unrecorded,
      skipped: acc.skipped + stats.skipped,
      late: acc.late + stats.late,
    }),
    { expected: 0, taken: 0, missed: 0, skipped: 0, late: 0 }
  );
  const denom = total.expected - total.skipped;
  const overall = denom > 0 ? Math.round((total.taken / denom) * 100) : null;

  const names = new Map(meds.map((m) => [m.id, m.name]));
  const since = range ? todayKey(addDays(new Date(), -(range - 1))) : '';
  const inRange = (key: string) => !since || key >= since;
  // เรื่องที่ควรรู้: ไม่ได้กิน (ไม่นับที่หมอสั่งงด) และกินช้า ใหม่ → เก่า
  const issues = logs
    .filter((l) => names.has(l.medId) && inRange(l.date) && (l.status === 'missed' || (l.status === 'taken' && l.lateMinutes)))
    .sort((a, b) => b.at.localeCompare(a.at));
  const recent = [...logs]
    .filter((l) => names.has(l.medId))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 12);

  return (
    <div className="space-y-5">
      <div role="group" aria-label="ช่วงเวลาของรายงาน" className="flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <button
            key={r.label}
            type="button"
            aria-pressed={range === r.value}
            onClick={() => setRange(r.value)}
            className={cn(
              'min-h-[44px] px-4 rounded-full border text-base font-semibold cursor-pointer',
              range === r.value
                ? 'bg-purple-700 border-purple-700 text-white'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-purple-50'
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      <Card className="p-5 sm:p-6">
        <h2 className="text-lg font-bold text-slate-900">ภาพรวม</h2>
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-4">
          <p className={cn('text-5xl font-extrabold', adherenceTone(overall))}>{overall === null ? '–' : `${overall}%`}</p>
          <div className="text-base text-slate-700">
            <p className="font-semibold">กินตามนัด</p>
            <p>
              กินแล้ว {total.taken} จาก {total.expected} มื้อ · ไม่ได้กิน/ไม่ได้บันทึก {total.missed} · กินช้า{' '}
              {total.late} · งดตามแพทย์สั่ง {total.skipped}
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-500">
          มื้อที่เลยเวลาแล้วแต่ไม่ได้บันทึก นับเป็นพลาด · กดกินช้าเกิน {LATE_THRESHOLD_MIN} นาทีนับเป็น “กินช้า” ·
          มื้อที่งดตามแพทย์สั่งไม่นำมาคิด
        </p>
      </Card>

      <Card className="p-5 sm:p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-3">ไม่ได้กิน / กินช้า</h2>
        {issues.length === 0 ? (
          <p className="text-base text-slate-600">ไม่มีในช่วงนี้ ยอดเยี่ยมมาก</p>
        ) : (
          <ul className="space-y-2.5">
            {issues.slice(0, 20).map((l) => (
              <li
                key={`${l.medId}-${l.date}-${l.period}`}
                className={cn(
                  'rounded-xl border px-4 py-3',
                  l.status === 'missed' ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50'
                )}
              >
                <p className="text-base font-bold text-slate-900 break-words">
                  {names.get(l.medId)} · {thaiDate(l.date, 'medium')} มื้อ{PERIOD_LABEL[l.period]}
                </p>
                <p className="text-sm text-slate-700">
                  {l.status === 'missed'
                    ? `ไม่ได้กิน${l.reason ? ` · เหตุผล: ${l.reason}` : ' · ไม่ได้ระบุเหตุผล'}`
                    : `กินช้ากว่ากำหนด ${l.lateMinutes} นาที`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-0 overflow-hidden">
        <h2 className="px-5 sm:px-6 pt-5 sm:pt-6 text-lg font-bold text-slate-900">แยกตามยา</h2>
        <ul className="mt-3 divide-y divide-slate-200 border-t border-slate-200">
          {rows.map(({ med, stats }) => (
            <li key={med.id}>
              <button
                type="button"
                onClick={() => onOpen(med)}
                className="w-full text-left px-5 sm:px-6 py-4 hover:bg-purple-50 cursor-pointer"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base sm:text-lg font-bold text-slate-900 break-words">
                      {med.name}
                      {!med.active && <span className="ml-2 text-sm font-semibold text-slate-500">(หยุดใช้แล้ว)</span>}
                    </p>
                    <p className="text-sm text-slate-600">
                      กินแล้ว {stats.taken}/{stats.expected} มื้อ · เริ่มนับ {thaiDate(stats.from, 'medium')}
                    </p>
                  </div>
                  <span className={cn('shrink-0 text-xl font-extrabold', adherenceTone(stats.adherence))}>
                    {stats.adherence === null ? '–' : `${stats.adherence}%`}
                  </span>
                  <ChevronRight className="w-5 h-5 shrink-0 text-slate-400" aria-hidden="true" />
                </div>
                <div className="mt-2 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', barColor(stats.adherence))}
                    style={{ width: `${stats.adherence ?? 0}%` }}
                  />
                </div>
                <div className="mt-3 max-w-md">
                  <DayStrip med={med} logs={logs} days={15} />
                </div>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-5 sm:p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-3">บันทึกล่าสุด</h2>
        {recent.length === 0 ? (
          <p className="text-base text-slate-600">ยังไม่มีการบันทึก</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((l: DoseLog) => (
              <li key={`${l.medId}-${l.date}-${l.period}`} className="flex flex-wrap items-baseline gap-x-2 text-base">
                <span className="font-semibold text-slate-900">{names.get(l.medId)}</span>
                <span className="text-slate-600">
                  {thaiDate(l.date, 'medium')} มื้อ{PERIOD_LABEL[l.period]} · {DOSE_STATUS_LABEL[l.status]}
                  {l.lateMinutes ? ` (ช้า ${l.lateMinutes} นาที)` : ''}
                  {l.reason ? ` · ${l.reason}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};
