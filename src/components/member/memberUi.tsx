import React from 'react';
import { Check, CircleDashed, Slash, X, type LucideIcon } from 'lucide-react';
import { TONE_SOFT } from '../health/HealthCharts';
import { DOSE_STATE_LABEL, type Classified, type DoseState } from '../../lib/memberDashboard';
import { cn } from '../../lib/cn';

/** สไตล์ชิปสถานะการกินยา (ไม่ใช้สีอย่างเดียว: มีไอคอนและข้อความกำกับเสมอ) */
export const DOSE_STATE_STYLE: Record<DoseState, { chip: string; Icon: LucideIcon }> = {
  taken: { chip: 'bg-emerald-50 border-emerald-300 text-emerald-900', Icon: Check },
  skipped: { chip: 'bg-amber-50 border-amber-300 text-amber-900', Icon: Slash },
  missed: { chip: 'bg-rose-50 border-rose-300 text-rose-900', Icon: X },
  unconfirmed: { chip: 'bg-slate-50 border-slate-300 text-slate-700', Icon: CircleDashed },
};

export const DoseStateChip: React.FC<{ state: DoseState; className?: string }> = ({ state, className }) => {
  const { chip, Icon } = DOSE_STATE_STYLE[state];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm font-bold whitespace-nowrap',
        chip,
        className
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {DOSE_STATE_LABEL[state]}
    </span>
  );
};

/** ป้ายผลการประเมินค่า (ปกติ / สูง / ต่ำ ...) */
export const ClassifiedChip: React.FC<{ value: Classified; className?: string }> = ({ value, className }) => (
  <span
    className={cn(
      'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-bold whitespace-nowrap',
      TONE_SOFT[value.tone],
      className
    )}
  >
    {value.label}
  </span>
);

/** วันที่/เวลาแบบสั้นอ่านง่าย เช่น "5 พ.ย. 09:30 น." */
export const shortDateTime = (iso: string): string => {
  const d = new Date(iso);
  const date = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date} ${time} น.`;
};

/** "วันนี้ 09:30 น." / "เมื่อวาน 20:10 น." / "3 พ.ย. 08:00 น." */
export const relativeDateTime = (iso: string, now = new Date()): string => {
  const d = new Date(iso);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  const time = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (diff === 0) return `วันนี้ ${time} น.`;
  if (diff === 1) return `เมื่อวาน ${time} น.`;
  return shortDateTime(iso);
};

export const SectionTitle: React.FC<{
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
}> = ({ icon: Icon, children, className }) => (
  <h2 className={cn('flex items-center gap-2 text-lg sm:text-xl font-bold text-slate-900', className)}>
    <Icon className="h-6 w-6 text-purple-700 shrink-0" aria-hidden="true" />
    <span>{children}</span>
  </h2>
);

export const EmptyNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-7 text-center text-base text-slate-600">
    {children}
  </p>
);

