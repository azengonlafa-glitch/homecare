import type { OnboardingProfile } from '../../lib/onboarding';

/** props ที่ทุกขั้นตอนของฟอร์มข้อมูลพื้นฐานได้รับ */
export interface StepProps {
  profile: OnboardingProfile;
  update: (patch: Partial<OnboardingProfile>) => void;
  errors: Record<string, string>;
  clearError: (id: string) => void;
}
