import React from 'react';
import { ChevronRight, Pencil, RefreshCcw } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { StockBadge } from './StockBadge';
import {
  FORM_OPTIONS,
  PERIODS,
  PERIOD_LABEL,
  formatQty,
  instructionText,
  stockLevel,
  weekdaysText,
  type Medication,
} from '../../lib/meds';
import { cn } from '../../lib/cn';

interface MedCabinetProps {
  meds: Medication[];
  onOpen: (med: Medication) => void;
  onEdit: (med: Medication) => void;
  onRefill: (med: Medication) => void;
}

const MedCard: React.FC<{ med: Medication } & Omit<MedCabinetProps, 'meds'>> = ({ med, onOpen, onEdit, onRefill }) => {
  const level = stockLevel(med);
  const formLabel = FORM_OPTIONS.find((f) => f.value === med.form)?.label;
  const times = med.periods.map((p) => `${PERIOD_LABEL[p]}${med.times[p] ? ` ${med.times[p]}` : ''}`).join(' · ');
  const schedule = [times, med.weekdays.length > 0 && med.weekdays.length < 7 ? weekdaysText(med.weekdays) : '']
    .filter(Boolean)
    .join(' · ');

  return (
    <li className={cn('py-5 first:pt-0 last:pb-0', !med.active && 'opacity-75')}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => onOpen(med)}
            className="text-left text-lg sm:text-xl font-bold text-slate-900 break-words hover:text-purple-800 hover:underline cursor-pointer"
          >
            {med.name}
          </button>
          <p className="mt-0.5 text-base text-slate-700">{instructionText(med)}</p>
          <p className="text-base text-slate-600">{schedule}</p>
          <p className="mt-0.5 text-sm text-slate-500">
            {[formLabel, med.condition && `โรค: ${med.condition}`].filter(Boolean).join(' · ')}
          </p>
          {med.note && <p className="mt-1 text-base text-slate-700 break-words">หมายเหตุ: {med.note}</p>}
        </div>
        <div className="flex flex-col items-start sm:items-end gap-1.5 shrink-0">
          <p className="text-base font-bold text-slate-900">
            เหลือ {formatQty(med.remaining)} {med.unit}
          </p>
          {med.active ? (
            <StockBadge med={med} />
          ) : (
            <span className="px-3 py-1 rounded-full bg-slate-200 text-sm font-bold text-slate-700">หยุดใช้แล้ว</span>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={med.active && level !== 'good' ? 'primary' : 'soft'}
          onClick={() => onRefill(med)}
        >
          <RefreshCcw className="w-5 h-5" aria-hidden="true" />
          <span>ขอเติมยานี้</span>
        </Button>
        <Button type="button" size="sm" variant="neutral" onClick={() => onOpen(med)}>
          <span>รายละเอียดและประวัติ</span>
          <ChevronRight className="w-5 h-5" aria-hidden="true" />
        </Button>
        <Button type="button" size="sm" variant="neutral" onClick={() => onEdit(med)}>
          <Pencil className="w-5 h-5" aria-hidden="true" />
          <span>แก้ไข</span>
        </Button>
        {med.refillRequestedAt && (
          <span className="text-sm text-slate-600">
            ขอเติมแล้ว{' '}
            {new Date(med.refillRequestedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>
    </li>
  );
};

/** ตู้ยา: ยาที่ใช้อยู่จัดกลุ่มตามช่วงเวลาของวัน (ยาหลายช่วงแสดงทุกช่วง) และยาที่หยุดใช้แล้วแยกไว้ท้าย */
export const MedCabinet: React.FC<MedCabinetProps> = ({ meds, ...handlers }) => {
  const active = meds.filter((m) => m.active);
  const stopped = meds.filter((m) => !m.active);
  const groups = PERIODS.map((p) => ({ ...p, items: active.filter((m) => m.periods.includes(p.value)) })).filter(
    (g) => g.items.length > 0
  );

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <Card key={group.value} className="p-5 sm:p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-5">
            {group.label} <span className="text-base font-medium text-slate-500">· {group.items.length} รายการ</span>
          </h2>
          <ul className="divide-y divide-slate-200">
            {group.items.map((med) => (
              <MedCard key={med.id} med={med} {...handlers} />
            ))}
          </ul>
        </Card>
      ))}

      {stopped.length > 0 && (
        <Card className="p-5 sm:p-6 bg-slate-50">
          <h2 className="text-xl font-bold text-slate-700 mb-5">
            หยุดใช้แล้ว <span className="text-base font-medium text-slate-500">· {stopped.length} รายการ</span>
          </h2>
          <ul className="divide-y divide-slate-200">
            {stopped.map((med) => (
              <MedCard key={med.id} med={med} {...handlers} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
};
