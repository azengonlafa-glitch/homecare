import React, { useRef, useState } from 'react';
import { BarChart3, UserPen } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { TextField } from '../components/ui/TextField';
import { useToast } from '../components/ui/Toast';
import { StepBody, StepPersonal } from '../components/onboarding/PersonalSteps';
import { StepAllergies, StepConditions, StepFamily } from '../components/onboarding/HealthSteps';
import { StepContact } from '../components/onboarding/ContactConsentSteps';
import { HealthAnalysis } from '../components/health/HealthAnalysis';
import type { StepProps } from '../components/onboarding/stepTypes';
import { STEPS } from '../data/onboardingOptions';
import { loadOnboarding, saveOnboarding, validateStep, type OnboardingProfile } from '../lib/onboarding';
import { cn } from '../lib/cn';

type Mode = 'edit' | 'analysis';

const digits = (v: string) => v.replace(/[^\d.]/g, '');

/** ค่าตรวจล่าสุด (ไม่บังคับ) ใช้ในโหมดวิเคราะห์ */
const VitalsFields: React.FC<StepProps> = ({ profile, update, errors, clearError }) => (
  <div className="space-y-5">
    <p className="text-base text-slate-600">กรอกจากผลตรวจหรือเครื่องวัดล่าสุด ไม่บังคับ ยิ่งมีข้อมูลยิ่งวิเคราะห์ได้แม่น</p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      <TextField
        id="hp-systolic"
        label="ความดันตัวบน (mmHg)"
        inputMode="numeric"
        autoComplete="off"
        placeholder="เช่น 120"
        value={profile.systolic}
        onChange={(e) => {
          update({ systolic: digits(e.target.value) });
          clearError('hp-systolic');
        }}
        error={errors['hp-systolic']}
      />
      <TextField
        id="hp-diastolic"
        label="ความดันตัวล่าง (mmHg)"
        inputMode="numeric"
        autoComplete="off"
        placeholder="เช่น 80"
        value={profile.diastolic}
        onChange={(e) => {
          update({ diastolic: digits(e.target.value) });
          clearError('hp-diastolic');
        }}
        error={errors['hp-diastolic']}
      />
    </div>
    <TextField
      id="hp-glucose"
      label="น้ำตาลในเลือดตอนอดอาหาร (มก./ดล.)"
      inputMode="decimal"
      autoComplete="off"
      placeholder="เช่น 90"
      value={profile.fastingGlucose}
      onChange={(e) => {
        update({ fastingGlucose: digits(e.target.value) });
        clearError('hp-glucose');
      }}
      error={errors['hp-glucose']}
    />
  </div>
);

const validateVitals = (p: OnboardingProfile) => {
  const found: Record<string, string> = {};
  const sys = p.systolic ? Number(p.systolic) : null;
  const dia = p.diastolic ? Number(p.diastolic) : null;
  if (sys !== null && !(sys >= 60 && sys <= 260)) found['hp-systolic'] = 'ความดันตัวบนควรอยู่ระหว่าง 60–260';
  if (dia !== null && !(dia >= 30 && dia <= 160)) found['hp-diastolic'] = 'ความดันตัวล่างควรอยู่ระหว่าง 30–160';
  if (sys !== null && dia !== null && !found['hp-systolic'] && !found['hp-diastolic'] && dia >= sys) {
    found['hp-diastolic'] = 'ความดันตัวล่างต้องน้อยกว่าตัวบน';
  }
  if (p.fastingGlucose) {
    const g = Number(p.fastingGlucose);
    if (!(g >= 30 && g <= 600)) found['hp-glucose'] = 'น้ำตาลควรอยู่ระหว่าง 30–600';
  }
  return found;
};

const SECTIONS: { title: string; subtitle: string; Component: React.FC<StepProps> }[] = [
  { ...STEPS[0], Component: StepPersonal },
  { ...STEPS[1], Component: StepBody },
  { title: 'ค่าสุขภาพล่าสุด', subtitle: 'ความดันและน้ำตาลในเลือด', Component: VitalsFields },
  { ...STEPS[2], Component: StepAllergies },
  { ...STEPS[3], Component: StepConditions },
  { ...STEPS[4], Component: StepFamily },
  { ...STEPS[5], Component: StepContact },
];

const TABS: { mode: Mode; label: string; icon: React.ReactNode }[] = [
  { mode: 'edit', label: 'ข้อมูลของฉัน', icon: <UserPen className="w-5 h-5" aria-hidden="true" /> },
  { mode: 'analysis', label: 'วิเคราะห์สุขภาพ', icon: <BarChart3 className="w-5 h-5" aria-hidden="true" /> },
];

/** ข้อมูลสุขภาพส่วนตัว: แก้ไขและบันทึกได้ + โหมดกราฟวิเคราะห์เทียบกับคนสุขภาพดี */
export const HealthProfilePage: React.FC = () => {
  const toast = useToast();
  const [saved, setSaved] = useState(loadOnboarding);
  const [profile, setProfile] = useState<OnboardingProfile>(saved.profile);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<Mode>('edit');
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const dirty = JSON.stringify(profile) !== JSON.stringify(saved.profile);

  const update = (patch: Partial<OnboardingProfile>) => setProfile((prev) => ({ ...prev, ...patch }));
  const clearError = (id: string) => {
    if (errors[id]) setErrors((prev) => ({ ...prev, [id]: '' }));
  };

  const handleCancel = () => {
    setProfile(saved.profile);
    setErrors({});
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const found = {
      ...validateStep(0, profile),
      ...validateStep(1, profile),
      ...validateStep(5, profile),
      ...validateVitals(profile),
    };
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      document.getElementById(first)?.focus();
      return;
    }
    const next = { ...saved, profile };
    saveOnboarding(next);
    setSaved(next);
    toast.show('บันทึกข้อมูลสุขภาพแล้ว');
  };

  const onTabKey = (e: React.KeyboardEvent, index: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const next = (index + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
    setMode(TABS[next].mode);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader title="ข้อมูลสุขภาพ" description="ประวัติส่วนตัวของคุณ แก้ไขได้ และดูวิเคราะห์เทียบกับคนสุขภาพดี" />

      <div
        role="tablist"
        aria-label="โหมดการแสดงผล"
        className="grid grid-cols-2 gap-1 p-1 rounded-full bg-slate-100 border border-slate-200"
      >
        {TABS.map((tab, i) => (
          <button
            key={tab.mode}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`hp-tab-${tab.mode}`}
            aria-selected={mode === tab.mode}
            aria-controls={`hp-panel-${tab.mode}`}
            tabIndex={mode === tab.mode ? 0 : -1}
            onClick={() => setMode(tab.mode)}
            onKeyDown={(e) => onTabKey(e, i)}
            className={cn(
              'inline-flex items-center justify-center gap-2 min-h-[48px] rounded-full text-base font-bold transition-colors cursor-pointer',
              mode === tab.mode ? 'bg-purple-700 text-white shadow-sm' : 'text-slate-700 hover:bg-white'
            )}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {mode === 'edit' ? (
        <form
          id="hp-panel-edit"
          role="tabpanel"
          aria-labelledby="hp-tab-edit"
          onSubmit={handleSave}
          noValidate
          className="space-y-5"
        >
          {SECTIONS.map(({ title, subtitle, Component }) => (
            <Card key={title}>
              <h2 className="text-xl font-bold text-slate-900">{title}</h2>
              <p className="text-base text-slate-600 mt-1 mb-6">{subtitle}</p>
              <Component profile={profile} update={update} errors={errors} clearError={clearError} />
            </Card>
          ))}

          <div className="sticky bottom-[calc(5.75rem+env(safe-area-inset-bottom))] lg:bottom-4 z-20 rounded-2xl bg-white/95 backdrop-blur border border-slate-200 p-3 shadow-lg">
            <div className="grid grid-cols-2 gap-3">
              <Button type="button" variant="neutral" fullWidth disabled={!dirty} onClick={handleCancel}>
                ยกเลิก
              </Button>
              <Button type="submit" fullWidth disabled={!dirty}>
                บันทึก
              </Button>
            </div>
          </div>
        </form>
      ) : (
        <div id="hp-panel-analysis" role="tabpanel" aria-labelledby="hp-tab-analysis">
          {dirty && (
            <p role="status" className="mb-4 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-base text-amber-900">
              มีการแก้ไขที่ยังไม่ได้บันทึก กราฟนี้แสดงตามที่แก้ไขอยู่ กลับไปกด “บันทึก” ในโหมดข้อมูลของฉัน
            </p>
          )}
          <HealthAnalysis profile={profile} onEdit={() => setMode('edit')} />
        </div>
      )}
    </div>
  );
};
