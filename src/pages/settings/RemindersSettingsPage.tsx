import React, { useState } from 'react';
import { Bell, Clock, ShieldAlert, UserCheck } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Chip, FieldGroup } from '../../components/ui/ChoiceChips';
import { PageLayout } from '../../components/settings/PageLayout';
import { SwitchRow } from '../../components/settings/SwitchRow';
import { useToast } from '../../components/ui/Toast';
import { cn } from '../../lib/cn';
import { playNotifySound, playUiSound } from '../../lib/sound';
import { PushCard } from '../../components/consult/PushCard';
import {
  LOW_STOCK_DAY_OPTIONS,
  REPEAT_COUNT_MAX,
  REPEAT_COUNT_MIN,
  loadSettings,
  saveSettings,
  type LowStockDays,
  type ReminderSettings,
} from '../../lib/settings';
import { commonDoseWords, loadMeds } from '../../lib/meds';
import {
  loadRoutingConfigs,
  saveRoutingConfigs,
  type MemberRoutingConfig,
  type RecipientPermission,
} from '../../lib/notifications';

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
  const [routingConfigs, setRoutingConfigs] = useState(() => loadRoutingConfigs(settings.members));
  const [selectedMemberId, setSelectedMemberId] = useState(() => settings.members[0]?.id ?? '');
  const toast = useToast();
  // คำกริยาตามยาที่ใช้อยู่ (ยากินทั้งหมด = กิน, มียาแบบอื่นปน = ใช้) ให้ตรงกับหน้ายาและข้อความแจ้งเตือน
  const [cw] = useState(() => commonDoseWords(loadMeds().meds.filter((m) => m.active).map((m) => m.form)));

  const update = (patch: Partial<ReminderSettings>) => {
    const next = saveSettings({ ...settings, reminders: { ...settings.reminders, ...patch } });
    setSettings(next);
    toast.show('บันทึกแล้ว');
  };

  const updateRouting = (memberId: string, patch: Partial<MemberRoutingConfig>) => {
    const current = routingConfigs[memberId] || {
      memberId,
      medication: 'own_only',
      appointment: 'own_only',
      family: 'important_only',
      system: 'important_only',
      escalationDelayMin: 30,
    };
    const next = {
      ...routingConfigs,
      [memberId]: { ...current, ...patch },
    };
    setRoutingConfigs(next);
    saveRoutingConfigs(next);
    toast.show('บันทึกการตั้งค่าผู้รับการแจ้งเตือนแล้ว');
  };

  const { reminders } = settings;
  const lowStockOn = reminders.lowStock;
  const selectedMember = settings.members.find((m) => m.id === selectedMemberId) ?? settings.members[0];
  const currentMemberRouting = (selectedMember && routingConfigs[selectedMember.id]) || {
    memberId: selectedMemberId,
    medication: 'own_only',
    appointment: 'own_only',
    family: 'important_only',
    system: 'important_only',
    escalationDelayMin: 30,
  };

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
                description={`เตือนเมื่อถึงเวลา${cw.phrase}ตามที่ตั้งไว้`}
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
              <span>การเตือนซ้ำเมื่อยังไม่{cw.phrase}</span>
            </h2>

            <FieldGroup
              label="เตือนซ้ำได้กี่ครั้ง"
              hint={`ถ้ายังไม่กด “${cw.done}” แอปจะเตือนซ้ำตามจำนวนครั้งที่ตั้งไว้`}
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

          <PushCard />

          <Card className="shadow-xs">
            <SwitchRow
              className="px-0 py-1"
              label="เสียงแจ้งเตือน"
              description="เล่นเสียง ติ๊งนอง เมื่อมีแจ้งเตือนใหม่ขณะเปิดแอปอยู่ (ตอนปิดแอป เสียงจะเป็นไปตามที่ตั้งในมือถือ)"
              checked={reminders.sound}
              onChange={(checked) => {
                update({ sound: checked });
                if (checked) playNotifySound();
              }}
            />
            <div data-sound="off" className="border-t-2 border-dashed border-slate-200">
              <SwitchRow
                className="px-0 py-1"
                label="เสียงเอฟเฟกต์"
                description="เสียงเบา ๆ ตอนกดปุ่ม เปิดปิดสวิตช์ เปิดหน้าต่าง และบันทึกสำเร็จ"
                checked={reminders.uiSound}
                onChange={(checked) => {
                  update({ uiSound: checked });
                  if (checked) playUiSound('toggleOn', true);
                }}
              />
            </div>
          </Card>

          {/* แจ้งคนในบ้านเมื่อยังไม่กินยาถึงครั้งที่ 2 */}
          <Card className="shadow-xs">
            <SwitchRow
              className="px-0 py-1"
              label="แจ้งคนในบ้านด้วย"
              description={`ถ้ายังไม่${cw.phrase}จนถึงการเตือนครั้งที่ 2 การแจ้งเตือนจะส่งไปหาทุกคนในบ้านทันที เพื่อให้คนในบ้านช่วยดูแล`}
              checked={reminders.escalateToFamily}
              onChange={(checked) => update({ escalateToFamily: checked })}
            />
          </Card>
        </div>

        {/* ส่วนที่ 2.3 การตั้งค่าผู้รับการแจ้งเตือน (Notification Recipients & Routing) */}
        <div className="lg:col-span-12 space-y-4 pt-4 border-t border-slate-200">
          <Card className="shadow-xs space-y-5">
            <div className="space-y-3">
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 text-lg sm:text-xl font-bold text-slate-900">
                  <UserCheck className="w-5 h-5 shrink-0 text-purple-700" aria-hidden="true" />
                  <span>ผู้รับการแจ้งเตือน</span>
                </h2>
                <p className="text-sm text-slate-600 mt-0.5">
                  กำหนดบทบาทและเลือกประเภทการแจ้งเตือนที่สมาชิกแต่ละคนจะได้รับในบ้าน
                </p>
              </div>

              {/* เลือกสมาชิกเพื่อกำหนดค่า */}
              <div className="flex flex-wrap items-center gap-2">
                {settings.members.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMemberId(m.id)}
                    className={cn(
                      'min-h-[44px] rounded-xl border px-3 py-1.5 text-xs sm:text-sm font-extrabold transition-colors cursor-pointer',
                      selectedMember?.id === m.id
                        ? 'border-purple-600 bg-purple-600 text-white shadow-xs'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-purple-50'
                    )}
                  >
                    {m.name} ({m.relation})
                  </button>
                ))}
              </div>
            </div>

            {selectedMember && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-base text-slate-900">
                    ตั้งค่าให้: {selectedMember.name}
                  </span>
                  <span className="text-xs font-bold text-purple-800 bg-purple-100 rounded-full px-2.5 py-0.5">
                    {selectedMember.role === 'owner' ? 'ผู้ดูแลหลักของบ้าน' : 'สมาชิกในบ้าน'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* ยาและการดูแล */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2">
                    <p className="text-sm font-bold text-slate-800">1. การแจ้งเตือนเรื่องยา</p>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { v: 'all', l: 'ทั้งหมด (ทุกยาในบ้าน)' },
                        { v: 'important_only', l: 'เฉพาะสำคัญ (ขาดยา/ยาหมด)' },
                        { v: 'own_only', l: 'เฉพาะยาของตัวเอง' },
                        { v: 'none', l: 'ไม่รับ' },
                      ].map((opt) => (
                        <button
                          key={opt.v}
                          type="button"
                          onClick={() => updateRouting(selectedMember.id, { medication: opt.v as RecipientPermission })}
                          className={cn(
                            'min-h-[44px] rounded-lg border px-3 py-1 text-xs font-bold transition-colors cursor-pointer',
                            currentMemberRouting.medication === opt.v
                              ? 'border-purple-600 bg-purple-50 text-purple-900 ring-1 ring-purple-600'
                              : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                          )}
                        >
                          {opt.l}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* นัดหมายแพทย์ */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2">
                    <p className="text-sm font-bold text-slate-800">2. การแจ้งเตือนนัดหมายแพทย์</p>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { v: 'all', l: 'ทั้งหมด (ทุกนัดในบ้าน)' },
                        { v: 'important_only', l: 'เฉพาะสำคัญ (วันนี้/พรุ่งนี้)' },
                        { v: 'own_only', l: 'เฉพาะนัดของตัวเอง' },
                        { v: 'none', l: 'ไม่รับ' },
                      ].map((opt) => (
                        <button
                          key={opt.v}
                          type="button"
                          onClick={() => updateRouting(selectedMember.id, { appointment: opt.v as RecipientPermission })}
                          className={cn(
                            'min-h-[44px] rounded-lg border px-3 py-1 text-xs font-bold transition-colors cursor-pointer',
                            currentMemberRouting.appointment === opt.v
                              ? 'border-purple-600 bg-purple-50 text-purple-900 ring-1 ring-purple-600'
                              : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                          )}
                        >
                          {opt.l}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* เหตุการณ์ในครอบครัว */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2">
                    <p className="text-sm font-bold text-slate-800">3. การแจ้งเตือนในครอบครัว</p>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { v: 'all', l: 'ทั้งหมด (ค่าสุขภาพ, อาการ, สมาชิกใหม่)' },
                        { v: 'important_only', l: 'เฉพาะสำคัญ (สัญญาณชีพผิดปกติ)' },
                        { v: 'none', l: 'ไม่รับ' },
                      ].map((opt) => (
                        <button
                          key={opt.v}
                          type="button"
                          onClick={() => updateRouting(selectedMember.id, { family: opt.v as RecipientPermission })}
                          className={cn(
                            'min-h-[44px] rounded-lg border px-3 py-1 text-xs font-bold transition-colors cursor-pointer',
                            currentMemberRouting.family === opt.v
                              ? 'border-purple-600 bg-purple-50 text-purple-900 ring-1 ring-purple-600'
                              : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                          )}
                        >
                          {opt.l}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ระบบ */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2">
                    <p className="text-sm font-bold text-slate-800">4. การแจ้งเตือนระบบ</p>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { v: 'all', l: 'ทั้งหมด (ซิงก์ข้อมูล)' },
                        { v: 'important_only', l: 'เฉพาะสำคัญ' },
                        { v: 'none', l: 'ไม่รับ' },
                      ].map((opt) => (
                        <button
                          key={opt.v}
                          type="button"
                          onClick={() => updateRouting(selectedMember.id, { system: opt.v as RecipientPermission })}
                          className={cn(
                            'min-h-[44px] rounded-lg border px-3 py-1 text-xs font-bold transition-colors cursor-pointer',
                            currentMemberRouting.system === opt.v
                              ? 'border-purple-600 bg-purple-50 text-purple-900 ring-1 ring-purple-600'
                              : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                          )}
                        >
                          {opt.l}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ตั้งเวลาหน่วงก่อนแจ้งผู้ดูแล (Escalation Delay) */}
                <div className="pt-2 border-t border-slate-200 fit-row justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 flex items-start gap-1.5">
                      <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0 text-purple-700" />
                      <span>ตั้งเวลาหน่วงก่อนส่งต่อการแจ้งเตือนหาผู้ดูแล</span>
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      หากยังไม่ได้รับการยืนยันการรับประทานยา จะรอเวลานี้ก่อนแจ้งเตือนผู้ดูแลหลัก
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5 shrink-0">
                    {[15, 30, 45, 60].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => updateRouting(selectedMember.id, { escalationDelayMin: mins })}
                        className={cn(
                          'min-h-[44px] rounded-xl border px-3 py-1.5 text-xs font-extrabold transition-colors cursor-pointer',
                          currentMemberRouting.escalationDelayMin === mins
                            ? 'border-purple-600 bg-purple-600 text-white'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-purple-50'
                        )}
                      >
                        {mins} นาที
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </PageLayout>
  );
};
