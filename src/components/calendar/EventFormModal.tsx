import React, { useRef, useState } from 'react';
import { Bell, Check, Clock, Flag, Info, MapPin, Paperclip, Repeat, ThumbsUp, Users } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { TextField } from '../ui/TextField';
import { TextAreaField } from '../ui/TextAreaField';
import { CheckboxField } from '../ui/CheckboxField';
import { ChipsWithCustom } from '../ui/ChipsWithCustom';
import { FieldGroup } from '../ui/ChoiceChips';
import { AttachmentPicker } from '../ui/AttachmentPicker';
import { PillSelect } from '../ui/SelectField';
import { TimePicker } from '../ui/TimePicker';
import { PillDatePicker } from '../ui/DatePicker';
import { ConfirmDialog } from '../settings/ConfirmDialog';
import { DEFAULT_TIME_ZONE, TIME_ZONE_OPTIONS } from '../../data/timeZones';
import {
  EVENT_TAG_SUGGESTIONS,
  EVENT_TITLE_SUGGESTIONS,
  PLACE_SUGGESTIONS,
} from '../../data/suggestions';
import { deleteFiles } from '../../lib/fileStore';
import type { HouseholdMember } from '../../lib/settings';
import {
  EVENT_COLORS,
  type EventColor,
  REMINDER_OPTIONS,
  REPEAT_UNIT_LABEL,
  defaultRepeat,
  emptyLocation,
  locationLines,
  parseKey,
  repeatLabel,
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
  color: EventColor;
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
    color: ev?.color ?? (ev?.important ? 'rose' : 'amber'),
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
    // รวมชื่อและที่อยู่เดิมเป็นข้อความเดียว (นัดเก่าที่แยกช่องไว้ยังเห็นครบ)
    location: ev?.location
      ? { ...emptyLocation(), country: '', name: [ev.location.name, locationLines(ev.location)].map((t) => t.trim()).filter(Boolean).join(' · ') }
      : emptyLocation(),
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

const REMINDER_SELECT_OPTIONS = [{ value: 'none', label: 'ไม่มี' }, ...REMINDER_OPTIONS];

const repeatEveryOptions = (current: number) => {
  const max = Math.max(30, current);
  return Array.from({ length: max }, (_, i) => ({ value: i + 1, label: String(i + 1) }));
};

const pillBase =
  'min-h-[44px] rounded-full bg-purple-50 text-purple-900 [color-scheme:light] accent-purple-700 text-base font-semibold border border-purple-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 disabled:opacity-50';



const PillInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { id: string; label: string }> = ({
  label,
  className,
  ...props
}) => <input aria-label={label} className={cn(pillBase, 'px-4', className)} {...props} />;

const SwitchTrack: React.FC<{ checked: boolean }> = ({ checked }) => (
  <span
    aria-hidden="true"
    className={cn(
      'relative inline-flex shrink-0 w-[52px] h-[30px] rounded-full transition-colors',
      checked ? 'bg-purple-700' : 'bg-slate-300'
    )}
  >
    <span
      className={cn(
        'absolute top-[3px] left-[3px] w-6 h-6 rounded-full bg-white shadow-sm transition-transform',
        checked && 'translate-x-[22px]'
      )}
    />
  </span>
);

/** หัวข้อพร้อมไอคอน + สวิตช์ทางขวา (ทั้งแถวกดได้) */
const ToggleRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}> = ({ icon, label, checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className="flex w-full items-center justify-between gap-3 min-h-[52px] text-left cursor-pointer rounded-xl"
  >
    <span className="flex items-center gap-3 min-w-0">
      {icon}
      <span className="text-base sm:text-lg font-bold text-slate-900 break-words">{label}</span>
    </span>
    <SwitchTrack checked={checked} />
  </button>
);

const Heading: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
  <div className="flex items-center gap-3 min-h-[44px]">
    {icon}
    <h3 className="text-base sm:text-lg font-bold text-slate-900">{children}</h3>
  </div>
);

const iconClass = 'w-6 h-6 shrink-0 text-purple-600';

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
      if (form.repeatEndMode === 'after' && !(Number(form.repeatCount) >= 1))
        next['ev-repeat-count'] = 'กรอกจำนวนครั้งอย่างน้อย 1';
      if (form.repeatEndMode === 'on' && (!form.repeatEndDate || form.repeatEndDate < form.startDate)) {
        next['ev-repeat-end'] = 'วันสิ้นสุดต้องไม่ก่อนวันเริ่ม';
      }
    }

    if (form.locationOn && !form.location.name.trim()) {
      next['ev-loc-name'] = 'บอกสถานที่หรือที่อยู่สักหน่อย';
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
      color: form.color,
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
            every: Math.max(1, Math.floor(Number(form.repeatEvery)) || 1),
            unit: form.repeatUnit,
            endMode: form.repeatEndMode,
            endDate: form.repeatEndDate,
            count: Math.max(1, Math.floor(Number(form.repeatCount) || 1)),
          }
        : null,
      location: form.locationOn ? { ...form.location, name: form.location.name.trim(), country: '' } : null,
      assignees: form.assignOn ? form.assignees : [],
      needVolunteer: form.assignOn ? form.needVolunteer : false,
      attachments: form.attachments,
    });
  };

  const repeatSummary = form.repeatOn
    ? repeatLabel({
        every: Math.max(1, Math.floor(Number(form.repeatEvery)) || 1),
        unit: form.repeatUnit,
        endMode: form.repeatEndMode,
        endDate: form.repeatEndDate,
        count: Math.max(1, Math.floor(Number(form.repeatCount)) || 1),
      })
    : '';

  const dateLong = (key: string) =>
    key ? parseKey(key).toLocaleDateString('th-TH', { dateStyle: 'long' }) : '-';

  return (
    <>
      <Modal
        open
        onClose={requestClose}
        title={initial ? 'แก้ไขกิจกรรม' : 'สร้างกิจกรรม'}
        initialFocusSelector="#ev-title"
        footer={
          <div className="flex justify-end">
            <Button type="button" onClick={submit}>
              {initial ? 'บันทึกการแก้ไข' : 'สร้างกิจกรรม'}
            </Button>
          </div>
        }
      >
        <div className="py-6 space-y-6">
          {/* ชื่อ / คำอธิบาย */}
          <div className="space-y-5">
            <TextField
              id="ev-title"
              suggestions={EVENT_TITLE_SUGGESTIONS}
              label="ชื่อกิจกรรม"
              autoComplete="off"
              placeholder="ใส่ชื่อกิจกรรม"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              error={errors['ev-title']}
            />
            <TextAreaField
              id="ev-desc"
              label="คำอธิบาย"
              labelSuffix="(ไม่บังคับ)"
              rows={2}
              placeholder="ใส่คำอธิบาย"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>

          <hr className="border-slate-200" />

          {/* เลือกสีแถบกิจกรรม */}
          <div className="space-y-2.5">
            <span className="block text-base font-bold text-slate-900">
              สีแถบกิจกรรม
            </span>
            <div className="flex flex-wrap items-center gap-2.5">
              {EVENT_COLORS.map((c) => {
                const active = form.color === c.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => set('color', c.key)}
                    title={c.label}
                    aria-label={c.label}
                    aria-pressed={active}
                    className={cn(
                      'group relative flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full transition duration-150 cursor-pointer',
                      c.swatchBg,
                      active
                        ? 'scale-110 ring-4 ring-purple-600 ring-offset-2 shadow-md'
                        : 'hover:scale-105 hover:shadow-xs active:scale-95'
                    )}
                  >
                    {active && <Check className="w-5 h-5 text-white drop-shadow-xs" strokeWidth={3} aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* สำคัญ + แท็ก */}
          <div className="space-y-3">
            <ToggleRow
              icon={<Flag className="w-6 h-6 shrink-0 text-red-600 fill-red-600" aria-hidden="true" />}
              label="สำคัญ"
              checked={form.important}
              onChange={(v) => set('important', v)}
            />
            <ChipsWithCustom
              id="ev-tags"
              suggestions={EVENT_TAG_SUGGESTIONS}
              label="แท็ก (ไม่บังคับ)"
              options={[]}
              value={form.tags}
              onChange={(v) => set('tags', v)}
              customPlaceholder="เพิ่มแท็ก"
            />
          </div>

          {/* วันและเวลา */}
          <div className="space-y-3">
            <Heading icon={<Clock className={iconClass} aria-hidden="true" />}>เลือกวันและเวลา</Heading>
            <div className="space-y-3 pl-1 sm:pl-9">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="w-16 text-base text-slate-700">เริ่ม</span>
                <PillDatePicker
                  id="ev-start-date"
                  ariaLabel="วันที่เริ่ม"
                  value={form.startDate}
                  onChange={(value) => {
                    setForm((prev) => ({
                      ...prev,
                      startDate: value,
                      endDate: prev.endDate < value ? value : prev.endDate,
                    }));
                    setErrors({});
                  }}
                />
                {!form.allDay && (
                  <TimePicker
                    id="ev-start-time"
                    ariaLabel="เวลาเริ่ม"
                    variant="pill"
                    value={form.startTime}
                    onChange={(val) => set('startTime', val)}
                  />
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="w-16 text-base text-slate-700">สิ้นสุด</span>
                <PillDatePicker
                  id="ev-end-date"
                  ariaLabel="วันที่สิ้นสุด"
                  min={form.startDate}
                  value={form.endDate}
                  onChange={(val) => set('endDate', val)}
                />
                {!form.allDay && (
                  <TimePicker
                    id="ev-end-time"
                    ariaLabel="เวลาสิ้นสุด"
                    variant="pill"
                    value={form.endTime}
                    onChange={(val) => set('endTime', val)}
                  />
                )}
              </div>
              {(errors['ev-start-date'] || errors['ev-end-date']) && (
                <p role="alert" className="text-base font-semibold text-red-700">
                  {errors['ev-start-date'] || errors['ev-end-date']}
                </p>
              )}
              <CheckboxField id="ev-allday" checked={form.allDay} onChange={(v) => set('allDay', v)}>
                ทั้งวัน
              </CheckboxField>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 min-h-[48px]">
              <span className="text-base font-bold text-slate-900">เขตเวลา</span>
              <PillSelect
                id="ev-timezone"
                label="เขตเวลา"
                options={TIME_ZONE_OPTIONS}
                value={form.timeZone}
                onChange={(v) => set('timeZone', v)}
              />
            </div>
          </div>

          {/* แจ้งเตือน */}
          <div className="flex items-center justify-between gap-3 min-h-[52px]">
            <Heading icon={<Bell className={iconClass} aria-hidden="true" />}>ส่งการแจ้งเตือน</Heading>
            <PillSelect
              id="ev-reminder"
              label="เตือนเมื่อไหร่"
              options={REMINDER_SELECT_OPTIONS}
              value={form.reminderOn ? form.reminderMinutes : 'none'}
              onChange={(v) =>
                setForm((prev) =>
                  v === 'none'
                    ? { ...prev, reminderOn: false }
                    : { ...prev, reminderOn: true, reminderMinutes: Number(v) }
                )
              }
            />
          </div>

          {/* ทำซ้ำ */}
          <div className="space-y-3">
            <ToggleRow
              icon={<Repeat className={iconClass} aria-hidden="true" />}
              label="ทำซ้ำกิจกรรม"
              checked={form.repeatOn}
              onChange={(v) => set('repeatOn', v)}
            />
            {form.repeatOn && (
              <div className="space-y-4 pl-1 sm:pl-9">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-base text-slate-700">ทำซ้ำทุก</span>
                  <div className="flex items-center gap-2">
                    <PillSelect
                      id="ev-repeat-every"
                      label="ทำซ้ำทุกกี่หน่วย"
                      options={repeatEveryOptions(Number(form.repeatEvery) || 1)}
                      value={Number(form.repeatEvery) || 1}
                      onChange={(v) => set('repeatEvery', v)}
                    />
                    <PillSelect
                      id="ev-repeat-unit"
                      label="หน่วยของการทำซ้ำ"
                      options={REPEAT_UNIT_OPTIONS}
                      value={form.repeatUnit}
                      onChange={(v) => set('repeatUnit', v as RepeatUnit)}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-base text-slate-700">เริ่มวันที่</span>
                  <span className="text-base font-bold text-slate-900">{dateLong(form.startDate)}</span>
                </div>

                <FieldGroup label="สิ้นสุด" error={errors['ev-repeat-end']}>
                  <div className="space-y-1">
                    <label className="flex items-center gap-3 min-h-[48px] cursor-pointer">
                      <input
                        type="radio"
                        name="repeat-end"
                        checked={form.repeatEndMode === 'never'}
                        onChange={() => set('repeatEndMode', 'never')}
                        className="w-5 h-5 text-purple-700 focus:ring-purple-600"
                      />
                      <span className="text-base text-slate-900">ไม่สิ้นสุด</span>
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
                        <span className="text-base text-slate-900">ในวันที่</span>
                      </label>
                      {form.repeatEndMode === 'on' && (
                        <PillDatePicker
                          id="ev-repeat-end"
                          ariaLabel="วันที่สิ้นสุดการทำซ้ำ"
                          min={form.startDate}
                          value={form.repeatEndDate}
                          onChange={(val) => set('repeatEndDate', val)}
                        />
                      )}
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
                        <span className="text-base text-slate-900">หลังจาก</span>
                      </label>
                      {form.repeatEndMode === 'after' && (
                        <>
                          <PillInput
                            id="ev-repeat-count"
                            type="number"
                            inputMode="numeric"
                            min={1}
                            label="จำนวนครั้งที่ทำซ้ำ"
                            className="w-24"
                            value={form.repeatCount}
                            onChange={(e) => set('repeatCount', e.target.value)}
                          />
                          <span className="text-base text-slate-900">ครั้ง</span>
                        </>
                      )}
                    </div>
                  </div>
                  {errors['ev-repeat-count'] && (
                    <p role="alert" className="text-base font-semibold text-red-700">
                      {errors['ev-repeat-count']}
                    </p>
                  )}
                </FieldGroup>

                <div className="flex items-center gap-3 rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-base text-slate-800">
                  <Info className="w-5 h-5 shrink-0 text-slate-600" aria-hidden="true" />
                  <span>{repeatSummary}</span>
                </div>
              </div>
            )}
          </div>

          {/* สถานที่ */}
          <div className="space-y-3">
            <ToggleRow
              icon={<MapPin className={iconClass} aria-hidden="true" />}
              label="สถานที่"
              checked={form.locationOn}
              onChange={(v) => set('locationOn', v)}
            />
            {form.locationOn && (
              <TextField
                id="ev-loc-name"
                suggestions={PLACE_SUGGESTIONS}
                label="สถานที่ / ที่อยู่"
                hint="พิมพ์ชื่อสถานที่หรือที่อยู่ที่เดียวได้เลย เช่น โรงพยาบาลศิริราช"
                autoComplete="off"
                placeholder="เช่น โรงพยาบาลศิริราช หรือ บ้านคุณยาย"
                value={form.location.name}
                onChange={(e) => setLoc('name', e.target.value)}
                error={errors['ev-loc-name']}
              />
            )}
          </div>

          {/* มอบหมายสมาชิก / อาสาสมัคร */}
          <div className="space-y-3">
            <ToggleRow
              icon={<Users className={iconClass} aria-hidden="true" />}
              label="มอบหมายสมาชิกหรืออาสาสมัคร"
              checked={form.assignOn}
              onChange={(v) => set('assignOn', v)}
            />
            {form.assignOn && (
              <div className="space-y-2 pl-1 sm:pl-9">
                <div className="flex items-center justify-between gap-3 text-base text-slate-700">
                  <span>รับความช่วยเหลือที่คุณต้องการ:</span>
                  <span className="shrink-0 text-slate-500">เลือกแล้ว {form.assignees.length} คน</span>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={form.needVolunteer}
                  onClick={() => set('needVolunteer', !form.needVolunteer)}
                  className="flex w-full items-center justify-between gap-3 min-h-[56px] text-left cursor-pointer rounded-xl"
                >
                  <span className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="w-10 h-10 rounded-full bg-emerald-400 text-white flex items-center justify-center"
                    >
                      <ThumbsUp className="w-5 h-5 fill-current" />
                    </span>
                    <span className="text-base text-slate-900">ต้องการอาสาสมัคร</span>
                  </span>
                  <SwitchTrack checked={form.needVolunteer} />
                </button>

                <ul>
                  {members.map((member) => (
                    <li key={member.id}>
                      <label className="flex items-center justify-between gap-3 min-h-[56px] cursor-pointer">
                        <span className="flex items-center gap-3 min-w-0">
                          <span
                            aria-hidden="true"
                            className="w-10 h-10 shrink-0 rounded-full bg-purple-100 text-purple-800 flex items-center justify-center font-bold"
                          >
                            {member.name.slice(0, 1)}
                          </span>
                          <span className="text-base text-slate-900 break-words">
                            {member.name} <span className="text-sm text-slate-500">· {member.relation}</span>
                          </span>
                        </span>
                        <input
                          type="checkbox"
                          checked={form.assignees.includes(member.id)}
                          onChange={() => toggleAssignee(member.id)}
                          className="w-6 h-6 shrink-0 rounded-md border-slate-400 text-purple-700 focus:ring-purple-600 focus:ring-offset-0"
                        />
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* แนบไฟล์ */}
          <div className="space-y-3">
            <Heading icon={<Paperclip className={iconClass} aria-hidden="true" />}>
              แนบไฟล์ ({form.attachments.length})
            </Heading>
            <AttachmentPicker
              id="ev-files"
              variant="box"
              title="คลิกเพื่ออัปโหลด"
              value={form.attachments}
              onChange={(files) => {
                files.forEach((f) => uploadedIds.current.add(f.id));
                set('attachments', files);
              }}
              deferDelete
            />
          </div>
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
