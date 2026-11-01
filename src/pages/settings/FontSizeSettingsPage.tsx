import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { PageLayout } from '../../components/settings/PageLayout';
import { useToast } from '../../components/ui/Toast';
import { cn } from '../../lib/cn';
import { FONT_SCALES, applyFontScale, loadSettings, saveSettings, type FontScale } from '../../lib/settings';

/** ข้อความตัวอย่างจริงในแอป (ชื่อยา ขนาด วิธีกิน) ใช้ให้ผู้ใช้เห็นว่าแต่ละขนาดอ่านเป็นอย่างไร */
const SAMPLE_TEXT = 'ยาความดัน เม็ดเล็ก หลังอาหารเช้า';

/** ตั้งค่า > ขนาดตัวอักษร: เลือก 3 ระดับ เห็นผลทั้งแอปทันที */
export const FontSizeSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState(loadSettings);
  const toast = useToast();

  const selected = FONT_SCALES.find((option) => option.value === settings.fontScale) ?? FONT_SCALES[0];

  const choose = (value: FontScale) => {
    if (value === settings.fontScale) return;
    const next = saveSettings({ ...settings, fontScale: value });
    setSettings(next);
    applyFontScale(value);

    const label = FONT_SCALES.find((option) => option.value === value)?.label ?? '';
    toast.show(`เปลี่ยนขนาดตัวอักษรเป็น ${label} แล้ว`);
  };

  return (
    <PageLayout title="ขนาดตัวอักษร" description="เลือกขนาดที่อ่านสบายที่สุด ใช้ทั้งแอปทันที">
      <fieldset>
        <legend className="sr-only">ขนาดตัวอักษร</legend>
        <div className="space-y-3">
          {FONT_SCALES.map((option) => {
            const isSelected = settings.fontScale === option.value;
            return (
              <label
                key={option.value}
                className={cn(
                  'flex items-center gap-4 min-h-[72px] px-5 py-4 rounded-2xl border-2 cursor-pointer transition-colors',
                  'focus-within:ring-2 focus-within:ring-purple-600 focus-within:ring-offset-2',
                  isSelected
                    ? 'border-purple-600 bg-purple-50'
                    : 'border-slate-200 bg-white hover:border-purple-300'
                )}
              >
                <input
                  type="radio"
                  name="font-scale"
                  value={option.value}
                  checked={isSelected}
                  onChange={() => choose(option.value)}
                  className="sr-only"
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-base font-bold text-slate-900">{option.label}</span>
                  {/*
                    ตัวอย่างวาดที่ขนาดจริงของตัวเลือกนี้ โดยคำนวณเป็น rem เทียบกับขนาดฐานที่ใช้อยู่ตอนนี้
                    (ไม่ใช้ px ตายตัว) เมื่อเปลี่ยนตัวเลือก ขนาดฐานเปลี่ยน ตัวอย่างทุกบรรทัดก็คำนวณใหม่ให้ถูก
                  */}
                  <span
                    className="block mt-1 text-slate-700 break-words leading-snug"
                    style={{ fontSize: `${option.px / selected.px}rem` }}
                  >
                    {SAMPLE_TEXT}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    'w-7 h-7 shrink-0 rounded-full border-2 flex items-center justify-center',
                    isSelected ? 'bg-purple-700 border-purple-700 text-white' : 'border-slate-300 bg-white'
                  )}
                >
                  {isSelected && <Check className="w-4 h-4" />}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* ตัวอย่างหน้าตาจริงในแอป ใช้ขนาดตามที่เลือกอยู่ และอัปเดตทันทีเมื่อแตะตัวเลือก */}
      <Card className="bg-purple-50/70 border-purple-200" aria-live="polite">
        <p className="text-sm font-bold text-purple-900">ตัวอย่างในแอป ({selected.label})</p>
        <div className="mt-3 rounded-2xl bg-white border border-purple-100 p-4">
          <p className="text-lg font-bold text-slate-900 break-words">ยาความดัน</p>
          <p className="mt-1 text-base text-slate-800 break-words">เม็ดเล็ก · หลังอาหารเช้า</p>
          <p className="mt-1 text-sm text-slate-600">เหลือ 12 เม็ด</p>
        </div>
      </Card>
    </PageLayout>
  );
};
