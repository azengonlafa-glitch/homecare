import React, { useEffect, useRef, useState } from 'react';
import { CanvasDecor } from '../components/ui/Decor';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, FastForward } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StepBody, StepPersonal } from '../components/onboarding/PersonalSteps';
import { StepAllergies, StepConditions, StepFamily } from '../components/onboarding/HealthSteps';
import { StepConsent, StepContact } from '../components/onboarding/ContactConsentSteps';
import { StepDocuments } from '../components/onboarding/DocumentsStep';
import type { StepProps } from '../components/onboarding/stepTypes';
import { STEPS } from '../data/onboardingOptions';
import {
  ENABLE_DEV_SKIP,
  loadOnboarding,
  saveOnboarding,
  validateStep,
  type OnboardingProfile,
} from '../lib/onboarding';

const STEP_COMPONENTS: React.FC<StepProps>[] = [
  StepPersonal,
  StepBody,
  StepAllergies,
  StepConditions,
  StepFamily,
  StepContact,
  StepDocuments,
  StepConsent,
];

/** กรอกข้อมูลสุขภาพพื้นฐาน 7 ขั้น (บังคับก่อนเข้าใช้งาน ยกเว้นกดข้ามตอน dev) */
export const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const [state] = useState(loadOnboarding);
  const [profile, setProfile] = useState<OnboardingProfile>(state.profile);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const headingRef = useRef<HTMLHeadingElement>(null);

  const lastStep = STEPS.length - 1;
  const StepComponent = STEP_COMPONENTS[step];

  // เปลี่ยนขั้นแล้วเลื่อนขึ้นบนสุดและย้ายโฟกัสไปที่หัวข้อ (ช่วย screen reader และผู้ใช้คีย์บอร์ด)
  useEffect(() => {
    window.scrollTo({ top: 0 });
    headingRef.current?.focus();
  }, [step]);

  const update = (patch: Partial<OnboardingProfile>) => setProfile((prev) => ({ ...prev, ...patch }));

  const clearError = (id: string) => {
    if (errors[id]) setErrors((prev) => ({ ...prev, [id]: '' }));
  };

  const handleNext = () => {
    const found = validateStep(step, profile);
    setErrors(found);
    const firstInvalid = Object.keys(found)[0];
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus();
      return;
    }

    if (step < lastStep) {
      // เก็บแบบร่างทุกครั้งที่ไปขั้นถัดไป ปิดหน้าแล้วกลับมาข้อมูลไม่หาย
      saveOnboarding({ completed: false, profile });
      setStep(step + 1);
      return;
    }

    saveOnboarding({ completed: true, profile });
    navigate('/', { replace: true });
  };

  const handleBack = () => {
    setErrors({});
    if (step === 0) navigate('/setup');
    else setStep(step - 1);
  };

  // TODO(dev): ปุ่มข้ามสำหรับช่วงพัฒนา ลบทิ้งพร้อมตั้ง ENABLE_DEV_SKIP = false ก่อนใช้งานจริง
  const handleDevSkip = () => {
    saveOnboarding({ completed: false, skipped: true, profile });
    navigate('/', { replace: true });
  };

  return (
    <div className="relative isolate min-h-dvh text-slate-900">
      <CanvasDecor />
      {ENABLE_DEV_SKIP && (
        <header className="border-b border-slate-200 bg-white">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleDevSkip}
              className="inline-flex items-center gap-2 shrink-0 whitespace-nowrap min-h-[44px] px-3 sm:px-4 rounded-full border border-dashed border-slate-400 text-sm font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              <FastForward className="hidden sm:block w-4 h-4" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">ข้าม</span>
              <span className="text-xs font-bold bg-slate-200 text-slate-700 rounded px-1.5 py-0.5">DEV</span>
            </button>
          </div>
        </header>
      )}

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* ความคืบหน้า */}
        <div className="mb-5">
          <p className="text-sm sm:text-base font-bold text-purple-700">
            ขั้นที่ {step + 1} จาก {STEPS.length}
          </p>
          <div
            role="progressbar"
            aria-label="ความคืบหน้าการกรอกข้อมูล"
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
            aria-valuenow={step + 1}
            className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden"
          >
            <div
              className="h-full rounded-full bg-purple-700 transition-[width] duration-300 motion-reduce:transition-none"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        <Card className="p-6 sm:p-8">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl sm:text-3xl font-bold text-slate-900 focus:outline-none"
          >
            {STEPS[step].title}
          </h1>
          <p className="text-base sm:text-lg text-slate-600 mt-1 mb-7">{STEPS[step].subtitle}</p>

          {/* ใช้ form เพื่อให้กด Enter ในช่องกรอกไปขั้นถัดไปได้ */}
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              handleNext();
            }}
          >
            <StepComponent profile={profile} update={update} errors={errors} clearError={clearError} />

            {/* ขั้นสุดท้ายมีข้อความปุ่มยาว: บนจอเล็กเรียงเป็นแนวตั้ง (ปุ่มหลักอยู่บน) */}
            <div
              className={
                step === lastStep ? 'flex flex-col-reverse sm:flex-row gap-3 mt-9' : 'flex gap-3 mt-9'
              }
            >
              <Button
                type="button"
                variant="neutral"
                size="sm"
                onClick={handleBack}
                className={step === lastStep ? 'sm:shrink-0' : 'shrink-0'}
              >
                <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                <span>{step === 0 ? 'กลับ' : 'ก่อนหน้า'}</span>
              </Button>
              <Button type="submit" className="flex-1" disabled={step === lastStep && !profile.consent}>
                {step === lastStep ? 'เสร็จสิ้น เริ่มใช้งาน' : 'ถัดไป'}
              </Button>
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
};
