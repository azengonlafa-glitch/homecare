import React, { useEffect, useState } from 'react';
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Clock,
  Droplet,
  FlaskConical,
  HeartPulse,
  Moon,
  Scale,
  Utensils,
  type LucideIcon,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { TextField } from '../ui/TextField';
import { DateTimeField } from '../ui/DatePicker';
import { cn } from '../../lib/cn';
import { filledCount, parseVitalDraft, toLocalInput, type VitalDraft } from '../../lib/dailyRecord';
import type { GlucoseTiming } from '../../lib/members';
import {
  ALL_METRICS,
  METRIC_CATEGORIES,
  categoryOf,
  type ExtraMetric,
  type MetricCategoryId,
} from '../../lib/vitalMetrics';

export const CATEGORY_ICON: Record<MetricCategoryId, LucideIcon> = {
  vitals: HeartPulse,
  sugar: Droplet,
  body: Scale,
  comfort: Moon,
  intake: Utensils,
  lab: FlaskConical,
};

const TIMING_LABEL: Record<GlucoseTiming, string> = {
  fasting: 'ก่อนอาหาร (อดอาหาร)',
  'after-meal': 'หลังอาหาร',
  unknown: 'ไม่ระบุ',
};

const pill = (on: boolean) =>
  cn(
    'rounded-xl border text-sm font-bold transition-colors cursor-pointer',
    on ? 'seg-on border-transparent text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-purple-50'
  );

interface VitalsStepModalProps {
  open: boolean;
  /** ชื่อคนที่กำลังบันทึกให้ (แสดงในหัวข้อ) */
  forName?: string;
  value: VitalDraft;
  onSave: (draft: VitalDraft) => void;
  onClose: () => void;
  /** มีเมื่อไล่ทีละขั้น: ข้ามไปขั้นถัดไปโดยไม่กรอก */
  onSkip?: () => void;
  saveLabel: string;
}

/**
 * ขั้นกรอกค่าสุขภาพ: หน้าแรกเป็นปุ่มหมวด (สัญญาณชีพ น้ำตาล ร่างกาย ...) จิ้มหมวดไหนก็เข้าไปกรอกเฉพาะหมวดนั้น
 * คนทั่วไปกรอกแค่หมวดที่วัดได้ ผู้ดูแลมืออาชีพกรอกผลตรวจเลือดและน้ำเข้า-ออกเพิ่มได้ โดยหน้าไม่รก
 */
const VitalsDialog: React.FC<Omit<VitalsStepModalProps, 'open'>> = ({ forName, value, onSave, onClose, onSkip, saveLabel }) => {
  const [draft, setDraft] = useState<VitalDraft>(value);
  const [screen, setScreen] = useState<MetricCategoryId | null>(null);
  const [error, setError] = useState('');
  const [showWhen, setShowWhen] = useState(Boolean(value.at));

  // เปลี่ยนหมวดแล้วเลื่อนกลับขึ้นบนสุด
  useEffect(() => {
    document.querySelector('[role="dialog"] .overflow-y-auto')?.scrollTo({ top: 0 });
  }, [screen]);

  const setNum = (key: string, v: string) => {
    setDraft((d) => ({ ...d, nums: { ...d.nums, [key]: v } }));
    setError('');
  };

  const save = () => {
    const parsed = parseVitalDraft(draft);
    if (!parsed.ok) {
      setError(parsed.error);
      if (parsed.category) setScreen(parsed.category);
      return;
    }
    onSave(draft);
  };

  const field = (metric: ExtraMetric) => (
    <TextField
      key={metric.key}
      id={`vs-${metric.key}`}
      type="number"
      inputMode="decimal"
      step={metric.step}
      label={metric.unit ? `${metric.label} (${metric.unit})` : metric.label}
      placeholder={metric.placeholder}
      value={draft.nums[metric.key] ?? ''}
      onChange={(e) => setNum(metric.key, e.target.value)}
    />
  );

  const renderCategory = (id: MetricCategoryId) => {
    const metrics = ALL_METRICS.filter((x) => x.category === id);
    const blocks: React.ReactNode[] = [];
    let lastGroup: string | undefined;
    let grid: ExtraMetric[] = [];
    const flush = () => {
      if (grid.length === 0) return;
      blocks.push(
        <div key={`g-${blocks.length}`} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {grid.map(field)}
        </div>
      );
      grid = [];
    };

    for (const metric of metrics) {
      if (metric.group !== lastGroup) {
        flush();
        if (metric.group) {
          blocks.push(
            <p key={`h-${metric.group}`} className="bg-label mt-2 text-sm font-bold text-slate-800">
              {metric.group}
            </p>
          );
        }
        lastGroup = metric.group;
      }
      if (metric.key === 'systolic') continue; // วาดคู่กับตัวล่าง
      if (metric.key === 'diastolic') {
        flush();
        blocks.push(
          <div key="bp" className="rounded-2xl border border-slate-200 bg-white/70 p-3.5">
            <p className="mb-2 text-sm font-bold text-slate-800">ความดัน (ใส่ทั้งตัวบนและตัวล่าง)</p>
            <div className="grid grid-cols-2 gap-3">
              {field(ALL_METRICS.find((x) => x.key === 'systolic') as ExtraMetric)}
              {field(metric)}
            </div>
          </div>
        );
        continue;
      }
      if (metric.key === 'glucose') {
        flush();
        blocks.push(
          <div key="glucose" className="rounded-2xl border border-slate-200 bg-white/70 p-3.5 space-y-3">
            {field(metric)}
            <div>
              <p className="mb-1.5 text-sm font-bold text-slate-700">ช่วงที่ตรวจ</p>
              <div className="flex flex-wrap gap-2">
                {(['fasting', 'after-meal', 'unknown'] as GlucoseTiming[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={draft.glucoseTiming === t}
                    onClick={() => setDraft((d) => ({ ...d, glucoseTiming: t }))}
                    className={cn(pill(draft.glucoseTiming === t), 'min-h-[44px] px-3')}
                  >
                    {TIMING_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
        continue;
      }
      if (metric.key === 'pain') {
        flush();
        blocks.push(
          <div key="pain">
            <p className="mb-1.5 text-base font-bold text-slate-800">ระดับความปวด</p>
            <p className="mb-2 text-sm text-slate-600">0 = ไม่ปวดเลย · 10 = ปวดมากที่สุด · กดซ้ำเพื่อล้าง</p>
            <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-11">
              {Array.from({ length: 11 }, (_, n) => n).map((n) => {
                const on = draft.nums.pain === String(n);
                return (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={on}
                    aria-label={`ความปวด ${n}`}
                    onClick={() => setNum('pain', on ? '' : String(n))}
                    className={cn(pill(on), 'h-12 font-extrabold')}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>
        );
        continue;
      }
      grid.push(metric);
    }
    flush();
    return blocks;
  };

  const cat = screen ? categoryOf(screen) : null;
  const total = filledCount(draft);

  return (
    <Modal
      open
      onClose={onClose}
      title={cat ? cat.label : `ค่าสุขภาพ${forName ? `ของ ${forName}` : ''}`}
      initialFocusSelector={cat ? 'input' : undefined}
      footer={
        <div className="space-y-2">
          {error && (
            <p role="alert" className="text-base font-semibold text-red-700">
              {error}
            </p>
          )}
          {cat ? (
            <Button fullWidth onClick={() => setScreen(null)}>
              เสร็จแล้ว
            </Button>
          ) : (
            <div className={cn('grid gap-3', onSkip ? 'grid-cols-2' : 'grid-cols-1')}>
              {onSkip && (
                <Button variant="neutral" fullWidth onClick={onSkip}>
                  ข้าม
                </Button>
              )}
              <Button fullWidth onClick={save}>
                {saveLabel}
              </Button>
            </div>
          )}
        </div>
      }
    >
      {cat && screen ? (
        <div key={screen} className="anim-fade-up py-5 space-y-4">
          <button
            type="button"
            onClick={() => setScreen(null)}
            className="inline-flex min-h-[44px] items-center gap-1 rounded-full bg-white/80 pl-2 pr-4 text-base font-bold text-slate-800 ring-1 ring-slate-200 hover:bg-white cursor-pointer"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            กลับ
          </button>
          <p className="text-sm text-slate-600">กรอกเท่าที่มี ช่องไหนไม่มีก็ข้ามได้เลย</p>
          {renderCategory(screen)}
        </div>
      ) : (
        <div key="hub" className="anim-fade-up py-5 space-y-4">
          <p className="text-base text-slate-700">
            วันนี้วัดอะไรมาบ้าง? แตะเลือกได้เลย
            {total > 0 && <strong className="font-bold text-slate-900"> · ใส่แล้ว {total} ค่า</strong>}
          </p>
          <ul className="stagger grid grid-cols-1 gap-3 sm:grid-cols-2">
            {METRIC_CATEGORIES.map((c) => {
              const Icon = CATEGORY_ICON[c.id];
              const n = filledCount(draft, c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setScreen(c.id)}
                    className={cn(
                      'flex h-full w-full min-h-[84px] items-center gap-3 rounded-2xl border-2 p-3.5 text-left cursor-pointer',
                      n > 0 ? 'border-[color:var(--accent)] bg-white' : 'border-slate-200 bg-white/80 hover:bg-white'
                    )}
                  >
                    <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl', c.tint)}>
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 text-base font-bold text-slate-900">
                        {c.label}
                        {c.pro && <span className="rounded-full bg-violet-50 px-2 text-xs font-bold text-violet-800 ring-1 ring-violet-200">ใบผลแล็บ</span>}
                      </span>
                      <span className="block text-sm leading-snug text-slate-600">{c.hint}</span>
                    </span>
                    {n > 0 ? (
                      <span className="shrink-0 rounded-full bg-[color:var(--accent)] px-2.5 py-0.5 text-sm font-extrabold text-white">{n}</span>
                    ) : (
                      <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          {showWhen ? (
            <div className="rounded-2xl border border-slate-200 bg-white/70 p-3.5">
              <DateTimeField
                id="vs-when"
                label="วัดเมื่อไหร่"
                hint="ปล่อยว่าง = ตอนนี้ · ย้อนหลังได้ เช่น วันที่ในใบผลแล็บ"
                max={toLocalInput(new Date())}
                value={draft.at}
                onChange={(val) => {
                  setDraft((d) => ({ ...d, at: val }));
                  setError('');
                }}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowWhen(true)}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white/80 px-4 text-sm font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-white cursor-pointer"
            >
              <Clock className="h-4 w-4 text-purple-700" aria-hidden="true" />
              บันทึกตอนนี้ · แตะเพื่อเปลี่ยนเวลา
            </button>
          )}
          <p className="flex items-start gap-1.5 text-xs text-slate-600">
            <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            แอปช่วยจดและดูแนวโน้มเท่านั้น ไม่ได้บอกว่าปกติหรือไม่ ถ้าสงสัยถามหมอหรือเภสัชกรนะ
          </p>
        </div>
      )}
    </Modal>
  );
};

export const VitalsStepModal: React.FC<VitalsStepModalProps> = ({ open, ...rest }) => (open ? <VitalsDialog {...rest} /> : null);
