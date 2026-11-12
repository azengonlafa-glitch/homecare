import React from 'react';
import { Dino } from '../ui/Dino';
import { FlaskConical, RotateCcw } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { DinoLoader } from '../ui/DinoLoader';
import { CONSULT_MODE } from '../../consult/backend';
import { STATUS_LABEL } from '../../consult/options';
import type { SessionStatus } from '../../consult/types';
import { cn } from '../../lib/cn';

/** ป้ายบอกโหมดทดสอบ แสดงทุกหน้าของระบบปรึกษา เพื่อไม่ให้เข้าใจผิดว่าคุยกับเภสัชกรจริง */
export const ModeBanner: React.FC = () =>
  CONSULT_MODE === 'mock' ? (
    <div role="note" className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
      <FlaskConical className="w-6 h-6 shrink-0 mt-0.5" aria-hidden="true" />
      <p className="text-base font-semibold leading-snug min-w-0">
        โหมดทดสอบ: ยังไม่ได้เชื่อมต่อเภสัชกรจริง ร้านยาหรือคลินิกเป็นตัวอย่าง ข้อมูลอยู่ในเครื่องนี้เท่านั้น และไม่มีใครตอบกลับ
      </p>
    </div>
  ) : null;

export const LoadingCard: React.FC<{ label?: string }> = ({ label = 'กำลังโหลด' }) => (
  <DinoLoader label={label.replace(/\.{2,}$|…$/, '')} />
);

export const ErrorCard: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <Card role="alert" className="py-10 text-center border-red-200">
    <Dino pose="worried" bob className="mx-auto mb-3 h-24 w-28" />
    <p className="font-semibold text-slate-900">{message}</p>
    {onRetry && (
      <Button variant="neutral" size="sm" className="mt-4" onClick={onRetry}>
        <RotateCcw className="w-5 h-5" aria-hidden="true" />
        ลองอีกครั้ง
      </Button>
    )}
  </Card>
);

const STATUS_TONE: Record<SessionStatus, string> = {
  requested: 'bg-amber-50 text-amber-900 border-amber-200',
  active: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  completed: 'bg-slate-100 text-slate-800 border-slate-200',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
};

export const StatusBadge: React.FC<{ status: SessionStatus }> = ({ status }) => (
  <span className={cn('inline-flex items-center rounded-full border px-3 py-1 text-sm font-bold whitespace-nowrap', STATUS_TONE[status])}>
    {STATUS_LABEL[status]}
  </span>
);

/** แถบความคืบหน้าของแบบสอบถาม */
export const Stepper: React.FC<{ current: number; total: number; title: string }> = ({ current, total, title }) => (
  <div>
    <div className="flex items-baseline justify-between gap-3 mb-2">
      <p className="text-lg font-bold text-slate-900 min-w-0">{title}</p>
      <p className="text-sm font-semibold text-slate-600 whitespace-nowrap">
        ขั้นที่ {current} จาก {total}
      </p>
    </div>
    <div
      role="progressbar"
      aria-label="ความคืบหน้า"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current}
      className="flex gap-1.5"
    >
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cn('h-2 flex-1 rounded-full', i < current ? 'bg-purple-700' : 'bg-slate-200')} />
      ))}
    </div>
  </div>
);

/** ระดับความรุนแรง 0-10 ใช้ปุ่มแทนสไลเดอร์ เพื่อให้กดง่ายบนมือถือ */
export const SeverityScale: React.FC<{ value: number | null; onChange: (v: number) => void; error?: string; idPrefix?: string }> = ({
  value,
  onChange,
  error,
  idPrefix = 'severity',
}) => (
  <fieldset id={idPrefix} tabIndex={-1} className="min-w-0 focus:outline-none">
    <legend className="text-base sm:text-lg font-bold text-slate-900 mb-1">ความรุนแรงของอาการ</legend>
    <p className="text-sm sm:text-base text-slate-600 mb-3">0 = ไม่มีอาการ, 10 = รุนแรงที่สุดที่เคยเป็น</p>
    <div className="grid grid-cols-6 sm:grid-cols-11 gap-1.5">
      {Array.from({ length: 11 }, (_, n) => (
        <button
          key={n}
          type="button"
          aria-pressed={value === n}
          onClick={() => onChange(n)}
          className={cn(
            'min-h-[48px] rounded-xl border text-lg font-bold cursor-pointer transition-colors',
            value === n ? 'bg-purple-700 border-purple-700 text-white' : 'bg-white border-slate-300 text-slate-800 hover:bg-purple-50'
          )}
        >
          {n}
        </button>
      ))}
    </div>
    {error && (
      <p role="alert" className="mt-2 text-base font-semibold text-red-700">
        {error}
      </p>
    )}
  </fieldset>
);

