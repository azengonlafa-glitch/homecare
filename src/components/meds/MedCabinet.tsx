import React from 'react';
import {
  Bandage,
  Candy,
  Circle,
  CircleDot,
  Citrus,
  Droplets,
  Ear,
  Eye,
  FlaskConical,
  GlassWater,
  Layers,
  Leaf,
  Package,
  Package2,
  PenLine,
  Pill,
  Syringe,
  TestTube2,
  Wind,
} from 'lucide-react';
import { ExpiryBadge, StockBadge } from './StockBadge';
import {
  PERIOD_LABEL,
  doseWords,
  formatMedForm,
  formatQty,
  stockLevel,
  type MedForm,
  type Medication,
} from '../../lib/meds';
import { cn } from '../../lib/cn';
import { MedPhoto } from './MedPhoto';

interface MedCabinetProps {
  meds: Medication[];
  onOpen: (med: Medication) => void;
  onEdit: (med: Medication) => void;
}

/** ไอคอนประจำรูปแบบยา */
const FORM_ICON: Record<MedForm, React.FC<{ className?: string }>> = {
  tablet: Pill,
  capsule: Layers,
  liquid: Droplets,
  powder: Package,
  effervescent: GlassWater,
  lozenge: Candy,
  sublingual: Pill,
  supplement: Citrus,
  herbal: Leaf,
  injection: Syringe,
  pen: PenLine,
  needle: Syringe,
  topical: FlaskConical,
  patch: Bandage,
  drops: Droplets,
  eye: Eye,
  ear: Ear,
  spray: Wind,
  inhaler: Wind,
  suppository: CircleDot,
  testkit: TestTube2,
  other: Package2,
};

/** สีพื้นการ์ดตามรูปแบบยา */
const FORM_BG: Record<MedForm, string> = {
  tablet:    'bg-purple-50',
  capsule:   'bg-sky-soft',
  liquid:    'bg-cyan-50',
  powder:    'bg-orange-50',
  effervescent: 'bg-cyan-50',
  lozenge:   'bg-pink-50',
  sublingual: 'bg-purple-50',
  supplement: 'bg-amber-50',
  herbal:    'bg-lime-50',
  injection: 'bg-rose-50',
  pen:       'bg-rose-50',
  needle:    'bg-pink-50',
  topical:   'bg-green-50',
  patch:     'bg-orange-50',
  drops:     'bg-sky-50',
  eye:       'bg-sky-50',
  ear:       'bg-indigo-50',
  spray:     'bg-mint-soft',
  inhaler:   'bg-teal-50',
  suppository: 'bg-fuchsia-50',
  testkit:   'bg-teal-50',
  other:     'bg-amber-50',
};

const FORM_ICON_COLOR: Record<MedForm, string> = {
  tablet:    'text-purple-500',
  capsule:   'text-sky-600',
  liquid:    'text-cyan-500',
  powder:    'text-orange-500',
  effervescent: 'text-cyan-600',
  lozenge:   'text-pink-500',
  sublingual: 'text-purple-500',
  supplement: 'text-amber-600',
  herbal:    'text-lime-600',
  injection: 'text-rose-500',
  pen:       'text-rose-600',
  needle:    'text-pink-500',
  topical:   'text-green-500',
  patch:     'text-orange-500',
  drops:     'text-sky-500',
  eye:       'text-sky-600',
  ear:       'text-indigo-500',
  spray:     'text-teal-600',
  inhaler:   'text-teal-500',
  suppository: 'text-fuchsia-500',
  testkit:   'text-teal-500',
  other:     'text-amber-500',
};

/** การ์ดยาแบบ visual box */
const MedGridCard: React.FC<{ med: Medication; onOpen: (m: Medication) => void }> = ({ med, onOpen }) => {
  const level = stockLevel(med);
  const Icon = FORM_ICON[med.form] ?? Circle;
  const formLabel = formatMedForm(med);
  const timesText = med.asNeeded
    ? `${doseWords(med.form).verb}เมื่อจำเป็น (ไม่มีตารางประจำ)`
    : med.periods.map((p) => `${PERIOD_LABEL[p]}${med.times[p] ? ` ${med.times[p]}` : ''}`).join(' · ');

  return (
    <button
      type="button"
      onClick={() => onOpen(med)}
      className={cn(
        'group relative flex flex-col rounded-2xl border-2 overflow-hidden text-left',
        'transition-shadow hover:shadow-lg active:scale-95',
        !med.active && 'opacity-60',
        level === 'critical' ? 'border-red-300' : level === 'low' ? 'border-amber-300' : 'border-transparent',
        'shadow-sm bg-white'
      )}
      aria-label={`${med.name} — กดเพื่อดูรายละเอียด`}
    >
      {/* ส่วนบน: รูปยา / ไอคอน */}
      <div className={cn('relative w-full aspect-square flex items-center justify-center', FORM_BG[med.form])}>
        <MedPhoto
          med={med}
          className="absolute inset-0 h-full w-full"
          fallback={<Icon className={cn('w-14 h-14', FORM_ICON_COLOR[med.form])} aria-hidden="true" />}
        />
        {/* badge หยุดใช้ */}
        {!med.active && (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-slate-700/80 text-white text-xs font-bold">
            หยุดใช้
          </span>
        )}
        {/* badge สต็อกเตือน */}
        {med.active && level !== 'good' && (
          <span
            className={cn(
              'absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-bold',
              level === 'critical' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'
            )}
          >
            {med.remaining <= 0 ? 'หมดแล้ว' : level === 'critical' ? 'ใกล้หมดมาก' : 'ใกล้หมด'}
          </span>
        )}
      </div>

      {/* ส่วนล่าง: ข้อมูล */}
      <div className="flex flex-col gap-1 p-3 flex-1">
        <p className="text-sm font-bold text-slate-900 leading-snug line-clamp-2 group-hover:text-purple-800">
          {med.name}
        </p>
        <p className="text-xs text-slate-500">{formLabel}</p>
        {med.condition && (
          <p className="text-xs text-slate-500 truncate">🏥 {med.condition}</p>
        )}
        <p className="text-xs text-slate-600 mt-0.5">{timesText}</p>

        <div className="mt-auto pt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
          <span className="text-xs font-semibold text-slate-700">
            เหลือ {formatQty(med.remaining)} {med.unit}
          </span>
          {!med.asNeeded && <StockBadge med={med} />}
          <ExpiryBadge med={med} />
        </div>
      </div>
    </button>
  );
};

/** ตู้ยา: แสดงเป็น grid การ์ดภาพ กดเข้าไปดูรายละเอียด */
export const MedCabinet: React.FC<MedCabinetProps> = ({ meds, onOpen }) => {
  const active = meds.filter((m) => m.active);
  const stopped = meds.filter((m) => !m.active);

  return (
    <div className="space-y-6">
      {active.length > 0 && (
        <section>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-base font-bold text-slate-700">
              กำลังใช้อยู่
              <span className="ml-2 text-sm font-medium text-slate-600">· {active.length} รายการ</span>
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {active.map((med) => (
              <MedGridCard key={med.id} med={med} onOpen={onOpen} />
            ))}
          </div>
        </section>
      )}

      {stopped.length > 0 && (
        <section>
          <h2 className="text-base font-bold text-slate-500 mb-3">
            หยุดใช้แล้ว
            <span className="ml-2 text-sm font-medium text-slate-600">· {stopped.length} รายการ</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {stopped.map((med) => (
              <MedGridCard key={med.id} med={med} onOpen={onOpen} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
