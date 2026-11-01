import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Chip, FieldGroup } from '../../components/ui/ChoiceChips';
import { PageLayout } from '../../components/settings/PageLayout';
import { SwitchRow } from '../../components/settings/SwitchRow';
import { useToast } from '../../components/ui/Toast';
import { cn } from '../../lib/cn';
import {
  LOW_STOCK_DAY_OPTIONS,
  loadSettings,
  saveSettings,
  type LowStockDays,
  type ReminderSettings,
} from '../../lib/settings';

/** ตั้งค่า > การเตือน: เปิด/ปิด 3 ชนิด และกำหนดจำนวนวันเตือนยาใกล้หมด */
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
    <PageLayout title="การเตือน" description="เลือกเรื่องที่อยากให้แอปช่วยเตือน">
      {/* แถวสวิตช์ทั้ง 3 ใช้สไตล์เดียวกัน เต็มความกว้างการ์ด คั่นด้วยเส้นบาง ๆ */}
      <Card className="p-0 overflow-hidden">
        <div className="divide-y divide-slate-200">
          <SwitchRow
            className="rounded-none px-5"
            label="ยาใกล้หมด"
            description="เตือนก่อนยาจะหมด จะได้เตรียมไปรับยาเพิ่ม"
            checked={reminders.lowStock}
            onChange={(checked) => update({ lowStock: checked })}
          />
          <SwitchRow
            className="rounded-none px-5"
            label="ช่วงกินยา"
            description="เตือนเมื่อถึงเวลากินยาตามที่ตั้งไว้"
            checked={reminders.doseWindow}
            onChange={(checked) => update({ doseWindow: checked })}
          />
          <SwitchRow
            className="rounded-none px-5"
            label="นัดหมอ"
            description="เตือนก่อนถึงวันนัดหมอ"
            checked={reminders.appointment}
            onChange={(checked) => update({ appointment: checked })}
          />
        </div>
      </Card>

      {/* ตั้งจำนวนวันได้เมื่อเปิด "ยาใกล้หมด" เท่านั้น: ถ้าปิดอยู่ ส่วนที่กดไม่ได้จะจาง แต่ข้อความบอกเหตุผลคงความเข้มปกติ */}
      <Card className={cn(!lowStockOn && 'bg-slate-50')}>
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
        {!lowStockOn && <p className="mt-4 text-base font-bold text-slate-800">เปิดการเตือนยาใกล้หมดก่อน</p>}
      </Card>
    </PageLayout>
  );
};
