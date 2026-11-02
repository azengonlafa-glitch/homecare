import React from 'react';
import { Pill, Syringe, Droplets, Wind, FlaskConical, Layers, Package2, Circle } from 'lucide-react';
import { StockBadge } from './StockBadge';
import {
  PERIOD_LABEL,
  formatMedForm,
  formatQty,
  stockLevel,
  type MedForm,
  type Medication,
} from '../../lib/meds';
import { cn } from '../../lib/cn';
import { getFile } from '../../lib/fileStore';

interface MedCabinetProps {
  meds: Medication[];
  onOpen: (med: Medication) => void;
  onEdit: (med: Medication) => void;
  onRefill: (med: Medication) => void;
}

/** ไอคอนประจำรูปแบบยา */
const FORM_ICON: Record<MedForm, React.FC<{ className?: string }>> = {
  tablet: Pill,
  capsule: Layers,
  liquid: Droplets,
  injection: Syringe,
  topical: FlaskConical,
  drops: Droplets,
  spray: Wind,
  other: Package2,
};

/** สีพื้นการ์ดตามรูปแบบยา */
const FORM_BG: Record<MedForm, string> = {
  tablet:    'bg-purple-50',
  capsule:   'bg-blue-50',
  liquid:    'bg-cyan-50',
  injection: 'bg-rose-50',
  topical:   'bg-green-50',
  drops:     'bg-sky-50',
  spray:     'bg-indigo-50',
  other:     'bg-amber-50',
};

const FORM_ICON_COLOR: Record<MedForm, string> = {
  tablet:    'text-purple-500',
  capsule:   'text-blue-500',
  liquid:    'text-cyan-500',
  injection: 'text-rose-500',
  topical:   'text-green-500',
  drops:     'text-sky-500',
  spray:     'text-indigo-500',
  other:     'text-amber-500',
};

/** การ์ดยาแบบ visual box */
const MedGridCard: React.FC<{ med: Medication; onOpen: (m: Medication) => void }> = ({ med, onOpen }) => {
  const level = stockLevel(med);
  const Icon = FORM_ICON[med.form] ?? Circle;
  const formLabel = formatMedForm(med);
  const timesText = med.periods
    .map((p) => `${PERIOD_LABEL[p]}${med.times[p] ? ` ${med.times[p]}` : ''}`)
    .join(' · ');

  // รูปที่ถ่ายไว้ (pill photo ก่อน ถ้าไม่มีใช้ label photo)
  const photoAtt = med.pillPhoto ?? med.labelPhoto;
  const [photoUrl, setPhotoUrl] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!photoAtt) { setPhotoUrl(null); return; }
    void getFile(photoAtt.id).then((blob) => {
      if (blob) setPhotoUrl(URL.createObjectURL(blob));
    });
    return () => { if (photoUrl) URL.revokeObjectURL(photoUrl); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoAtt?.id]);

  return (
    <button
      type="button"
      onClick={() => onOpen(med)}
      className={cn(
        'group relative flex flex-col rounded-2xl border-2 overflow-hidden text-left',
        'transition-shadow hover:shadow-lg active:scale-95',
        !med.active && 'opacity-60',
        level === 'danger' ? 'border-red-300' : level === 'low' ? 'border-amber-300' : 'border-transparent',
        'shadow-sm bg-white'
      )}
      aria-label={`${med.name} — กดเพื่อดูรายละเอียด`}
    >
      {/* ส่วนบน: รูปยา / ไอคอน */}
      <div className={cn('relative w-full aspect-square flex items-center justify-center', FORM_BG[med.form])}>
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={med.name}
            width={200}
            height={200}
            className="w-full h-full object-cover"
          />
        ) : (
          <Icon className={cn('w-14 h-14', FORM_ICON_COLOR[med.form])} aria-hidden="true" />
        )}
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
              level === 'danger' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'
            )}
          >
            {level === 'danger' ? 'ยาหมดแล้ว!' : 'ใกล้หมด'}
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
        <div className="mt-auto pt-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700">
            เหลือ {formatQty(med.remaining)} {med.unit}
          </span>
          <StockBadge med={med} compact />
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
          <h2 className="text-base font-bold text-slate-700 mb-3">
            กำลังใช้อยู่
            <span className="ml-2 text-sm font-medium text-slate-400">· {active.length} รายการ</span>
          </h2>
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
            <span className="ml-2 text-sm font-medium text-slate-400">· {stopped.length} รายการ</span>
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
