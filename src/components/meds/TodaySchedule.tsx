import React from 'react';
import { Check, CircleDashed, PartyPopper } from 'lucide-react';
import { Card } from '../ui/Card';
import { StockBadge } from './StockBadge';
import {
  DOSE_STATUS_LABEL,
  PERIODS,
  currentPeriod,
  findLog,
  instructionText,
  isDue,
  isScheduledOn,
  periodTime,
  stockLevel,
  todayKey,
  type DoseLog,
  type DosePeriod,
  type DoseStatus,
  type Medication,
} from '../../lib/meds';
import { CURRENT_MEMBER_ID } from '../../lib/settings';
import { cn } from '../../lib/cn';

interface TodayScheduleProps {
  meds: Medication[];
  logs: DoseLog[];
  onSet: (med: Medication, period: DosePeriod, status: DoseStatus | null) => void;
}

const STATUS_CHIP: Record<DoseStatus | 'none', string> = {
  none: 'bg-white border-slate-300 text-slate-700',
  taken: 'bg-emerald-50 border-emerald-400 text-emerald-900',
  missed: 'bg-rose-50 border-rose-300 text-rose-900',
  skipped: 'bg-amber-50 border-amber-300 text-amber-900',
};

const ALT_BUTTON: Record<'missed' | 'skipped', string> = {
  missed: 'bg-rose-50 border-rose-200 text-rose-900 hover:bg-rose-100',
  skipped: 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100',
};

const timeLabel = (iso: string) =>
  `${new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })} น.`;

const SmallButton: React.FC<{
  status: 'missed' | 'skipped';
  onClick: () => void;
}> = ({ status, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'inline-flex items-center justify-center min-h-[48px] px-5 rounded-xl border text-base font-bold transition-colors cursor-pointer',
      ALT_BUTTON[status]
    )}
  >
    {status === 'missed' ? 'พลาดมื้อนี้' : status === 'skipped' ? 'งดตามแพทย์สั่ง' : ''}
  </button>
);

const DoseItem: React.FC<{
  med: Medication;
  period: DosePeriod;
  log: DoseLog | undefined;
  onSet: (status: DoseStatus | null) => void;
}> = ({ med, period, log, onSet }) => {
  const status = log?.status;
  const overdue = !status && isDue(med, period);
  const chipText = status ? DOSE_STATUS_LABEL[status] : overdue ? 'เลยเวลาแล้ว' : 'ยังไม่ได้บันทึก';
  const level = stockLevel(med);
  const exact = med.times[period];

  return (
    <li className="py-5 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {exact && <p className="text-2xl font-bold text-emerald-700 tabular-nums">{exact} น.</p>}
          <p className="text-lg sm:text-xl font-bold text-slate-900 break-words">{med.name}</p>
          <p className="mt-0.5 text-base text-slate-600">
            {instructionText(med)}
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-full border text-sm sm:text-base font-bold',
            overdue ? 'bg-red-50 border-red-300 text-red-800' : STATUS_CHIP[status ?? 'none']
          )}
        >
          {status === 'taken' ? (
            <Check className="w-4 h-4" aria-hidden="true" />
          ) : (
            !status && <CircleDashed className="w-4 h-4" aria-hidden="true" />
          )}
          {chipText}
        </span>
      </div>

      {level !== 'good' && !status && (
        <div className="mt-2">
          <StockBadge med={med} />
        </div>
      )}

      {!log ? (
        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={() => onSet('taken')}
            className="w-full inline-flex items-center justify-center gap-2 min-h-[58px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xl font-bold shadow-sm transition-colors cursor-pointer"
          >
            <Check className="w-6 h-6" aria-hidden="true" />
            <span>กินแล้ว</span>
          </button>
          <div className="flex flex-wrap gap-2">
            <SmallButton status="missed" onClick={() => onSet('missed')} />
            <SmallButton status="skipped" onClick={() => onSet('skipped')} />
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-base font-semibold text-emerald-800">
            บันทึกเมื่อ {timeLabel(log.at)} · โดย {log.byId === CURRENT_MEMBER_ID ? 'คุณ' : log.byName}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base text-slate-600">บันทึกผิด? แก้เป็น</span>
            {log.status !== 'taken' && (
              <button
                type="button"
                onClick={() => onSet('taken')}
                className="inline-flex items-center min-h-[48px] px-5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-900 text-base font-bold hover:bg-emerald-100 cursor-pointer"
              >
                กินแล้ว
              </button>
            )}
            {log.status !== 'missed' && <SmallButton status="missed" onClick={() => onSet('missed')} />}
            {log.status !== 'skipped' && <SmallButton status="skipped" onClick={() => onSet('skipped')} />}
            <button
              type="button"
              onClick={() => onSet(null)}
              className="inline-flex items-center min-h-[48px] px-3 rounded-xl text-base font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              ล้างบันทึก
            </button>
          </div>
        </div>
      )}
    </li>
  );
};

/** ตารางกินยาวันนี้: เป็น to-do แยกตามช่วงเวลาของวัน กดบันทึกว่ากินแล้ว/พลาด/งด */
export const TodaySchedule: React.FC<TodayScheduleProps> = ({ meds, logs, onSet }) => {
  const date = todayKey();
  const now = currentPeriod();

  // เฉพาะยาที่ใช้อยู่และต้องกินวันนี้ (คิดวันเริ่ม จำนวนวัน และวันในสัปดาห์) เรียงตามเวลาที่ตั้งไว้
  const todays = meds.filter((m) => m.active && isScheduledOn(m, date));
  const groups = PERIODS.map((p) => ({
    ...p,
    items: todays
      .filter((m) => m.periods.includes(p.value))
      .sort((a, b) => periodTime(a, p.value).localeCompare(periodTime(b, p.value))),
  })).filter((g) => g.items.length > 0);

  if (groups.length === 0) {
    return (
      <Card className="py-12 px-6 text-center">
        <PartyPopper className="w-12 h-12 text-purple-300 mx-auto mb-3" aria-hidden="true" />
        <p className="text-lg font-bold text-slate-900">วันนี้ไม่มียาที่ต้องกิน</p>
        <p className="mt-1 text-base text-slate-600">ยาที่ตั้งให้กินบางวัน หรือหยุดใช้แล้ว จะไม่ขึ้นในวันนี้</p>
      </Card>
    );
  }

  const all = groups.flatMap((g) => g.items.map((m) => findLog(logs, date, m.id, g.value)));
  const total = all.length;
  const recorded = all.filter(Boolean).length;
  const taken = all.filter((l) => l?.status === 'taken').length;
  const allDone = total > 0 && recorded === total;

  return (
    <div className="space-y-5">
      <Card className="p-5 sm:p-6">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-lg font-bold text-slate-900">
            {new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <p className="text-base font-semibold text-slate-600">
            บันทึกแล้ว {recorded}/{total} มื้อ
          </p>
        </div>
        <div
          role="progressbar"
          aria-label="ความคืบหน้าการบันทึกการกินยาวันนี้"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={recorded}
          className="mt-3 h-3 rounded-full bg-slate-100 overflow-hidden"
        >
          <div
            className="h-full rounded-full bg-emerald-500 transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${total ? (recorded / total) * 100 : 0}%` }}
          />
        </div>
        {allDone && (
          <p className="mt-3 flex items-center gap-2 text-base font-bold text-emerald-800">
            <PartyPopper className="w-5 h-5" aria-hidden="true" />
            บันทึกครบทุกมื้อแล้ว กินแล้ว {taken} จาก {total} มื้อ
          </p>
        )}
      </Card>

      {groups.map((group) => {
        const done = group.items.filter((m) => findLog(logs, date, m.id, group.value)).length;
        const isNow = group.value === now;
        return (
          <Card
            key={group.value}
            className={cn('p-5 sm:p-6', isNow && 'border-purple-400 ring-2 ring-purple-200')}
          >
            <div className="flex items-center justify-between gap-3 mb-5">
              <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                {group.label}
                {isNow && (
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-700 text-white text-sm font-bold">
                    ช่วงนี้
                  </span>
                )}
              </h2>
              <span className="text-base text-slate-500">
                {done}/{group.items.length}
              </span>
            </div>
            <ul className="divide-y divide-slate-200">
              {group.items.map((med) => (
                <DoseItem
                  key={med.id}
                  med={med}
                  period={group.value}
                  log={findLog(logs, date, med.id, group.value)}
                  onSet={(status) => onSet(med, group.value, status)}
                />
              ))}
            </ul>
          </Card>
        );
      })}
    </div>
  );
};
