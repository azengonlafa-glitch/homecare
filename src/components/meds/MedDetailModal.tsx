import React, { useState } from 'react';
import { AlarmClock, Flame, Pencil, Trash2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { AttachmentImage } from '../ui/AttachmentImage';
import { ExpiryBadge, StockBadge } from './StockBadge';
import { DrugInfoPanel } from './DrugInfoPanel';
import { drugById, matchDrugInText } from '../../data/drugDb';
import {
  PERIOD_LABEL,
  doseStatusLabel,
  doseWords,
  dayStates,
  daysToExpiry,
  endDateOf,
  formatMedForm,
  formatQty,
  historyOf,
  instructionText,
  medStats,
  reminderDelayOf,
  reminderRepeatOf,
  runOutDate,
  thaiDate,
  weekdaysText,
  type DayState,
  type DoseLog,
  type DoseStatus,
  type Medication,
} from '../../lib/meds';
import { CURRENT_MEMBER_ID } from '../../lib/settings';
import { cn } from '../../lib/cn';

interface MedDetailModalProps {
  med: Medication | null;
  logs: DoseLog[];
  onEdit: (med: Medication) => void;
  onDelete: (med: Medication) => void;
  /** ตั้งเวลากินให้ยาที่อยู่ในตู้ (ยังไม่มีตาราง) */
  onSchedule?: (med: Medication) => void;
  onClose: () => void;
}

const dayStyle = (verb: string, notDone: string): Record<DayState, { cls: string; label: string }> => ({
  all: { cls: 'bg-emerald-500', label: 'ครบ' },
  partial: { cls: 'bg-amber-400', label: 'ไม่ครบ' },
  missed: { cls: 'bg-red-500', label: `${notDone}/ไม่ได้บันทึก` },
  pending: { cls: 'bg-white border-2 border-slate-300', label: 'ยังไม่ถึงเวลา' },
  none: { cls: 'bg-slate-100', label: `ไม่ต้อง${verb}` },
});

const STATUS_TEXT: Record<DoseStatus, string> = {
  taken: 'text-emerald-800 bg-emerald-50 border-emerald-200',
  missed: 'text-rose-800 bg-rose-50 border-rose-200',
  skipped: 'text-amber-900 bg-amber-50 border-amber-200',
};

export const adherenceTone = (pct: number | null) =>
  pct === null ? 'text-slate-500' : pct >= 80 ? 'text-emerald-700' : pct >= 50 ? 'text-amber-700' : 'text-red-700';

const Stat: React.FC<{ label: string; value: React.ReactNode; className?: string }> = ({ label, value, className }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center">
    <p className={cn('text-2xl font-extrabold text-slate-900', className)}>{value}</p>
    <p className="mt-0.5 text-sm text-slate-600">{label}</p>
  </div>
);

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <>
    <dt className="text-slate-600">{label}</dt>
    <dd className="font-semibold text-slate-900 break-words">{children}</dd>
  </>
);

/** 30 วันล่าสุดเป็นช่องสี (มีคำอธิบายสีและข้อความใน title/aria) */
export const DayStrip: React.FC<{ med: Medication; logs: DoseLog[]; days?: number }> = ({ med, logs, days = 30 }) => {
  const states = dayStates(med, logs, days);
  const w = doseWords(med.form);
  const DAY_STYLE = dayStyle(w.verb, w.notDone);
  return (
    <div>
      <ol className="grid grid-cols-[repeat(15,minmax(0,1fr))] gap-1" aria-label={`สรุป${w.phrase} ${days} วันล่าสุด`}>
        {states.map((d) => (
          <li
            key={d.date}
            title={`${thaiDate(d.date, 'medium')}: ${DAY_STYLE[d.state].label}`}
            aria-label={`${thaiDate(d.date, 'medium')}: ${DAY_STYLE[d.state].label}`}
            className={cn('aspect-square rounded-md', DAY_STYLE[d.state].cls)}
          />
        ))}
      </ol>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
        {(['all', 'partial', 'missed', 'none'] as DayState[]).map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span className={cn('w-3 h-3 rounded-sm', DAY_STYLE[s].cls)} aria-hidden="true" />
            {DAY_STYLE[s].label}
          </li>
        ))}
      </ul>
    </div>
  );
};

const HISTORY_PAGE = 15;

/** รายละเอียดยาแต่ละตัว: สถิติการกินตั้งแต่เริ่มใช้ ข้อมูลยา รูป และประวัติการบันทึกทั้งหมด */
export const MedDetailModal: React.FC<MedDetailModalProps> = ({ med, logs, onEdit, onDelete, onSchedule, onClose }) => {
  const [shown, setShown] = useState(HISTORY_PAGE);
  if (!med) return null;

  const stats = medStats(med, logs);
  const w = doseWords(med.form);
  const history = historyOf(logs, med.id);
  const drug = (med.drugRef ? drugById(med.drugRef) : undefined) ?? matchDrugInText(med.name);
  const runOut = med.active ? runOutDate(med) : null;
  const end = endDateOf(med);
  const expiryLeft = daysToExpiry(med);
  const delay = reminderDelayOf(med);
  const timesText = med.periods
    .map((p) => `${PERIOD_LABEL[p]}${med.times[p] ? ` ${med.times[p]} น.` : ''}`)
    .join(' · ');

  return (
    <Modal
      open
      onClose={onClose}
      title={med.name}
      footer={
        <div className="flex flex-wrap gap-2 justify-end">
          <button
            type="button"
            onClick={() => onDelete(med)}
            className="inline-flex items-center gap-1.5 min-h-[48px] px-3 mr-auto rounded-xl text-base font-semibold text-red-700 hover:bg-red-50 cursor-pointer"
          >
            <Trash2 className="w-5 h-5" aria-hidden="true" />
            ลบ
          </button>
          <Button size="sm" variant="neutral" onClick={() => onEdit(med)}>
            <Pencil className="w-5 h-5" aria-hidden="true" />
            <span>แก้ไข</span>
          </Button>
        </div>
      }
    >
      <div className="py-6 space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          {!med.active && (
            <span className="inline-flex items-center min-h-[32px] px-3 rounded-full bg-slate-200 text-sm font-bold text-slate-700">
              หยุดใช้แล้ว
            </span>
          )}
          <StockBadge med={med} />
          <ExpiryBadge med={med} />
          <span className="text-base text-slate-700">
            เหลือ {formatQty(med.remaining)} {med.unit}
            {runOut && ` · คาดว่าหมด ${runOut.toLocaleDateString('th-TH', { dateStyle: 'medium' })}`}
          </span>
        </div>

        {med.asNeeded && onSchedule && (
          <Button fullWidth onClick={() => onSchedule(med)}>
            <AlarmClock className="w-5 h-5" aria-hidden="true" />
            <span>ตั้งเวลา{w.phrase}</span>
          </Button>
        )}

        {/* สถิติ (ยาที่ไม่มีตารางประจำไม่มีมื้อให้นับ) */}
        {!med.asNeeded && (
        <section aria-label={`สถิติ${w.phrase}`}>
          <h3 className="text-lg font-bold text-slate-900">การ{w.phrase}ตั้งแต่ {thaiDate(stats.from)}</h3>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat
              label={`${w.verb}ตามนัด`}
              value={stats.adherence === null ? '–' : `${stats.adherence}%`}
              className={adherenceTone(stats.adherence)}
            />
            <Stat label={`${w.done} (จาก ${stats.expected} มื้อ)`} value={stats.taken} />
            <Stat label="พลาด / ไม่ได้บันทึก" value={stats.missed + stats.unrecorded} />
            <Stat
              label={`${w.verb}ครบติดกัน (วัน)`}
              value={
                <span className="inline-flex items-center gap-1">
                  {stats.streak > 0 && <Flame className="w-5 h-5 text-orange-500" aria-hidden="true" />}
                  {stats.streak}
                </span>
              }
            />
          </div>
          <p className="mt-2 text-sm text-slate-600">
            งดตามแพทย์สั่ง {stats.skipped} มื้อ (ไม่นับเป็นพลาด) · {w.late} {stats.late} มื้อ · {w.verb}ไปแล้วรวม {formatQty(stats.totalUnits)} {med.unit}
          </p>
          <div className="mt-4">
            <p className="text-base font-bold text-slate-900 mb-2">30 วันล่าสุด</p>
            <DayStrip med={med} logs={logs} />
          </div>
        </section>
        )}

        {/* ข้อมูลยา */}
        <section aria-label="ข้อมูลการใช้ยา">
          <h3 className="text-lg font-bold text-slate-900 mb-3">ข้อมูลการใช้ยา</h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-base">
            <Row label={`วิธี${w.verb}`}>{instructionText(med)}</Row>
            <Row label="รูปแบบ">{formatMedForm(med)}</Row>
            {med.asNeeded ? (
              <Row label="ตาราง">ไม่มีตารางประจำ</Row>
            ) : (
              <>
                <Row label="เวลา">{timesText}</Row>
                <Row label="วัน">{weekdaysText(med.weekdays)}</Row>
                <Row label="แจ้งเตือน">
                  {delay === 0 ? 'ตรงเวลา' : `หลังถึงเวลา ${delay} นาที`} · ถ้ายังไม่{w.verb}แจ้งซ้ำทุก {reminderRepeatOf(med)} นาที
                </Row>
                <Row label="เริ่มใช้">{thaiDate(med.startDate)}</Row>
                <Row label="ระยะเวลา">
                  {end ? `${med.durationDays} วัน (ถึง ${thaiDate(end)})` : 'ใช้ต่อเนื่อง'}
                  {med.stoppedAt && ` · หยุดใช้ ${thaiDate(med.stoppedAt)}`}
                </Row>
              </>
            )}
            {med.expiryDate && (
              <Row label="วันหมดอายุ">
                {thaiDate(med.expiryDate)}
                {expiryLeft !== null &&
                  (expiryLeft < 0
                    ? ` (หมดอายุแล้ว ${-expiryLeft} วัน)`
                    : expiryLeft === 0
                      ? ' (หมดอายุวันนี้)'
                      : ` (เหลืออีก ${expiryLeft} วัน)`)}
              </Row>
            )}
            {med.condition && <Row label="โรค">{med.condition}</Row>}
            {med.reason && <Row label="เหตุผล">{med.reason}</Row>}
            {!med.asNeeded && <Row label="เตือนเมื่อเหลือ">{med.lowStockDays} วัน</Row>}
            {med.lastRefillDate && <Row label="รับยาล่าสุด">{thaiDate(med.lastRefillDate)}</Row>}
            {med.refillsRemaining !== null && <Row label="เติมยาได้อีก">{med.refillsRemaining} ครั้ง</Row>}
            {med.note && <Row label="หมายเหตุ">{med.note}</Row>}
          </dl>
        </section>

        {drug && <DrugInfoPanel drug={drug} />}

        {(med.pillPhoto || med.labelPhoto) && (
          <section aria-label="รูปยา" className="grid grid-cols-2 gap-3">
            {med.pillPhoto && (
              <div>
                <p className="text-sm font-bold text-slate-700 mb-1">รูปเม็ดยา</p>
                <AttachmentImage attachment={med.pillPhoto} alt={`รูปเม็ดยา ${med.name}`} className="h-40 [&_img]:h-40 [&_img]:object-cover" />
              </div>
            )}
            {med.labelPhoto && (
              <div>
                <p className="text-sm font-bold text-slate-700 mb-1">รูปฉลาก</p>
                <AttachmentImage attachment={med.labelPhoto} alt={`รูปฉลากยา ${med.name}`} className="h-40 [&_img]:h-40 [&_img]:object-cover" />
              </div>
            )}
          </section>
        )}

        {/* ประวัติ */}
        <section aria-label="ประวัติการบันทึก">
          <h3 className="text-lg font-bold text-slate-900 mb-3">ประวัติการบันทึก ({history.length})</h3>
          {history.length === 0 ? (
            <p className="text-base text-slate-600">ยังไม่มีการบันทึก กด “{w.verb}” ในตาราง{w.phrase}วันนี้</p>
          ) : (
            <>
              <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200">
                {history.slice(0, shown).map((l) => (
                  <li key={`${l.date}-${l.period}`} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-slate-900">
                        {thaiDate(l.date, 'medium')} · มื้อ{PERIOD_LABEL[l.period]}
                      </p>
                      <p className="text-sm text-slate-600">
                        บันทึก{' '}
                        {new Date(l.at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })}{' '}
                        น. โดย {l.byId === CURRENT_MEMBER_ID ? 'คุณ' : l.byName}
                        {l.lateMinutes ? ` · ช้า ${l.lateMinutes} นาที` : ''}
                      </p>
                      {l.reason && <p className="text-sm text-slate-600 break-words">เหตุผล: {l.reason}</p>}
                    </div>
                    <span className={cn('shrink-0 px-3 py-1 rounded-full border text-sm font-bold', STATUS_TEXT[l.status])}>
                      {doseStatusLabel(l.status, med.form)}
                    </span>
                  </li>
                ))}
              </ul>
              {history.length > shown && (
                <Button size="sm" variant="neutral" className="mt-3" onClick={() => setShown(shown + HISTORY_PAGE)}>
                  แสดงเพิ่ม ({history.length - shown})
                </Button>
              )}
            </>
          )}
        </section>
      </div>
    </Modal>
  );
};
