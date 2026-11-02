import React, { useMemo, useRef, useState } from 'react';
import { CheckCircle2, Link2, Loader2, ScanLine } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { TextField } from '../ui/TextField';
import { TextAreaField } from '../ui/TextAreaField';
import { NativeSelect } from '../ui/NativeSelect';
import { Chip, FieldGroup } from '../ui/ChoiceChips';
import { SwitchRow } from '../settings/SwitchRow';
import { ConfirmDialog } from '../settings/ConfirmDialog';
import { StockBadge } from './StockBadge';
import { PhotoSlot } from './PhotoSlot';
import { DRUGS, drugById, matchDrugInText, searchDrugs, type DrugInfo } from '../../data/drugDb';
import { deleteFiles, saveFile } from '../../lib/fileStore';
import { loadOnboarding, type Attachment } from '../../lib/onboarding';
import { hasScanData, scanMedPhoto, type ScanResult } from '../../lib/medScan';
import {
  FORM_OPTIONS,
  MEAL_OPTIONS,
  PERIODS,
  PERIOD_LABEL,
  UNIT_OPTIONS,
  WEEKDAY_SHORT,
  formatQty,
  todayKey,
  type DosePeriod,
  type MealTiming,
  type MedForm,
  type Medication,
} from '../../lib/meds';
import { cn } from '../../lib/cn';

export type MedFormData = Omit<Medication, 'id' | 'createdAt' | 'refillRequestedAt' | 'stoppedAt'>;

interface MedFormModalProps {
  open: boolean;
  /** null = เพิ่มยาใหม่ */
  initial: Medication | null;
  defaultLowStockDays: number;
  onSave: (data: MedFormData) => void;
  onClose: () => void;
}

interface FormState {
  name: string;
  form: MedForm;
  customForm: string;
  drugRef: string;
  condition: string;
  perDose: string;
  unit: string;
  periods: DosePeriod[];
  times: Partial<Record<DosePeriod, string>>;
  meal: MealTiming;
  everyDay: boolean;
  weekdays: number[];
  startDate: string;
  fixedDays: boolean;
  durationDays: string;
  active: boolean;
  remaining: string;
  lowStockDays: string;
  lastRefillDate: string;
  refillsRemaining: string;
  reason: string;
  note: string;
  pillPhoto: Attachment | null;
  labelPhoto: Attachment | null;
}

const unitFor = (form: MedForm) => FORM_OPTIONS.find((f) => f.value === form)?.unit ?? 'เม็ด';

const fromMed = (m: Medication | null, lowDays: number): FormState => ({
  name: m?.name ?? '',
  form: m?.form ?? 'tablet',
  customForm: m?.customForm ?? '',
  drugRef: m?.drugRef ?? '',
  condition: m?.condition ?? '',
  perDose: m ? formatQty(m.perDose) : '1',
  unit: m?.unit ?? 'เม็ด',
  periods: m?.periods ?? ['morning'],
  times: m?.times ?? {},
  meal: m?.meal ?? 'after',
  everyDay: !m || m.weekdays.length === 0 || m.weekdays.length === 7,
  weekdays: m && m.weekdays.length > 0 ? m.weekdays : [0, 1, 2, 3, 4, 5, 6],
  startDate: m?.startDate ?? todayKey(),
  fixedDays: !!m?.durationDays,
  durationDays: m?.durationDays ? String(m.durationDays) : '7',
  active: m?.active ?? true,
  remaining: m ? formatQty(m.remaining) : '',
  lowStockDays: String(m?.lowStockDays ?? lowDays),
  lastRefillDate: m?.lastRefillDate ?? '',
  refillsRemaining: m?.refillsRemaining != null ? String(m.refillsRemaining) : '',
  reason: m?.reason ?? '',
  note: m?.note ?? '',
  pillPhoto: m?.pillPhoto ?? null,
  labelPhoto: m?.labelPhoto ?? null,
});

const SectionBox: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section aria-label={title} className="rounded-2xl border border-slate-200 p-4 sm:p-5">
    <h3 className="text-lg font-bold text-purple-800 mb-4">{title}</h3>
    <div className="space-y-5">{children}</div>
  </section>
);

const toNumber = (s: string) => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
};

const DRUG_OPTIONS = [
  { value: '', label: '— ไม่เชื่อม —' },
  ...DRUGS.map((d) => ({ value: d.id, label: `${d.generic} (${d.thai})` })),
];

/** ผลการอ่านรูปซองยา: แสดงสิ่งที่อ่านได้ให้ตรวจก่อนกด “ใช้ข้อมูลนี้” */
const ScanResultCard: React.FC<{ result: ScanResult; onApply: () => void; onDismiss: () => void }> = ({
  result,
  onApply,
  onDismiss,
}) => {
  const rows: [string, string][] = [];
  if (result.name) rows.push(['ชื่อยา', result.name]);
  if (result.perDose) rows.push(['ครั้งละ', `${formatQty(result.perDose)} ${result.unit ?? ''}`]);
  else if (result.unit) rows.push(['หน่วย', result.unit]);
  if (result.periods?.length) rows.push(['เวลา', result.periods.map((p) => PERIOD_LABEL[p]).join(' · ')]);
  if (result.meal) rows.push(['อาหาร', MEAL_OPTIONS.find((o) => o.value === result.meal)?.label ?? '']);
  if (result.quantity) rows.push(['จำนวนในซอง', String(result.quantity)]);
  const found = hasScanData(result);

  return (
    <div className="rounded-2xl border border-purple-200 bg-purple-50 p-4">
      <p className="flex items-center gap-2 text-base font-bold text-purple-900">
        <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
        {found ? 'อ่านจากรูปได้ดังนี้ ตรวจให้ถูกก่อนใช้' : 'อ่านข้อมูลยาจากรูปไม่ได้'}
      </p>
      {found ? (
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-base">
          {rows.map(([k, v]) => (
            <React.Fragment key={k}>
              <dt className="text-slate-600">{k}</dt>
              <dd className="font-semibold text-slate-900 break-words">{v}</dd>
            </React.Fragment>
          ))}
        </dl>
      ) : (
        <p className="mt-2 text-sm text-slate-700">
          ลองถ่ายใหม่ให้ตัวหนังสือชัด ไม่เอียง แสงพอ หรือกรอกเองด้านล่าง รูปถูกเก็บไว้เป็น “รูปฉลากยา” แล้ว
        </p>
      )}
      {result.rawText.trim() && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-semibold text-purple-800">ดูข้อความที่อ่านได้ทั้งหมด</summary>
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-xl bg-white p-3 text-sm text-slate-700">
            {result.rawText.trim()}
          </pre>
        </details>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {found && (
          <Button type="button" size="sm" onClick={onApply}>
            ใช้ข้อมูลนี้
          </Button>
        )}
        <Button type="button" size="sm" variant="neutral" onClick={onDismiss}>
          {found ? 'ไม่ใช้' : 'ปิด'}
        </Button>
      </div>
    </div>
  );
};

const FormDialog: React.FC<Omit<MedFormModalProps, 'open'>> = ({ initial, defaultLowStockDays, onSave, onClose }) => {
  const [form, setForm] = useState<FormState>(() => fromMed(initial, defaultLowStockDays));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmClose, setConfirmClose] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [scan, setScan] = useState<
    { state: 'idle' } | { state: 'reading'; progress: number } | { state: 'done'; result: ScanResult } | { state: 'error' }
  >({ state: 'idle' });
  const scanInputRef = useRef<HTMLInputElement>(null);
  const snapshot = useRef(JSON.stringify(form));
  const originalIds = useRef(new Set([initial?.pillPhoto?.id, initial?.labelPhoto?.id].filter(Boolean) as string[]));
  const uploadedIds = useRef(new Set<string>());
  const myConditions = useMemo(() => loadOnboarding().profile.conditions, []);

  const dirty = JSON.stringify(form) !== snapshot.current;

  /** ปิดโดยไม่บันทึก: ลบรูปที่เพิ่งอัปโหลดรอบนี้ */
  const discard = () => {
    const stray = [...uploadedIds.current].filter((id) => !originalIds.current.has(id));
    void deleteFiles(stray.map((id) => ({ id, name: '', type: '', size: 0 })));
    onClose();
  };
  const requestClose = () => (dirty ? setConfirmClose(true) : discard());

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors({});
  };

  const setPhoto = (key: 'pillPhoto' | 'labelPhoto', value: Attachment | null) => {
    if (value) uploadedIds.current.add(value.id);
    set(key, value);
  };

  const changeForm = (next: MedForm) =>
    setForm((prev) => ({
      ...prev,
      form: next,
      // เปลี่ยนหน่วยตามรูปแบบยา ถ้าผู้ใช้ยังไม่ได้เปลี่ยนหน่วยเอง
      unit: prev.unit === unitFor(prev.form) ? unitFor(next) : prev.unit,
    }));

  const pickDrug = (drug: DrugInfo) => {
    setForm((prev) => ({
      ...prev,
      name: prev.name && matchDrugInText(prev.name)?.id === drug.id ? prev.name : drug.generic,
      drugRef: drug.id,
      form: drug.form,
      unit: prev.unit === unitFor(prev.form) ? unitFor(drug.form) : prev.unit,
      meal: drug.meal ?? prev.meal,
    }));
    setNameFocused(false);
  };

  const togglePeriod = (p: DosePeriod) =>
    set('periods', form.periods.includes(p) ? form.periods.filter((x) => x !== p) : [...form.periods, p]);

  const toggleWeekday = (d: number) =>
    set('weekdays', form.weekdays.includes(d) ? form.weekdays.filter((x) => x !== d) : [...form.weekdays, d]);

  // ----- ถ่ายรูปซองยา: เก็บเป็นรูปฉลาก แล้วอ่านข้อมูลอัตโนมัติ -----
  const handleScanFile = async (file: File | undefined) => {
    if (scanInputRef.current) scanInputRef.current.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    setScan({ state: 'reading', progress: 0 });
    try {
      const saved = await saveFile(file);
      setPhoto('labelPhoto', saved);
    } catch {
      // เก็บรูปไม่ได้ก็ยังอ่านข้อมูลต่อได้
    }
    try {
      const result = await scanMedPhoto(file, (progress) => setScan({ state: 'reading', progress }));
      setScan({ state: 'done', result });
    } catch {
      setScan({ state: 'error' });
    }
  };

  const applyScan = (r: ScanResult) => {
    setForm((prev) => ({
      ...prev,
      name: r.name ?? prev.name,
      drugRef: r.drug?.id ?? prev.drugRef,
      form: r.drug?.form ?? prev.form,
      perDose: r.perDose ? formatQty(r.perDose) : prev.perDose,
      unit: r.unit ?? prev.unit,
      periods: r.periods?.length ? r.periods : prev.periods,
      meal: r.meal ?? prev.meal,
      remaining: r.quantity ? String(r.quantity) : prev.remaining,
    }));
    setScan({ state: 'idle' });
  };

  const suggestions = nameFocused ? searchDrugs(form.name).filter((d) => d.id !== form.drugRef) : [];
  const linked = form.drugRef ? drugById(form.drugRef) : undefined;
  const autoMatch = !form.drugRef ? matchDrugInText(form.name) : undefined;

  const perDose = toNumber(form.perDose);
  const remaining = toNumber(form.remaining);
  const lowDays = toNumber(form.lowStockDays);
  const weekdays = form.everyDay ? [] : [...form.weekdays].sort((a, b) => a - b);

  const submit = () => {
    const found: Record<string, string> = {};
    if (!form.name.trim()) found['med-name'] = 'กรอกชื่อยาก่อนนะ';
    if (!(perDose > 0)) found['med-perdose'] = 'กรอกจำนวนต่อครั้งมากกว่า 0';
    if (form.periods.length === 0) found['med-periods'] = 'เลือกช่วงเวลาอย่างน้อย 1 ช่วง';
    if (!form.everyDay && form.weekdays.length === 0) found['med-weekdays'] = 'เลือกวันอย่างน้อย 1 วัน';
    if (!form.startDate) found['med-start'] = 'เลือกวันที่เริ่มใช้ยา';
    if (form.fixedDays && !(toNumber(form.durationDays) >= 1)) found['med-duration'] = 'กรอกจำนวนวันอย่างน้อย 1';
    if (!(remaining >= 0)) found['med-remaining'] = 'กรอกจำนวนยาที่เหลือ (ถ้าหมดแล้วใส่ 0)';
    if (!(lowDays >= 1)) found['med-lowdays'] = 'กรอกอย่างน้อย 1 วัน';
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      document.getElementById(first)?.focus();
      return;
    }

    // รูปที่ถูกแทนที่หรือลบ ให้ลบออกจากเครื่อง
    const finalIds = new Set([form.pillPhoto?.id, form.labelPhoto?.id].filter(Boolean) as string[]);
    const dropped = [...originalIds.current, ...uploadedIds.current].filter((id) => !finalIds.has(id));
    void deleteFiles(dropped.map((id) => ({ id, name: '', type: '', size: 0 })));

    const periods = PERIODS.map((p) => p.value).filter((p) => form.periods.includes(p));
    const times: Partial<Record<DosePeriod, string>> = {};
    for (const p of periods) if (form.times[p]) times[p] = form.times[p];
    const refills = parseInt(form.refillsRemaining, 10);

    onSave({
      name: form.name.trim(),
      form: form.form,
      customForm: form.form === 'other' ? form.customForm.trim() : undefined,
      drugRef: form.drugRef || autoMatch?.id || '',
      condition: form.condition.trim(),
      perDose,
      unit: form.unit,
      periods,
      times,
      meal: form.meal,
      weekdays,
      startDate: form.startDate,
      durationDays: form.fixedDays ? Math.floor(toNumber(form.durationDays)) : null,
      active: form.active,
      remaining,
      lowStockDays: Math.max(1, Math.floor(lowDays)),
      lastRefillDate: form.lastRefillDate,
      refillsRemaining: Number.isFinite(refills) && refills >= 0 ? refills : null,
      reason: form.reason.trim(),
      note: form.note.trim(),
      pillPhoto: form.pillPhoto,
      labelPhoto: form.labelPhoto,
    });
  };

  const preview =
    perDose > 0 && remaining >= 0 && form.periods.length > 0
      ? { perDose, periods: form.periods, remaining, weekdays, lowStockDays: Math.max(1, Math.floor(lowDays) || 1) }
      : null;

  return (
    <>
      <Modal
        open
        onClose={requestClose}
        title={initial ? 'แก้ไขข้อมูลยา / การดูแล' : 'เพิ่มยา / การดูแล'}
        initialFocusSelector="#med-name"
        footer={
          <div className="grid grid-cols-2 gap-3">
            <Button variant="neutral" fullWidth onClick={requestClose}>
              ยกเลิก
            </Button>
            <Button fullWidth onClick={submit}>
              {initial ? 'บันทึกการแก้ไข' : 'บันทึก'}
            </Button>
          </div>
        }
      >
        <form
          className="py-6 space-y-5"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {/* ถ่ายรูปซองยา */}
          <div className="rounded-2xl border-2 border-dashed border-purple-300 bg-purple-50/60 p-4">
            <input
              ref={scanInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              tabIndex={-1}
              className="sr-only"
              onChange={(e) => void handleScanFile(e.target.files?.[0])}
            />
            {scan.state === 'reading' ? (
              <div className="flex items-center gap-3 text-base font-semibold text-purple-900" aria-live="polite">
                <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
                <span>กำลังอ่านข้อมูลจากรูป… {scan.progress > 0 ? `${scan.progress}%` : ''}</span>
              </div>
            ) : scan.state === 'done' ? (
              <ScanResultCard
                result={scan.result}
                onApply={() => applyScan(scan.result)}
                onDismiss={() => setScan({ state: 'idle' })}
              />
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-base font-bold text-slate-900">ถ่ายรูปซองยา ให้ช่วยกรอกให้</p>
                  <p className="text-sm text-slate-600">
                    ระบบจะอ่านชื่อยา ครั้งละ เวลา และก่อน/หลังอาหารจากฉลาก แล้วให้คุณตรวจก่อนใช้
                  </p>
                  {scan.state === 'error' && (
                    <p role="alert" className="mt-1 text-sm font-semibold text-red-700">
                      อ่านรูปไม่สำเร็จ (ครั้งแรกต้องต่ออินเทอร์เน็ตเพื่อโหลดตัวอ่านภาษาไทย) ลองใหม่หรือกรอกเอง
                    </p>
                  )}
                </div>
                <Button type="button" size="sm" onClick={() => scanInputRef.current?.click()} className="shrink-0">
                  <ScanLine className="w-5 h-5" aria-hidden="true" />
                  <span>ถ่ายรูปซองยา</span>
                </Button>
              </div>
            )}
          </div>

          <SectionBox title="ยาหรือการดูแล">
            <div className="relative">
              <TextField
                id="med-name"
                label="ชื่อยา หรือสิ่งที่ใช้ดูแล"
                hint="พิมพ์ชื่อยา ยาฉีด หรือสิ่งดูแล เช่น Metformin 500 mg หรือ ยาฉีดอินซูลิน"
                autoComplete="off"
                placeholder="เช่น Metformin 500 mg, ยาฉีดอินซูลิน, แผ่นตรวจ"
                value={form.name}
                onFocus={() => setNameFocused(true)}
                onBlur={() => window.setTimeout(() => setNameFocused(false), 150)}
                onChange={(e) => set('name', e.target.value)}
                error={errors['med-name']}
              />
              {suggestions.length > 0 && (
                <ul
                  role="listbox"
                  aria-label="ยาจากฐานข้อมูล"
                  className="absolute left-0 right-0 top-full z-20 mt-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-xl"
                >
                  {suggestions.map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={false}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pickDrug(d)}
                        className="flex w-full flex-col items-start rounded-xl px-3 py-2 text-left hover:bg-purple-50 cursor-pointer"
                      >
                        <span className="text-base font-bold text-slate-900">
                          {d.generic} <span className="font-normal text-slate-600">· {d.thai}</span>
                        </span>
                        <span className="text-sm text-slate-600">{d.purpose}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <FieldGroup label="รูปแบบยา / สิ่งที่ใช้ดูแล">
              <div className="flex flex-wrap gap-2">
                {FORM_OPTIONS.map((o) => (
                  <Chip key={o.value} selected={form.form === o.value} onClick={() => changeForm(o.value)}>
                    {o.label}
                  </Chip>
                ))}
              </div>

              {/* เมื่อกด "อื่น ๆ" จะมีช่องข้อความให้ใส่ */}
              {form.form === 'other' && (
                <div className="mt-3 animate-in fade-in slide-in-from-top-1 duration-150">
                  <TextField
                    id="med-custom-form"
                    name="custom-form"
                    label="ระบุรูปแบบหรือวิธีใช้อื่น ๆ"
                    placeholder="เช่น แผ่นแปะผิวหนัง, ยาฉีดอินซูลินใต้ผิวหนัง, อาหารทางการแพทย์"
                    value={form.customForm}
                    onChange={(e) => setForm((prev) => ({ ...prev, customForm: e.target.value }))}
                    autoFocus
                  />
                </div>
              )}
            </FieldGroup>

            <div className="space-y-2">
              <TextField
                id="med-condition"
                label="โรคที่เกี่ยวข้อง"
                labelSuffix="(ไม่บังคับ)"
                autoComplete="off"
                placeholder="เช่น ความดันโลหิตสูง"
                value={form.condition}
                onChange={(e) => set('condition', e.target.value)}
              />
              {myConditions.length > 0 && (
                <div className="flex flex-wrap gap-2" aria-label="โรคประจำตัวของคุณ">
                  {myConditions.slice(0, 6).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => set('condition', c)}
                      className={cn(
                        'min-h-[40px] px-3 rounded-full border text-sm font-semibold cursor-pointer',
                        form.condition === c
                          ? 'bg-purple-700 border-purple-700 text-white'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-purple-50'
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <NativeSelect
                id="med-drugref"
                label="เชื่อมกับฐานข้อมูลยา"
                labelSuffix="(ไม่บังคับ)"
                hint="ช่วยแสดงข้อมูลยาและข้อควรระวัง และสั่งเติมยาได้ง่ายขึ้น"
                options={DRUG_OPTIONS}
                value={form.drugRef}
                onChange={(v) => set('drugRef', v)}
              />
              {linked ? (
                <p className="flex items-start gap-2 text-sm text-slate-700">
                  <Link2 className="w-4 h-4 mt-0.5 shrink-0 text-purple-700" aria-hidden="true" />
                  <span>
                    {linked.thai}: {linked.purpose}
                  </span>
                </p>
              ) : (
                autoMatch && (
                  <button
                    type="button"
                    onClick={() => pickDrug(autoMatch)}
                    className="inline-flex items-center gap-2 min-h-[40px] px-3 rounded-full border border-purple-300 bg-purple-50 text-sm font-semibold text-purple-900 hover:bg-purple-100 cursor-pointer"
                  >
                    <Link2 className="w-4 h-4" aria-hidden="true" />
                    ตรงกับ {autoMatch.generic} · กดเพื่อเชื่อม
                  </button>
                )
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <PhotoSlot
                id="med-pill-photo"
                label="รูปเม็ดยา"
                emptyText="กดเพื่อถ่าย/เลือกรูปเม็ดยา"
                value={form.pillPhoto}
                onChange={(v) => setPhoto('pillPhoto', v)}
              />
              <PhotoSlot
                id="med-label-photo"
                label="รูปฉลาก/ซองยา"
                emptyText="กดเพื่อถ่าย/เลือกรูปฉลากยา"
                value={form.labelPhoto}
                onChange={(v) => setPhoto('labelPhoto', v)}
              />
            </div>
          </SectionBox>

          <SectionBox title="ใช้เมื่อไหร่">
            <div className="grid grid-cols-2 gap-4">
              <TextField
                id="med-perdose"
                label="ครั้งละ"
                inputMode="decimal"
                autoComplete="off"
                value={form.perDose}
                onChange={(e) => set('perDose', e.target.value.replace(/[^\d.]/g, ''))}
                error={errors['med-perdose']}
              />
              <NativeSelect
                id="med-unit"
                label="หน่วย"
                options={UNIT_OPTIONS}
                value={form.unit}
                onChange={(v) => set('unit', v)}
              />
            </div>

            <FieldGroup
              label="เวลาใช้ยา"
              hint="เลือกได้หลายช่วง ใส่เวลาเป๊ะหรือไม่ก็ได้ (ใช้เตือนเมื่อลืมกินยา)"
              error={errors['med-periods']}
            >
              <div id="med-periods" tabIndex={-1} className="space-y-2">
                {PERIODS.map((p) => {
                  const on = form.periods.includes(p.value);
                  return (
                    <div
                      key={p.value}
                      className={cn(
                        'flex flex-wrap items-center justify-between gap-2 min-h-[56px] px-3 py-2 rounded-xl border',
                        on ? 'bg-purple-50 border-purple-400' : 'bg-white border-slate-300'
                      )}
                    >
                      <label className="flex items-center gap-3 cursor-pointer text-base font-semibold text-slate-900">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => togglePeriod(p.value)}
                          className="w-6 h-6 rounded-md border-slate-400 text-purple-700 focus:ring-purple-600"
                        />
                        {p.label}
                      </label>
                      {on && (
                        <input
                          type="time"
                          aria-label={`เวลา${p.label} (ไม่บังคับ)`}
                          value={form.times[p.value] ?? ''}
                          onChange={(e) => set('times', { ...form.times, [p.value]: e.target.value })}
                          className="min-h-[44px] px-3 rounded-full border border-purple-200 bg-white text-base text-purple-900 [color-scheme:light]"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </FieldGroup>

            <FieldGroup label="ก่อน/หลังอาหาร">
              <div className="flex flex-wrap gap-2">
                {MEAL_OPTIONS.map((o) => (
                  <Chip key={o.value} selected={form.meal === o.value} onClick={() => set('meal', o.value)}>
                    {o.label}
                  </Chip>
                ))}
              </div>
            </FieldGroup>

            <FieldGroup label="วันที่ต้องกิน" error={errors['med-weekdays']}>
              <div className="flex flex-wrap gap-2">
                <Chip selected={form.everyDay} onClick={() => set('everyDay', true)}>
                  ทุกวัน
                </Chip>
                <Chip selected={!form.everyDay} onClick={() => set('everyDay', false)}>
                  เลือกวัน
                </Chip>
              </div>
              {!form.everyDay && (
                <div id="med-weekdays" tabIndex={-1} className="mt-3 grid grid-cols-7 gap-1.5">
                  {WEEKDAY_SHORT.map((label, d) => {
                    const on = form.weekdays.includes(d);
                    return (
                      <button
                        key={label}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleWeekday(d)}
                        className={cn(
                          'min-h-[48px] rounded-full text-base font-bold border cursor-pointer',
                          on ? 'bg-amber-400 border-amber-400 text-slate-900' : 'bg-white border-slate-300 text-slate-600'
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </FieldGroup>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextField
                id="med-start"
                type="date"
                label="วันที่เริ่มใช้"
                value={form.startDate}
                onChange={(e) => set('startDate', e.target.value)}
                error={errors['med-start']}
              />
              <FieldGroup label="ระยะเวลาการใช้ยา">
                <div className="flex flex-wrap gap-2">
                  <Chip selected={!form.fixedDays} onClick={() => set('fixedDays', false)}>
                    ใช้ต่อเนื่อง
                  </Chip>
                  <Chip selected={form.fixedDays} onClick={() => set('fixedDays', true)}>
                    กำหนดจำนวนวัน
                  </Chip>
                </div>
              </FieldGroup>
            </div>
            {form.fixedDays && (
              <TextField
                id="med-duration"
                label="ใช้ทั้งหมดกี่วัน"
                hint="เช่น ยาปฏิชีวนะ 7 วัน ครบแล้วจะหายจากตารางเอง"
                inputMode="numeric"
                autoComplete="off"
                value={form.durationDays}
                onChange={(e) => set('durationDays', e.target.value.replace(/\D/g, ''))}
                error={errors['med-duration']}
              />
            )}

            <SwitchRow
              label="กำลังใช้ยานี้อยู่"
              description="ปิดเมื่อหยุดใช้ยา ยาจะไม่ขึ้นในตารางและไม่เตือน แต่ประวัติยังอยู่ในรายงาน"
              checked={form.active}
              onChange={(v) => set('active', v)}
            />
          </SectionBox>

          <SectionBox title="เหลือเท่าไร">
            <div className="grid grid-cols-2 gap-4">
              <TextField
                id="med-remaining"
                label="จำนวนยาคงเหลือ"
                hint="นับจากของจริง"
                inputMode="decimal"
                autoComplete="off"
                placeholder="เช่น 30"
                value={form.remaining}
                onChange={(e) => set('remaining', e.target.value.replace(/[^\d.]/g, ''))}
                error={errors['med-remaining']}
              />
              <TextField
                id="med-lowdays"
                label="เตือนเมื่อเหลือ (วัน)"
                hint="ก่อนยาจะหมด"
                inputMode="numeric"
                autoComplete="off"
                value={form.lowStockDays}
                onChange={(e) => set('lowStockDays', e.target.value.replace(/\D/g, ''))}
                error={errors['med-lowdays']}
              />
            </div>
            <div aria-live="polite" className="min-h-[36px]">
              {preview ? (
                <StockBadge med={preview} />
              ) : (
                <p className="text-sm text-slate-500">กรอกจำนวนที่เหลือ ระบบจะคำนวณว่าพอกินอีกกี่วันให้เอง</p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextField
                id="med-last-refill"
                type="date"
                label="วันที่รับยาล่าสุด"
                labelSuffix="(ไม่บังคับ)"
                value={form.lastRefillDate}
                onChange={(e) => set('lastRefillDate', e.target.value)}
              />
              <TextField
                id="med-refills"
                label="เติมยาได้อีก (ครั้ง)"
                labelSuffix="(ไม่บังคับ)"
                inputMode="numeric"
                autoComplete="off"
                placeholder="ตามใบสั่งแพทย์"
                value={form.refillsRemaining}
                onChange={(e) => set('refillsRemaining', e.target.value.replace(/\D/g, ''))}
              />
            </div>
          </SectionBox>

          <SectionBox title="ข้อมูลเพิ่มเติม">
            <TextField
              id="med-reason"
              label="เหตุผลที่ใช้ยา"
              labelSuffix="(ไม่บังคับ)"
              autoComplete="off"
              placeholder="เช่น หมอให้กินคุมความดัน"
              value={form.reason}
              onChange={(e) => set('reason', e.target.value)}
            />
            <TextAreaField
              id="med-note"
              label="หมายเหตุ"
              labelSuffix="(ไม่บังคับ)"
              rows={2}
              placeholder="เช่น ห้ามดื่มแอลกอฮอล์ ง่วงนอนได้"
              value={form.note}
              onChange={(e) => set('note', e.target.value)}
            />
          </SectionBox>
        </form>
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

/** ฟอร์มเพิ่ม/แก้ไขยา (ละเอียด: รูปแบบ เวลา วัน ระยะเวลา คงเหลือ การเติมยา รูป และถ่ายรูปซองยาให้กรอกอัตโนมัติ) */
export const MedFormModal: React.FC<MedFormModalProps> = ({ open, ...rest }) =>
  open ? <FormDialog {...rest} /> : null;

