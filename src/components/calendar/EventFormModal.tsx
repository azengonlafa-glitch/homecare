import React, { useRef, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { TextField } from '../ui/TextField';
import { TextAreaField } from '../ui/TextAreaField';
import { NativeSelect } from '../ui/NativeSelect';
import { CheckboxField } from '../ui/CheckboxField';
import { ChipsWithCustom } from '../ui/ChipsWithCustom';
import { FieldGroup } from '../ui/ChoiceChips';
import { AttachmentPicker } from '../ui/AttachmentPicker';
import { SwitchRow } from '../settings/SwitchRow';
import { ConfirmDialog } from '../settings/ConfirmDialog';
import { DEFAULT_TIME_ZONE, TIME_ZONE_OPTIONS } from '../../data/timeZones';
import { deleteFiles } from '../../lib/fileStore';
import type { HouseholdMember } from '../../lib/settings';
import {
  REMINDER_OPTIONS,
  REPEAT_UNIT_LABEL,
  defaultRepeat,
  emptyLocation,
  type CalendarEvent,
  type EventLocation,
  type RepeatEnd,
  type RepeatUnit,
} from '../../lib/calendar';
import type { Attachment } from '../../lib/onboarding';
import { cn } from '../../lib/cn';

/** ข้อมูลที่ฟอร์มส่งกลับ (หน้าปฏิทินเติม id เวลาสร้าง และความเห็นให้เอง) */
export type EventFormData = Omit<
  CalendarEvent,
  'id' | 'comments' | 'createdById' | 'createdByName' | 'createdAt' | 'updatedAt'
>;

interface EventFormModalProps {
  open: boolean;
  /** null = สร้างกิจกรรมใหม่ */
  initial: CalendarEvent | null;
  defaultDate: string;
  members: HouseholdMember[];
  onSave: (data: EventFormData) => void;
  onClose: () => void;
}

interface FormState {
  title: string;
  description: string;
  important: boolean;
  tags: string[];
  allDay: boolean;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  timeZone: string;
  reminderOn: boolean;
  reminderMinutes: number;
  repeatOn: boolean;
  repeatEvery: string;
  repeatUnit: RepeatUnit;
  repeatEndMode: RepeatEnd;
  repeatEndDate: string;
  repeatCount: string;
  locationOn: boolean;
  location: EventLocation;
  assignOn: boolean;
  needVolunteer: boolean;
  assignees: string[];
  attachments: Attachment[];
}

const fromEvent = (ev: CalendarEvent | null, defaultDate: string): FormState => {
  const rule = ev?.repeat ?? defaultRepeat(ev?.startDate ?? defaultDate);
  return {
    title: ev?.title ?? '',
    description: ev?.description ?? '',
    important: ev?.important ?? false,
    tags: ev?.tags ?? [],
    allDay: ev?.allDay ?? false,
    startDate: ev?.startDate ?? defaultDate,
    startTime: ev?.startTime || '09:00',
    endDate: ev?.endDate ?? defaultDate,
    endTime: ev?.endTime || '10:00',
    timeZone: ev?.timeZone ?? DEFAULT_TIME_ZONE,
    reminderOn: ev ? ev.reminderMinutes !== null : false,
    reminderMinutes: ev?.reminderMinutes ?? 15,
    repeatOn: !!ev?.repeat,
    repeatEvery: String(rule.every),
    repeatUnit: rule.unit,
    repeatEndMode: rule.endMode,
    repeatEndDate: rule.endDate,
    repeatCount: String(rule.count),
    locationOn: !!ev?.location,
    location: ev?.location ?? emptyLocation(),
    assignOn: !!ev && (ev.assignees.length > 0 || ev.needVolunteer),
    needVolunteer: ev?.needVolunteer ?? false,
    assignees: ev?.assignees ?? [],
    attachments: ev?.attachments ?? [],
  };
};

const REPEAT_UNIT_OPTIONS = (Object.keys(REPEAT_UNIT_LABEL) as RepeatUnit[]).map((unit) => ({
  value: unit,
  label: REPEAT_UNIT_LABEL[unit],
}));

const Section: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cn('pt-6 mt-6 border-t border-slate-200', className)}>{children}</div>
);

const FormDialog: React.FC<Omit<EventFormModalProps, 'open'>> = ({
  initial,
  defaultDate,
  members,
  onSave,
  onClose,
}) => {
  const [form, setForm] = useState<FormState>(() => fromEvent(initial, defaultDate));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmClose, setConfirmClose] = useState(false);
  const snapshot = useRef(JSON.stringify(form));
  const originalIds = useRef(new Set((initial?.attachments ?? []).map((a) => a.id)));
  const uploadedIds = useRef(new Set<string>());

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] || Object.keys(prev).length ? {} : prev));
  };

  const setLoc = (key: keyof EventLocation, value: string) =>
    setForm((prev) => ({ ...prev, location: { ...prev.location, [key]: value } }));

  const toggleAssignee = (id: string) =>
    set(
      'assignees',
      form.assignees.includes(id) ? form.assignees.filter((a) => a !== id) : [...form.assignees, id]
    );

  const dirty = JSON.stringify(form) !== snapshot.current;

  const requestClose = () => (dirty ? setConfirmClose(true) : discard());

  /** ปิดโดยไม่บันทึก: ลบไฟล์ที่เพิ่งอัปโหลดในรอบนี้ (ไฟล์เดิมของกิจกรรมต้องเก็บไว้) */
  const discard = () => {
    const stray = [...uploadedIds.current].filter((id) => !originalIds.current.has(id));
    void deleteFiles(stray.map((id) => ({ id, name: '', type: '', size: 0 })));
    onClose();
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.title.trim()) next['ev-title'] = 'กรุณากรอกชื่อกิจกรรม';

    const startKey = form.allDay ? form.startDate : `${form.startDate}T${form.startTime}`;
    const endKey = form.allDay ? form.endDate : `${form.endDate}T${form.endTime}`;
    if (!form.startDate) next['ev-start-date'] = 'กรุณาเลือกวันที่เริ่ม';
    else if (!form.endDate) next['ev-end-date'] = 'กรุณาเลือกวันที่สิ้นสุด';
    else if (endKey < startKey) next['ev-end-date'] = 'เวลาสิ้นสุดต้องไม่ก่อนเวลาเริ่ม';

    if (form.repeatOn) {
      if (!(Number(form.repeatEvery) >= 1)) next['ev-repeat-every'] = 'กรอกจำนวนอย่างน้อย 1';
      if (form.repeatEndMode === 'after' && !(Number(form.repeatCount) >= 1))
        next['ev-repeat-count'] = 'กรอกจำนวนครั้งอย่างน้อย 1';
      if (form.repeatEndMode === 'on' && (!form.repeatEndDate || form.repeatEndDate < form.startDate)) {
        next['ev-repeat-end'] = 'วันสิ้นสุดต้องไม่ก่อนวันเริ่ม';
      }
    }

    if (form.locationOn && !form.location.name.trim() && !form.location.address1.trim()) {
      next['ev-loc-name'] = 'กรอกชื่อสถานที่หรือที่อยู่อย่างน้อยหนึ่งอย่าง';
    }
    return next;
  };

  const submit = () => {
    const found = validate();
    setErrors(found);
    const firstInvalid = Object.keys(found)[0];
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus();
      return;
    }

    const finalIds = new Set(form.attachments.map((a) => a.id));
    // ไฟล์เดิมหรือไฟล์ที่เพิ่งอัปโหลดแต่ถูกเอาออกก่อนบันทึก ให้ลบทิ้ง
    const dropped = [...originalIds.current, ...uploadedIds.current].filter((id) => !finalIds.has(id));
    void deleteFiles(dropped.map((id) => ({ id, name: '', type: '', size: 0 })));

    onSave({
      title: form.title.trim(),
      description: form.description.trim(),
      important: form.important,
      tags: form.tags,
      allDay: form.allDay,
      startDate: form.startDate,
      startTime: form.allDay ? '' : form.startTime,
      endDate: form.endDate,
      endTime: form.allDay ? '' : form.endTime,
      timeZone: form.timeZone,
      reminderMinutes: form.reminderOn ? form.reminderMinutes : null,
      repeat: form.repeatOn
        ? {
            every: Math.max(1, Math.floor(Number(form.repeatEvery))),
            unit: form.repeatUnit,
            endMode: form.repeatEndMode,
            endDate: form.repeatEndDate,
            count: Math.max(1, Math.floor(Number(form.repeatCount) || 1)),
          }
        : null,
      location: form.locationOn ? form.location : null,
      assignees: form.assignOn ? form.assignees : [],
      needVolunteer: form.assignOn ? form.needVolunteer : false,
      attachments: form.attachments,
    });
  };

  return (
    <>
      <Modal
        open
        onClose={requestClose}
        title={initial ? 'แก้ไขกิจกรรม' : 'สร้างกิจกรรม'}
        initialFocusSelector="#ev-title"
        footer={
          <Button type="button" fullWidth onClick={submit}>
            {initial ? 'บันทึกการแก้ไข' : 'สร้างกิจกรรม'}
          </Button>
        }
      >
        <div className="py-6">
          {/* ชื่อหลัก / คำอธิบาย */}
          <div className="space-y-5">
            <TextField
              id="ev-title"
              label="ชื่อกิจกรรม"
              labelSuffix="(จำเป็น)"
              autoComplete="off"
              placeholder="เช่น ไปตรวจเลือดที่โรงพยาบาล"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              error={errors['ev-title']}
            />
            <TextAreaField
              id="ev-desc"
              label="คำอธิบาย"
              labelSuffix="(ไม่บังคับ)"
              rows={3}
              placeholder="รายละเอียดที่ต้องเตรียมหรือจำไว้"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>

          {/* ติ๊กสิ่งสำคัญ + แท็ก */}
          <Section>
            <SwitchRow
              label="สำคัญ"
              description="ปักธงแดงให้เห็นเด่นในปฏิทิน และขึ้นเป็นรายการแรกของวัน"
              checked={form.important}
              onChange={(v) => set('important', v)}
            />
            <div className="mt-4">
              <ChipsWithCustom
                id="ev-tags"
                label="เกี่ยวกับอะไร (แท็ก)"
                hint="ช่วยจัดหมวดหมู่ เช่น หมอ ตรวจเลือด รับยา"
                options={[]}
                value={form.tags}
                onChange={(v) => set('tags', v)}
                customPlaceholder="พิมพ์แท็กแล้วกดเพิ่ม"
              />
            </div>
          </Section>

          {/* วันและเวลา */}
          <Section>
            <h3 className="text-lg font-bold text-slate-900 mb-3">วันและเวลา</h3>
            <div className="space-y-5">
              <CheckboxField id="ev-allday" checked={form.allDay} onChange={(v) => set('allDay', v)}>
                ทั้งวัน
              </CheckboxField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <TextField
                  id="ev-start-date"
                  type="date"
                  label="วันที่เริ่ม"
                  value={form.startDate}
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm((prev) => ({
                      ...prev,
                      startDate: value,
                      endDate: prev.endDate < value ? value : prev.endDate,
                    }));
                    setErrors({});
                  }}
                  error={errors['ev-start-date']}
                />
                {!form.allDay && (
                  <TextField
                    id="ev-start-time"
                    type="time"
                    label="เวลาเริ่ม"
                    value={form.startTime}
                    onChange={(e) => set('startTime', e.target.value)}
                  />
                )}
                <TextField
                  id="ev-end-date"
                  type="date"
                  label="วันที่สิ้นสุด"
                  min={form.startDate}
                  value={form.endDate}
                  onChange={(e) => set('endDate', e.target.value)}
                  error={errors['ev-end-date']}
                />
                {!form.allDay && (
                  <TextField
                    id="ev-end-time"
                    type="time"
                    label="เวลาสิ้นสุด"
                    value={form.endTime}
                    onChange={(e) => set('endTime', e.target.value)}
                  />
                )}
              </div>

              <NativeSelect
                id="ev-timezone"
                label="เขตเวลา"
                hint="ใช้เวลาของประเทศไหนเป็นเกณฑ์"
                options={TIME_ZONE_OPTIONS}
                value={form.timeZone}
                onChange={(v) => set('timeZone', v)}
              />
            </div>
          </Section>

          {/* แจ้งเตือน / ทำซ้ำ */}
          <Section className="space-y-1">
            <SwitchRow
              label="ส่งการแจ้งเตือน"
              description="บันทึกว่าให้เตือนก่อนถึงเวลาเท่าไร (ต้นแบบ: ยังไม่ส่งแจ้งเตือนจริง)"
              checked={form.reminderOn}
              onChange={(v) => set('reminderOn', v)}
            />
            {form.reminderOn && (
              <div className="pb-3">
                <NativeSelect
                  id="ev-reminder"
                  label="เตือนเมื่อไหร่"
                  options={REMINDER_OPTIONS}
                  value={form.reminderMinutes}
                  onChange={(v) => set('reminderMinutes', Number(v))}
                />
              </div>
            )}

            <SwitchRow
              label="ทำซ้ำ"
              description="กิจกรรมที่ต้องทำต่อเนื่อง เช่น กินยาทุกวัน ไปหาหมอทุกเดือน"
              checked={form.repeatOn}
              onChange={(v) => set('repeatOn', v)}
            />
            {form.repeatOn && (
              <div className="pb-3 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <TextField
                    id="ev-repeat-every"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    label="ทำซ้ำทุก"
                    value={form.repeatEvery}
                    onChange={(e) => set('repeatEvery', e.target.value)}
                    error={errors['ev-repeat-every']}
                  />
                  <NativeSelect
                    id="ev-repeat-unit"
                    label="หน่วย"
                    options={REPEAT_UNIT_OPTIONS}
                    value={form.repeatUnit}
                    onChange={(v) => set('repeatUnit', v as RepeatUnit)}
                  />
                </div>

                <FieldGroup label="สิ้นสุดการทำซ้ำ" error={errors['ev-repeat-end']}>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 min-h-[48px] cursor-pointer">
                      <input
                        type="radio"
                        name="repeat-end"
                        checked={form.repeatEndMode === 'never'}
                        onChange={() => set('repeatEndMode', 'never')}
                        className="w-5 h-5 text-purple-700 focus:ring-purple-600"
                      />
                      <span className="text-base sm:text-lg text-slate-900">ไม่สิ้นสุด</span>
                    </label>
                    <div className="flex flex-wrap items-center gap-3 min-h-[48px]">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="repeat-end"
                          checked={form.repeatEndMode === 'on'}
                          onChange={() => set('repeatEndMode', 'on')}
                          className="w-5 h-5 text-purple-700 focus:ring-purple-600"
                        />
                        <span className="text-base sm:text-lg text-slate-900">สิ้นสุดวันที่</span>
                      </label>
                      <input
                        id="ev-repeat-end"
                        type="date"
                        aria-label="วันที่สิ้นสุดการทำซ้ำ"
                        min={form.startDate}
                        disabled={form.repeatEndMode !== 'on'}
                        value={form.repeatEndDate}
                        onChange={(e) => set('repeatEndDate', e.target.value)}
                        className="min-h-[48px] px-4 rounded-full border border-slate-300 bg-white text-base disabled:opacity-50"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-3 min-h-[48px]">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="repeat-end"
                          checked={form.repeatEndMode === 'after'}
                          onChange={() => set('repeatEndMode', 'after')}
                          className="w-5 h-5 text-purple-700 focus:ring-purple-600"
                        />
                        <span className="text-base sm:text-lg text-slate-900">หลังจาก</span>
                      </label>
                      <input
                        id="ev-repeat-count"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        aria-label="จำนวนครั้งที่ทำซ้ำ"
                        disabled={form.repeatEndMode !== 'after'}
                        value={form.repeatCount}
                        onChange={(e) => set('repeatCount', e.target.value)}
                        className="w-24 min-h-[48px] px-4 rounded-full border border-slate-300 bg-white text-base disabled:opacity-50"
                      />
                      <span className="text-base sm:text-lg text-slate-900">ครั้ง</span>
                    </div>
                  </div>
                  {errors['ev-repeat-count'] && (
                    <p role="alert" className="text-base font-semibold text-red-700">
                      {errors['ev-repeat-count']}
                    </p>
                  )}
                </FieldGroup>
              </div>
            )}

            {/* สถานที่ */}
            <SwitchRow
              label="สถานที่"
              description="บอกว่าต้องไปที่ไหน"
              checked={form.locationOn}
              onChange={(v) => set('locationOn', v)}
            />
            {form.locationOn && (
              <div className="pb-3 space-y-5">
                <TextField
                  id="ev-loc-name"
                  label="ชื่อสถานที่"
                  autoComplete="off"
                  placeholder="เช่น โรงพยาบาลประจำอำเภอ"
                  value={form.location.name}
                  onChange={(e) => setLoc('name', e.target.value)}
                  error={errors['ev-loc-name']}
                />
                <TextField
                  id="ev-loc-a1"
                  label="ที่อยู่ (บรรทัดที่ 1)"
                  autoComplete="off"
                  value={form.location.address1}
                  onChange={(e) => setLoc('address1', e.target.value)}
                />
                <TextField
                  id="ev-loc-a2"
                  label="ที่อยู่ (บรรทัดที่ 2)"
                  labelSuffix="(ไม่บังคับ)"
                  autoComplete="off"
                  value={form.location.address2}
                  onChange={(e) => setLoc('address2', e.target.value)}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <TextField
                    id="ev-loc-country"
                    label="ประเทศ"
                    labelSuffix="(ไม่บังคับ)"
                    autoComplete="off"
                    value={form.location.country}
                    onChange={(e) => setLoc('country', e.target.value)}
                  />
                  <TextField
                    id="ev-loc-state"
                    label="จังหวัด / รัฐ"
                    labelSuffix="(ไม่บังคับ)"
                    autoComplete="off"
                    value={form.location.state}
                    onChange={(e) => setLoc('state', e.target.value)}
                  />
                  <TextField
                    id="ev-loc-city"
                    label="เมือง / อำเภอ"
                    labelSuffix="(ไม่บังคับ)"
                    autoComplete="off"
                    value={form.location.city}
                    onChange={(e) => setLoc('city', e.target.value)}
                  />
                  <TextField
                    id="ev-loc-zip"
                    label="รหัสไปรษณีย์"
                    labelSuffix="(ไม่บังคับ)"
                    inputMode="numeric"
                    autoComplete="off"
                    value={form.location.zip}
                    onChange={(e) => setLoc('zip', e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* มอบหมายสมาชิก / จิตอาสา */}
            <SwitchRow
              label="มอบหมายสมาชิกหรืออาสาสมัคร"
              description="เลือกคนที่ต้องไปด้วย หรือเปิดรับคนมาช่วย"
              checked={form.assignOn}
              onChange={(v) => set('assignOn', v)}
            />
            {form.assignOn && (
              <div className="pb-3 space-y-4">
                <SwitchRow
                  label="ต้องการอาสาสมัคร"
                  description="สมาชิกคนอื่นจะเห็นปุ่ม “ฉันจะทำเอง” เพื่อรับงานนี้"
                  checked={form.needVolunteer}
                  onChange={(v) => set('needVolunteer', v)}
                />
                <FieldGroup label="สมาชิกที่รับผิดชอบ">
                  <ul className="space-y-1">
                    {members.map((member) => (
                      <li key={member.id}>
                        <label className="flex items-center gap-3 min-h-[52px] px-3 rounded-2xl cursor-pointer hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={form.assignees.includes(member.id)}
                            onChange={() => toggleAssignee(member.id)}
                            className="w-6 h-6 rounded-md border-slate-400 text-purple-700 focus:ring-purple-600 focus:ring-offset-0"
                          />
                          <span
                            aria-hidden="true"
                            className="w-9 h-9 rounded-full bg-purple-100 text-purple-800 flex items-center justify-center font-bold"
                          >
                            {member.name.slice(0, 1)}
                          </span>
                          <span className="text-base sm:text-lg text-slate-900">
                            {member.name} <span className="text-sm text-slate-500">· {member.relation}</span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </FieldGroup>
              </div>
            )}
          </Section>

          {/* แนบไฟล์ */}
          <Section>
            <FieldGroup label="แนบไฟล์หรือรูปภาพ" hint="เช่น ใบนัด ผลตรวจ แผนที่ แนบได้หลายไฟล์">
              <AttachmentPicker
                id="ev-files"
                value={form.attachments}
                onChange={(files) => {
                  files.forEach((f) => uploadedIds.current.add(f.id));
                  set('attachments', files);
                }}
                deferDelete
              />
            </FieldGroup>
          </Section>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmClose}
        title="ทิ้งการแก้ไขนี้?"
        message="สิ่งที่คุณกรอกไว้จะหายไป"
        confirmLabel="ทิ้ง"
        onCancel={() => setConfirmClose(false)}
        onConfirm={discard}
      />
    </>
  );
};

/** ฟอร์มสร้าง/แก้ไขกิจกรรมในปฏิทิน */
export const EventFormModal: React.FC<EventFormModalProps> = ({ open, ...rest }) =>
  open ? <FormDialog {...rest} /> : null;
