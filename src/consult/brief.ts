import type { OnboardingProfile } from '../lib/onboarding';
import {
  PERIOD_LABEL,
  instructionText,
  medStats,
  periodTime,
  periodsText,
  weekdaysText,
  type MedsState,
} from '../lib/meds';
import { summarize } from './assistant';
import { FEELING_LABEL, questionsFor, purposeLabel, symptomLabels } from './options';
import { evaluateSafety } from './safety';
import type {
  BriefChanges,
  BriefMedContext,
  BriefMedication,
  BriefPrevious,
  ChangeDirection,
  CheckinAnswers,
  ConsentScope,
  PatientBrief,
  SessionBundle,
} from './types';

const SEVERITY_LABEL: Record<string, string> = { mild: 'เล็กน้อย', moderate: 'ปานกลาง', severe: 'รุนแรง' };

/** ช่วงเวลาที่ใช้กรองรายการเพื่อให้เภสัชกรตรวจสอบ ไม่ได้หมายความว่ายานั้นเป็นสาเหตุ */
export const NEW_MED_WINDOW_DAYS = 14;
const ADHERENCE_WINDOW_DAYS = 7;
const DAY_MS = 86_400_000;

export function ageFromProfile(profile: OnboardingProfile, now = new Date()): number | null {
  const year = Number(profile.birthYear);
  if (!/^\d{4}$/.test(profile.birthYear)) return null;
  return now.getFullYear() + 543 - year;
}

/** รวมยาจากตู้ยาและยาที่แจ้งไว้ในข้อมูลสุขภาพ โดยไม่นับซ้ำ */
export function currentMedications(profile: OnboardingProfile, meds: MedsState): BriefMedication[] {
  const active = meds.meds.filter((m) => m.active);
  const fromCabinet: BriefMedication[] = active.map((m) => ({
    name: m.name,
    dose: instructionText(m),
    schedule: m.asNeeded ? 'ใช้เมื่อจำเป็น' : `${periodsText(m.periods)} · ${weekdaysText(m.weekdays)}`,
    times: m.asNeeded ? '' : m.periods.map((p) => `${PERIOD_LABEL[p]} ${periodTime(m, p)}`).join(', '),
    startDate: m.startDate,
    source: 'cabinet',
  }));
  const known = fromCabinet.map((m) => m.name.toLowerCase());
  const fromProfile: BriefMedication[] = profile.currentMeds
    .filter((name) => name.trim() && !known.some((k) => k.includes(name.trim().toLowerCase())))
    .map((name) => ({ name: name.trim(), dose: '', schedule: '', times: '', startDate: '', source: 'profile' }));
  return [...fromCabinet, ...fromProfile];
}

export function severityDirection(previous: number | null, current: number | null): ChangeDirection {
  if (previous === null || current === null) return 'unknown';
  if (current > previous) return 'increased';
  if (current < previous) return 'decreased';
  return 'same';
}

export const DIRECTION_LABEL: Record<ChangeDirection, string> = {
  increased: 'ความรุนแรงเพิ่มขึ้นตามที่รายงาน',
  decreased: 'ความรุนแรงลดลงตามที่รายงาน',
  same: 'ความรุนแรงเท่าเดิมตามที่รายงาน',
  unknown: 'เปรียบเทียบไม่ได้ เพราะข้อมูลไม่ครบ',
};

/** เทียบกับการปรึกษาครั้งล่าสุดที่มีข้อมูลอาการ */
export function changesSince(current: CheckinAnswers, prior: SessionBundle[]): BriefChanges | undefined {
  const last = [...prior]
    .filter((b) => b.checkin)
    .sort((a, b) => b.session.createdAt.localeCompare(a.session.createdAt))[0];
  if (!last?.checkin) return undefined;
  const previousLabels = symptomLabels(last.checkin);
  const currentLabels = symptomLabels(current);
  return {
    previousDate: last.checkin.createdAt,
    previousSeverity: last.checkin.severity,
    currentSeverity: current.severity,
    direction: severityDirection(last.checkin.severity, current.severity),
    previousSymptoms: previousLabels,
    newSymptoms: currentLabels.filter((s) => !previousLabels.includes(s)),
  };
}

/** ข้อมูลเรื่องยาที่ควรตรวจสอบ เขียนเป็นข้อเท็จจริงจากบันทึก ไม่สรุปสาเหตุ */
export function medicationContext(a: CheckinAnswers, meds: MedsState, now = new Date()): BriefMedContext | undefined {
  const anchor = a.startedOn ? new Date(`${a.startedOn}T00:00:00`) : now;
  const items: string[] = [];
  for (const m of meds.meds) {
    if (m.startDate) {
      const start = new Date(`${m.startDate}T00:00:00`).getTime();
      const gap = (anchor.getTime() - start) / DAY_MS;
      if (gap >= 0 && gap <= NEW_MED_WINDOW_DAYS) {
        items.push(`เริ่มใช้ ${m.name} เมื่อ ${m.startDate} ก่อน${a.startedOn ? 'วันที่เริ่มมีอาการ' : 'วันนี้'} ${Math.round(gap)} วัน`);
      }
    }
    if (m.stoppedAt) {
      const gap = (anchor.getTime() - new Date(`${m.stoppedAt}T00:00:00`).getTime()) / DAY_MS;
      if (gap >= 0 && gap <= NEW_MED_WINDOW_DAYS) items.push(`หยุดใช้ ${m.name} เมื่อ ${m.stoppedAt}`);
    }
    if (m.active && !m.asNeeded) {
      const stats = medStats(m, meds.logs, { sinceDays: ADHERENCE_WINDOW_DAYS, now });
      if (stats.missed > 0) items.push(`${m.name}: บันทึกว่าไม่ได้ใช้ ${stats.missed} ครั้งใน ${ADHERENCE_WINDOW_DAYS} วันที่ผ่านมา`);
    }
  }
  return items.length ? { items } : undefined;
}

function answerLines(a: CheckinAnswers): { question: string; answer: string }[] {
  const lines: { question: string; answer: string }[] = [];
  for (const q of questionsFor(a)) {
    const raw = a.answers[q.id];
    if (raw === undefined || raw.length === 0) continue;
    const labelOf = (v: string) => q.options?.find((o) => o.value === v)?.label ?? v;
    lines.push({ question: q.label, answer: Array.isArray(raw) ? raw.map(labelOf).join(', ') : labelOf(raw) });
  }
  return lines;
}

export const previousEntries = (prior: SessionBundle[]): BriefPrevious[] =>
  [...prior]
    .filter((b) => b.session.status === 'completed')
    .sort((a, b) => b.session.createdAt.localeCompare(a.session.createdAt))
    .slice(0, 5)
    .map((b) => ({
      date: b.session.createdAt,
      providerName: b.provider?.displayName ?? 'ผู้ให้บริการ',
      topic: b.session.topic,
      severity: b.checkin?.severity ?? null,
      advice: [b.note?.recommendation, b.note?.medicationAdvice].filter(Boolean).join(' · '),
      followUpPlan: b.note?.followUpPlan ?? '',
    }));

export interface BriefInput {
  profile: OnboardingProfile;
  meds: MedsState;
  answers: CheckinAnswers;
  prior: SessionBundle[];
  scopes: ConsentScope[];
  fallbackName?: string;
  now?: Date;
}

/**
 * รวมข้อมูลจาก Health Profile เดิมกับอาการล่าสุดเป็น Patient Brief
 * ใส่เฉพาะหมวดที่ผู้ใช้อนุญาต หมวดที่ไม่อนุญาตจะไม่อยู่ในข้อมูลที่ส่งเลย
 */
export function buildBrief({ profile, meds, answers, prior, scopes, fallbackName, now = new Date() }: BriefInput): PatientBrief {
  const allow = (s: ConsentScope) => scopes.includes(s);
  const brief: PatientBrief = {
    generatedAt: now.toISOString(),
    scopes,
    assistant: summarize(answers),
    safety: evaluateSafety(answers),
  };

  if (allow('overview')) {
    brief.overview = {
      name: profile.fullName.trim() || fallbackName || '',
      age: ageFromProfile(profile, now),
      gender: profile.gender,
      heightCm: profile.heightCm,
      weightKg: profile.weightKg,
      bloodType: profile.bloodType,
    };
  }
  if (allow('history')) {
    brief.history = {
      conditions: profile.conditions,
      noConditions: profile.noConditions,
      surgeryHistory: profile.surgeryHistory,
      familyHistory: profile.familyHistory,
      supplements: profile.supplements,
      notes: profile.pharmacistNote,
    };
  }
  if (allow('allergies')) {
    brief.allergies = {
      noAllergies: profile.noAllergies,
      drugs: profile.drugAllergies.map((d) => ({
        drug: d.drug,
        symptoms: d.symptoms,
        severity: SEVERITY_LABEL[d.severity] ?? d.severity,
      })),
      other: profile.otherAllergies,
    };
  }
  if (allow('medications')) {
    brief.medications = currentMedications(profile, meds);
    brief.medContext = medicationContext(answers, meds, now);
  }
  if (allow('symptoms')) {
    brief.symptoms = {
      recordedAt: now.toISOString(),
      purpose: purposeLabel(answers),
      symptoms: symptomLabels(answers),
      severity: answers.severity,
      feelings: answers.feelings.map((f) => FEELING_LABEL[f] ?? f),
      duration: answers.duration,
      startedOn: answers.startedOn,
      trend: answers.trend,
      description: answers.description,
      previousMeds: answers.previousMeds,
      additionalSymptoms: answers.additionalSymptoms,
      answers: answerLines(answers),
      attachments: answers.attachments,
    };
  }
  if (allow('previous')) {
    brief.previous = previousEntries(prior);
    brief.changes = changesSince(answers, prior);
  }
  return brief;
}
