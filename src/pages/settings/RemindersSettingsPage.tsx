import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Chip, FieldGroup } from '../../components/ui/ChoiceChips';
import { SettingsSubPage } from '../../components/settings/SettingsSubPage';
import { SwitchRow } from '../../components/settings/SwitchRow';
import { SavedNote } from '../../components/settings/SavedNote';
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
  const [saved, setSaved] = useState(false);

  const update = (patch: Partial<ReminderSettings>) => {
    const next = saveSettings({ ...settings, reminders: { ...settings.reminders, ...patch } });
    setSettings(next);
    setSaved(true);
  };

  const { reminders } = settings;

  return (
    <SettingsSubPage title="การเตือน" description="เลือกเรื่องที่อยากให้แอปช่วยเตือน">
      <Card className="py-2">
        <div className="divide-y divide-slate-200">
          <SwitchRow
            label="ยาใกล้หมด"
            description="เตือนก่อนยาจะหมด จะได้เตรียมไปรับยาเพิ่ม"
            checked={reminders.lowStock}
            onChange={(checked) => update({ lowStock: checked })}
          />
          <SwitchRow
            label="ช่วงกินยา"
            description="เตือนเมื่อถึงเวลากินยาตามที่ตั้งไว้"
            checked={reminders.doseWindow}
            onChange={(checked) => update({ doseWindow: checked })}
          />
          <SwitchRow
            label="นัดหมอ"
            description="เตือนก่อนถึงวันนัดหมอ"
            checked={reminders.appointment}
            onChange={(checked) => update({ appointment: checked })}
          />
        </div>
      </Card>

      <Card>
        <FieldGroup
          label="เตือนเมื่อยาเหลือกี่วัน"
          hint="แอปจะเตือนเมื่อยาเหลือน้อยกว่าหรือเท่ากับจำนวนวันที่เลือก"
        >
          <div className="flex flex-wrap gap-2">
            {LOW_STOCK_DAY_OPTIONS.map((days) => (
              <Chip
                key={days}
                selected={reminders.lowStockDays === days}
                onClick={() => update({ lowStockDays: days as LowStockDays })}
              >
                {days} วัน
              </Chip>
            ))}
          </div>
        </FieldGroup>
      </Card>

      <SavedNote show={saved} />
    </SettingsSubPage>
  );
};
