import React, { useState } from 'react';
import { Check, CircleDashed, Clock, PartyPopper, X } from 'lucide-react';
import { Card } from '../ui/Card';
import { StockBadge } from './StockBadge';
import { MedPhoto } from './MedPhoto';
import {
  DOSE_STATUS_LABEL,
  LATE_THRESHOLD_MIN,
  PERIODS,
  SKIP_REASONS,
  currentPeriod,
  findLog,
  instructionText,
  isOverdue,
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
  /** reason = เหตุผลที่ไม่ได้กิน (ใช้เมื่อ status เป็น missed/skipped) */
  onSet: (med: Medication, period: DosePeriod, status: DoseStatus | null, reason?: string) => void;
}

const STATUS_CHIP: Record<DoseStatus | 'none', string> = {
  none: 'bg-white border-slate-300 text-slate-700',
  taken: 'bg-emerald-50 border-emerald-400 text-emerald-900',
  missed: 'bg-rose-50 border-rose-300 text-rose-900',
  skipped: 'bg-amber-50 border-amber-300 text-amber-900',
};

const timeLabel = (iso: string) =>
  `${new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })} น.`;

/** กล่องถามเหตุผลเมื่อกด "ไม่กิน" */
const SkipReasonPanel: React.FC<{
  onConfirm: (status: 'missed' | 'skipped', reason: string) => void;
  onCancel: () => void;
}> = ({ onConfirm, onCancel }) => {
  const [key, setKey] = useState('');
  const [text, setText] = useState('');
  const chosen = SKIP_REASONS.find((r) => r.value === key);
  const needsText = key === 'other';
  const canSave = !!chosen && (!needsText || text.trim().length > 0);

  return (
    <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50/60 p-4 space-y-3">
      <p className="text-base font-bold text-slate-900">ทำไมถึงไม่ได้กินมื้อนี้?</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="เหตุผลที่ไม่ได้กินยา">
        {SKIP_REASONS.map((r) => (
          <button
            key={r.value}
            type="button"
            aria-pressed={key === r.value}
            onClick={() => setKey(r.value)}
            className={cn(
              'min-h-[44px] px-4 rounded-full border text-base font-semibold cursor-pointer transition-colors',
              key === r.value
                ? 'bg-purple-700 border-purple-700 text-white'
                : 'bg-white border-slate-300 text-slate-800 hover:bg-purple-50'
            )}
          >
            {r.label}
          </button>
        ))}
      </div>
      {chosen && (
        <div className="space-y-2">
          <label htmlFor="skip-reason-text" className="block text-sm font-bold text-slate-700">
            {needsText ? 'พิมพ์เหตุผล' : 'รายละเอียดเพิ่มเติม (ไม่บังคับ)'}
          </label>
          <input
            id="skip-reason-text"
            type="text"
            value={text}
            autoFocus
            autoComplete="off"
            maxLength={120}
            onChange={(e) => setText(e.target.value)}
            placeholder={needsText ? 'เช่น ติดธุระด่วน' : 'เช่น หมอนัดตรวจเลือดเช้านี้'}
            className="w-full min-h-[50px] px-5 bg-white border border-slate-300 rounded-2xl text-base text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-600"
          />
          <p className="text-sm text-slate-600">
            {chosen.status === 'skipped'
              ? 'หมอสั่งให้งดจะไม่นับว่าพลาด'
              : 'มื้อนี้จะถูกบันทึกเป็นไม่ได้กินลงในรายงาน'}
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[48px] rounded-xl border border-slate-300 bg-white text-base font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
        >
          ยกเลิก
        </button>
        <button
          type="button"
          disabled={!canSave}
          onClick={() => {
            if (!chosen) return;
            const detail = text.trim();
            onConfirm(
              chosen.status,
              needsText ? detail : detail ? `${chosen.label} · ${detail}` : chosen.label
            );
          }}
          className="min-h-[48px] rounded-xl bg-purple-700 text-base font-bold text-white hover:bg-purple-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          บันทึก
        </button>
      </div>
    </div>
  );
};

const DoseItem: React.FC<{
  med: Medication;
  period: DosePeriod;
  log: DoseLog | undefined;
  onSet: (status: DoseStatus | null, reason?: string) => void;
}> = ({ med, period, log, onSet }) => {
  const [asking, setAsking] = useState(false);
  const status = log?.status;
  const overdue = !status && isOverdue(med, period);
  const chipText = status ? DOSE_STATUS_LABEL[status] : overdue ? 'เลยเวลาแล้ว' : 'ยังไม่ได้บันทึก';
  const level = stockLevel(med);
  const exact = med.times[period];
  const time = periodTime(med, period);

  const confirmSkip = (next: 'missed' | 'skipped', reason: string) => {
    setAsking(false);
    onSet(next, reason);
  };

  return (
    <li className="py-5 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <MedPhoto
          med={med}
          className="h-16 w-16 shrink-0 rounded-2xl bg-purple-50 overflow-hidden"
          fallback={null}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {exact && <p className="text-2xl font-bold text-emerald-700 tabular-nums">{exact} น.</p>}
              <p className="text-lg sm:text-xl font-bold text-slate-900 break-words">{med.name}</p>
              <p className="mt-0.5 text-base text-slate-600">{instructionText(med)}</p>
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
        </div>
      </div>

      {level !== 'good' && !status && (
        <div className="mt-2">
          <StockBadge med={med} />
        </div>
      )}

      {!log ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setAsking(false);
                onSet('taken');
              }}
              className="inline-flex items-center justify-center gap-2 min-h-[58px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xl font-bold shadow-sm transition-colors cursor-pointer"
            >
              <Check className="w-6 h-6" aria-hidden="true" />
              <span>กิน</span>
            </button>
            <button
              type="button"
              aria-expanded={asking}
              onClick={() => setAsking((v) => !v)}
              className={cn(
                'inline-flex items-center justify-center gap-2 min-h-[58px] rounded-2xl border-2 text-xl font-bold transition-colors cursor-pointer',
                asking
                  ? 'border-rose-400 bg-rose-50 text-rose-900'
                  : 'border-slate-300 bg-white text-slate-800 hover:bg-rose-50 hover:border-rose-300'
              )}
            >
              <X className="w-6 h-6" aria-hidden="true" />
              <span>ไม่กิน</span>
            </button>
          </div>
          {asking && <SkipReasonPanel onConfirm={confirmSkip} onCancel={() => setAsking(false)} />}
        </>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-base font-semibold text-slate-800">
            บันทึกเมื่อ {timeLabel(log.at)} · โดย {log.byId === CURRENT_MEMBER_ID ? 'คุณ' : log.byName}
          </p>
          {log.status === 'taken' && log.lateMinutes ? (
            <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-300 px-3 py-1 text-sm font-bold text-amber-900">
              <Clock className="w-4 h-4" aria-hidden="true" />
              กินช้ากว่ากำหนด {log.lateMinutes} นาที (เกิน {LATE_THRESHOLD_MIN} นาที บันทึกลงรายงาน)
            </p>
          ) : null}
          {log.reason && <p className="text-base text-slate-700">เหตุผล: {log.reason}</p>}
          {log.status !== 'taken' && (
            <p className="text-sm text-slate-500">กำหนดเดิม {time} น.</p>
          )}

          {asking ? (
            <SkipReasonPanel onConfirm={confirmSkip} onCancel={() => setAsking(false)} />
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base text-slate-600">บันทึกผิด? แก้เป็น</span>
              {log.status !== 'taken' && (
                <button
                  type="button"
                  onClick={() => onSet('taken')}
                  className="inline-flex items-center min-h-[48px] px-5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-900 text-base font-bold hover:bg-emerald-100 cursor-pointer"
                >
                  กิน
                </button>
              )}
              {log.status === 'taken' && (
                <button
                  type="button"
                  onClick={() => setAsking(true)}
                  className="inline-flex items-center min-h-[48px] px-5 rounded-xl border border-rose-200 bg-rose-50 text-rose-900 text-base font-bold hover:bg-rose-100 cursor-pointer"
                >
                  ไม่กิน
                </button>
              )}
              <button
                type="button"
                onClick={() => onSet(null)}
                className="inline-flex items-center min-h-[48px] px-3 rounded-xl text-base font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                ล้างบันทึก
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
};

/** ตารางกินยาวันนี้: เป็น to-do แยกตามช่วงเวลาของวัน กด กิน / ไม่กิน (ไม่กินต้องบอกเหตุผล) */
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
                  onSet={(status, reason) => onSet(med, group.value, status, reason)}
                />
              ))}
            </ul>
          </Card>
        );
      })}
    </div>
  );
};
