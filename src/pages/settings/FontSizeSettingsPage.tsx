import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { SettingsSubPage } from '../../components/settings/SettingsSubPage';
import { SavedNote } from '../../components/settings/SavedNote';
import { cn } from '../../lib/cn';
import {
  FONT_SCALES,
  applyFontScale,
  loadSettings,
  saveSettings,
  type FontScale,
} from '../../lib/settings';

/** ตั้งค่า > ขนาดตัวอักษร: เลือก 3 ระดับ เห็นผลทั้งแอปทันที */
export const FontSizeSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState(loadSettings);
  const [status, setStatus] = useState('');

  const selected = FONT_SCALES.find((option) => option.value === settings.fontScale) ?? FONT_SCALES[0];

  const choose = (value: FontScale) => {
    const next = saveSettings({ ...settings, fontScale: value });
    setSettings(next);
    applyFontScale(value);

    const label = FONT_SCALES.find((option) => option.value === value)?.label ?? '';
    setStatus(`เปลี่ยนขนาดตัวอักษรเป็น ${label} แล้ว`);
  };

  return (
    <SettingsSubPage title="ขนาดตัวอักษร" description="เลือกขนาดที่อ่านสบายที่สุด ใช้ทั้งแอปทันที">
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
                  <span className="block text-lg font-bold text-slate-900">{option.label}</span>
                  <span className="block mt-0.5 text-sm text-slate-600">ตัวอักษร {option.px}px</span>
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

      <Card className="bg-purple-50/70 border-purple-200">
        <p className="text-sm font-bold text-purple-900">ตัวอย่างข้อความ</p>
        <p
          style={{ fontSize: `${selected.px}px`, lineHeight: 1.7 }}
          className="mt-2 text-slate-900 break-words"
        >
          นี่คือข้อความตัวอย่างขนาด {selected.px}px อ่านสบายตาสำหรับทุกคนในบ้าน
        </p>
      </Card>

      <SavedNote show={!!status}>{status}</SavedNote>
    </SettingsSubPage>
  );
};
