import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Chip } from '../ui/ChoiceChips';
import { MOODS, MOOD_TONE, moodMeta, type MoodKey } from '../../data/journalOptions';
import { cn } from '../../lib/cn';
import { MoodDino } from './MoodDino';

/** ดีเขียว · กลางๆเหลือง · ไม่ดีแดง (สีพื้นอ่อน + ขอบสีเข้มเมื่อเลือก) */
const MOOD_TILE: Record<MoodKey, { tile: string; active: string }> = {
  great: { tile: 'bg-emerald-100', active: 'border-emerald-600' },
  complicated: { tile: 'bg-amber-100', active: 'border-amber-500' },
  down: { tile: 'bg-red-100', active: 'border-red-600' },
};

interface MoodPickerModalProps {
  open: boolean;
  onClose: () => void;
  main: MoodKey | null;
  details: string[];
  onSave: (main: MoodKey | null, details: string[]) => void;
  /** ใส่เมื่ออยู่ในขั้นตอนที่ข้ามได้ */
  onSkip?: () => void;
}

const MoodDialog: React.FC<Omit<MoodPickerModalProps, 'open'>> = ({
  onClose,
  main,
  details,
  onSave,
  onSkip,
}) => {
  const [selectedMain, setSelectedMain] = useState<MoodKey | null>(main);
  const [selectedDetails, setSelectedDetails] = useState<string[]>(details);
  const meta = moodMeta(selectedMain);

  const chooseMain = (key: MoodKey) => {
    if (key === selectedMain) return;
    setSelectedMain(key);
    setSelectedDetails([]); // เปลี่ยนกลุ่มแล้วเริ่มเลือกความรู้สึกเฉพาะใหม่
  };

  const toggleDetail = (item: string) =>
    setSelectedDetails((prev) => (prev.includes(item) ? prev.filter((v) => v !== item) : [...prev, item]));

  return (
    <Modal
      open
      onClose={onClose}
      title="วันนี้รู้สึกอย่างไร?"
      footer={
        <div className="flex items-center justify-end gap-2">
          {onSkip && (
            <Button type="button" variant="neutral" size="sm" onClick={onSkip}>
              ข้ามขั้นนี้
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            disabled={!selectedMain}
            onClick={() => onSave(selectedMain, selectedDetails)}
            className="px-8"
          >
            บันทึกอารมณ์
          </Button>
        </div>
      }
    >
      <div className="py-6 space-y-7">
        <div role="group" aria-label="กลุ่มอารมณ์" className="grid grid-cols-3 gap-3">
          {MOODS.map((mood) => {
            const active = selectedMain === mood.key;
            return (
              <button
                key={mood.key}
                type="button"
                aria-pressed={active}
                onClick={() => chooseMain(mood.key)}
                className={cn(
                  'hover-lift flex flex-col items-center gap-2 rounded-[1.75rem] border-2 p-3 sm:p-4 text-center cursor-pointer',
                  MOOD_TILE[mood.key].tile,
                  active ? MOOD_TILE[mood.key].active : 'border-transparent'
                )}
              >
                <MoodDino
                  mood={mood.key}
                  className={cn(
                    'h-16 w-16 sm:h-24 sm:w-24 transition-transform',
                    active && 'scale-110 -translate-y-0.5'
                  )}
                />
                <span className="text-base sm:text-lg font-bold text-slate-900 leading-tight min-[360px]:whitespace-nowrap">
                  {mood.label}
                </span>
                <span className="hidden sm:block text-sm text-slate-600 leading-snug">
                  {mood.description}
                </span>
              </button>
            );
          })}
        </div>

        {meta && (
          <div>
            <p className="text-base sm:text-lg font-bold text-slate-900 mb-1">เจาะจงความรู้สึกได้ไหม?</p>
            <p className="text-sm sm:text-base text-slate-600 mb-3">
              เลือกได้หลายอย่าง หรือไม่เลือกก็ได้ (ไม่บังคับ)
            </p>
            <div role="group" aria-label={`ความรู้สึกในกลุ่ม ${meta.label}`} className="flex flex-wrap gap-2">
              {meta.details.map((item) => (
                <Chip key={item} selected={selectedDetails.includes(item)} onClick={() => toggleDetail(item)}>
                  {item}
                </Chip>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

/** เลือกอารมณ์ 2 ชั้น: เลือกกลุ่มใหญ่ก่อน แล้วความรู้สึกเฉพาะจะแตกออกมาให้เลือกต่อ */
export const MoodPickerModal: React.FC<MoodPickerModalProps> = ({ open, ...rest }) =>
  open ? <MoodDialog {...rest} /> : null;

/** ป้ายแสดงอารมณ์ที่เลือก (ใช้ทั้งในฟอร์มโพสต์และการ์ดโพสต์) */
export const MoodBadge: React.FC<{ main: MoodKey; details: string[] }> = ({ main, details }) => {
  const meta = moodMeta(main);
  if (!meta) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-base font-semibold',
        MOOD_TONE[main].badge
      )}
    >
      <MoodDino mood={main} className="h-8 w-8 -my-1 shrink-0" />
      <span>
        {meta.label}
        {details.length > 0 && <span className="font-normal"> · {details.join(', ')}</span>}
      </span>
    </span>
  );
};
