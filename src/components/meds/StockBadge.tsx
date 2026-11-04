import React from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, Info } from 'lucide-react';
import {
  DEFAULT_EXPIRY_WARN_DAYS,
  daysLeft,
  daysToExpiry,
  formatQty,
  stockLevel,
  thaiDate,
  type Medication,
  type StockLevel,
} from '../../lib/meds';
import { cn } from '../../lib/cn';

const LEVEL_STYLE: Record<StockLevel, string> = {
  good: 'bg-emerald-50 border-emerald-300 text-emerald-900',
  low: 'bg-amber-50 border-amber-300 text-amber-900',
  critical: 'bg-red-50 border-red-300 text-red-900',
};

const LEVEL_ICON: Record<StockLevel, React.ReactNode> = {
  good: <CheckCircle2 className="w-4 h-4" aria-hidden="true" />,
  low: <Info className="w-4 h-4" aria-hidden="true" />,
  critical: <AlertTriangle className="w-4 h-4" aria-hidden="true" />,
};

type StockInput = Pick<Medication, 'perDose' | 'periods' | 'remaining' | 'lowStockDays'> &
  Partial<Pick<Medication, 'unit'>>;

/** ป้าย “พอกินอีก X วัน” สีเขียว/เหลือง/แดง (มีข้อความและไอคอนกำกับ ไม่ใช้สีอย่างเดียว) */
export const StockBadge: React.FC<{ med: StockInput; className?: string }> = ({ med, className }) => {
  const level = stockLevel(med);
  const days = daysLeft(med);
  const text =
    med.remaining <= 0
      ? 'หมดแล้ว'
      : days === null
        ? `เหลือ ${formatQty(med.remaining)}${med.unit ? ` ${med.unit}` : ''}`
        : days === 0
          ? 'เหลือไม่ถึง 1 วัน'
          : `พอกินอีก ${days} วัน${level === 'low' ? ' · ใกล้หมด' : level === 'critical' ? ' · ใกล้หมดมาก' : ''}`;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 min-h-[32px] px-3 rounded-full border text-sm sm:text-base font-bold',
        LEVEL_STYLE[level],
        className
      )}
    >
      {LEVEL_ICON[level]}
      {text}
    </span>
  );
};

/** ป้ายนับถอยหลังวันหมดอายุ (คำนวณจากวันนี้ทุกครั้งที่แสดง จึงอัปเดตเองเมื่อวันผ่านไป) */
export const ExpiryBadge: React.FC<{
  med: Pick<Medication, 'expiryDate' | 'expiryWarnDays'>;
  className?: string;
}> = ({ med, className }) => {
  const left = daysToExpiry(med);
  if (left === null) return null;
  const warn = med.expiryWarnDays ?? DEFAULT_EXPIRY_WARN_DAYS;
  const level: StockLevel = left <= 7 ? 'critical' : left <= warn ? 'low' : 'good';
  const text = left < 0 ? 'หมดอายุแล้ว' : left === 0 ? 'หมดอายุวันนี้' : `หมดอายุอีก ${left} วัน`;
  return (
    <span
      title={`วันหมดอายุ ${thaiDate(med.expiryDate!, 'medium')}`}
      className={cn(
        'inline-flex items-center gap-1.5 min-h-[32px] px-3 rounded-full border text-sm sm:text-base font-bold',
        LEVEL_STYLE[level],
        className
      )}
    >
      <CalendarClock className="w-4 h-4" aria-hidden="true" />
      {text}
    </span>
  );
};
