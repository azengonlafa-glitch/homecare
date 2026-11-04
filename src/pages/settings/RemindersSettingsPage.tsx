import React, { useState } from 'react';
import { Bell, Clock } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Chip, FieldGroup } from '../../components/ui/ChoiceChips';
import { PageLayout } from '../../components/settings/PageLayout';
import { SwitchRow } from '../../components/settings/SwitchRow';
import { useToast } from '../../components/ui/Toast';
import { cn } from '../../lib/cn';
import {
  LOW_STOCK_DAY_OPTIONS,
  REPEAT_COUNT_MAX,
  REPEAT_COUNT_MIN,
  loadSettings,
  saveSettings,
  type LowStockDays,
  type ReminderSettings,
} from '../../lib/settings';

/** ปุ่ม +/- ตั้งจำนวนครั้ง (ปุ่มใหญ่ กดง่ายด้วยนิ้วเดียว) */
const stepperClass =
  'inline-flex items-center justify-center w-14 h-14 rounded-2xl border-2 border-slate-300 bg-white text-2xl font-bold text-slate-800 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors';

/**
 * ตั้งค่า > การเตือน:
 * - เปิด/ปิด 3 ชนิด (ยาใกล้หมด, ช่วงกินยา, นัดหมอ)
 * - กำหนดจำนวนวันเตือนยาใกล้หมด
 * - ตั้งจำนวนรอบเตือนซ้ำ และระยะห่าง
 * - ส่งแจ้งเตือนหาทุกคนในบ้านในรอบที่ 2
 * - จัด layout 2 คอลัมน์บนจอใหญ่ และ 1 คอลัมน์บนมือถือ
 */
export const RemindersSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState(loadSettings);
  const toast = useToast();

  const update = (patch: Partial<ReminderSettings>) => {
    const next = saveSettings({ ...settings, reminders: { ...settings.reminders, ...patch } });
    setSettings(next);
    toast.show('บันทึกแล้ว');
  };

  const { reminders } = settings;
  const lowStockOn = reminders.lowStock;

  return (
    <PageLayout
      wide
      columns="custom"
      title="การเตือน"
      description="เลือกเรื่องที่อยากให้แอปช่วยเตือน และกำหนดเงื่อนไขการเตือนซ้ำ"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* คอลัมน์ซ้าย: การเตือนหลัก และจำนวนวันเตือนยาใกล้หมด */}
        <div className="space-y-6 lg:col-span-6">
          <Card className="p-0 overflow-hidden shadow-xs">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                <Bell className="w-5 h-5 text-purple-700" aria-hidden="true" />
                <span>การแจ้งเตือนหลัก</span>
              </h2>
              <p className="text-sm text-slate-600 mt-0.5">เปิดหรือปิดการแจ้งเตือนตามหัวข้อ</p>
            </div>
            <div className="divide-y divide-slate-200">
              <SwitchRow
                className="rounded-none px-5 py-4"
                label="ยาใกล้หมด"
                description="เตือนก่อนยาจะหมด จะได้เตรียมไปรับยาเพิ่ม"
                checked={reminders.lowStock}
                onChange={(checked) => update({ lowStock: checked })}
              />
              <SwitchRow
                className="rounded-none px-5 py-4"
                label="ช่วงกินยา"
                description="เตือนเมื่อถึงเวลากินยาตามที่ตั้งไว้"
                checked={reminders.doseWindow}
                onChange={(checked) => update({ doseWindow: checked })}
              />
              <SwitchRow
                className="rounded-none px-5 py-4"
                label="นัดหมอ"
                description="เตือนก่อนถึงวันนัดหมอ"
                checked={reminders.appointment}
                onChange={(checked) => update({ appointment: checked })}
              />
            </div>
          </Card>

          {/* ตั้งจำนวนวันได้เมื่อเปิด "ยาใกล้หมด" */}
          <Card className={cn('shadow-xs transition-colors', !lowStockOn && 'bg-slate-50/70')}>
            <div className={cn(!lowStockOn && 'opacity-60')} aria-disabled={!lowStockOn}>
              <FieldGroup
                label="เตือนเมื่อยาเหลือกี่วัน"
                hint="แอปจะเตือนเมื่อยาเหลือน้อยกว่าหรือเท่ากับจำนวนวันที่เลือก"
              >
                <div className="flex flex-wrap gap-2">
                  {LOW_STOCK_DAY_OPTIONS.map((days) => (
                    <Chip
                      key={days}
                      selected={reminders.lowStockDays === days}
                      disabled={!lowStockOn}
                      onClick={() => update({ lowStockDays: days as LowStockDays })}
                    >
                      {days} วัน
                    </Chip>
                  ))}
                </div>
              </FieldGroup>
            </div>
            {!lowStockOn && (
              <p className="mt-4 text-base font-bold text-slate-800">
                เปิดการเตือนยาใกล้หมดก่อน เพื่อปรับจำนวนวัน
              </p>
            )}
          </Card>
        </div>

        {/* คอลัมน์ขวา: การเตือนซ้ำ และการส่งหาคนในบ้าน */}
        <div className="space-y-6 lg:col-span-6">
          <Card className="shadow-xs">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900">
              <Clock className="w-5 h-5 text-purple-700" aria-hidden="true" />
              <span>การเตือนซ้ำเมื่อยังไม่กินยา</span>
            </h2>

            <FieldGroup
              label="เตือนซ้ำได้กี่ครั้ง"
              hint="ถ้ายังไม่กด “กินแล้ว” แอปจะเตือนซ้ำตามจำนวนครั้งที่ตั้งไว้"
            >
              <div className="flex items-center gap-4 mt-2">
                <button
                  type="button"
                  aria-label="ลดจำนวนครั้งที่เตือน"
                  className={stepperClass}
                  disabled={reminders.repeatCount <= REPEAT_COUNT_MIN}
                  onClick={() => update({ repeatCount: Math.max(REPEAT_COUNT_MIN, reminders.repeatCount - 1) })}
                >
                  −
                </button>
                <p
                  className="min-w-[6.5rem] text-center text-2xl font-extrabold text-slate-900"
                  aria-live="polite"
                >
                  {reminders.repeatCount} ครั้ง
                </p>
                <button
                  type="button"
                  aria-label="เพิ่มจำนวนครั้งที่เตือน"
                  className={stepperClass}
                  disabled={reminders.repeatCount >= REPEAT_COUNT_MAX}
                  onClick={() => update({ repeatCount: Math.min(REPEAT_COUNT_MAX, reminders.repeatCount + 1) })}
                >
                  +
                </button>
              </div>
            </FieldGroup>

            <p className="mt-4 text-base text-slate-600 bg-purple-50/70 p-3.5 rounded-xl border border-purple-100">
              เตือนรวม <strong>{reminders.repeatCount} ครั้ง</strong> · เวลาแจ้งครั้งแรกและช่วงแจ้งซ้ำตั้งได้ในแต่ละยา
              (เริ่มต้น: ตรงเวลา และซ้ำทุก 10 นาที)
              {reminders.repeatCount > 1 && ' · ครั้งที่ 2 เป็นต้นไปจะแจ้งคนในบ้านด้วยถ้าเปิดไว้'}
              {reminders.repeatCount === 1 && ' · ตั้ง 1 ครั้ง จะไม่มีการเตือนซ้ำ'}
            </p>
          </Card>

          {/* แจ้งคนในบ้านเมื่อยังไม่กินยาถึงครั้งที่ 2 */}
          <Card className="shadow-xs">
            <SwitchRow
              className="px-0 py-1"
              label="แจ้งคนในบ้านด้วย"
              description="ถ้ายังไม่กินยาจนถึงการเตือนครั้งที่ 2 การแจ้งเตือนจะส่งไปหาทุกคนในบ้านทันที เพื่อให้คนในบ้านช่วยดูแล"
              checked={reminders.escalateToFamily}
              onChange={(checked) => update({ escalateToFamily: checked })}
            />
          </Card>
        </div>
      </div>
    </PageLayout>
  );
};
