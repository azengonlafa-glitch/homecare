import type { OnboardingProfile } from '../lib/onboarding';
import {
  PERIOD_LABEL,
  formatMedForm,
  formatQty,
  instructionText,
  medStats,
  periodTime,
  periodsText,
  weekdaysText,
  type Medication,
  type MedsState,
} from '../lib/meds';
import type { JournalPost } from '../lib/journal';
import { summarize } from './assistant';
import { FEELING_LABEL, TREND_LABEL, questionsFor, purposeLabel, symptomLabels } from './options';
import type {
  BriefChanges,
  BriefLog,
  BriefMedContext,
  BriefMedication,
  BriefPastMedication,
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
const REPORT_ADHERENCE_DAYS = 30;
const RECENT_LOG_DAYS = 30;
const DAY_MS = 86_400_000;

export function ageFromProfile(profile: OnboardingProfile, now = new Date()): number | null {
  const year = Number(profile.birthYear);
  if (!/^\d{4}$/.test(profile.birthYear)) return null;
  return now.getFullYear() + 543 - year;
}

function adherenceText(m: Medication, meds: MedsState, now: Date): { adherence: string; missedReasons: string } {
  if (m.asNeeded) return { adherence: '', missedReasons: '' };
  const stats = medStats(m, meds.logs, { sinceDays: REPORT_ADHERENCE_DAYS, now });
  const parts = [`ควรกิน ${stats.expected} ครั้ง`, `กินแล้ว ${stats.taken}`, `ไม่ได้กิน ${stats.missed}`];
  if (stats.skipped) parts.push(`งดตามแพทย์สั่ง ${stats.skipped}`);
  if (stats.unrecorded) parts.push(`ไม่ได้บันทึก ${stats.unrecorded}`);
  if (stats.late) parts.push(`กินช้า ${stats.late}`);
  if (stats.adherence !== null) parts.push(`(${stats.adherence}%)`);
  const reasons = [...new Set(meds.logs.filter((l) => l.medId === m.id && l.reason && l.date >= stats.from).map((l) => l.reason as string))];
  return { adherence: parts.join(' · '), missedReasons: reasons.join(', ') };
}

/** รวมยาจากตู้ยาและยาที่แจ้งไว้ในข้อมูลสุขภาพ โดยไม่นับซ้ำ */
export function currentMedications(profile: OnboardingProfile, meds: MedsState, now = new Date()): BriefMedication[] {
  const active = meds.meds.filter((m) => m.active);
  const fromCabinet: BriefMedication[] = active.map((m) => ({
    name: m.name,
    dose: instructionText(m),
    schedule: m.asNeeded ? 'ใช้เมื่อจำเป็น' : `${periodsText(m.periods)} · ${weekdaysText(m.weekdays)}`,
    times: m.asNeeded ? '' : m.periods.map((p) => `${PERIOD_LABEL[p]} ${periodTime(m, p)}`).join(', '),
    startDate: m.startDate,
    form: formatMedForm(m),
    condition: m.condition,
    reason: m.reason,
    note: m.note,
    remaining: `${formatQty(m.remaining)} ${m.unit}`,
    expiryDate: m.expiryDate ?? '',
    ...adherenceText(m, meds, now),
    source: 'cabinet',
  }));
  const known = fromCabinet.map((m) => m.name.toLowerCase());
  const fromProfile: BriefMedication[] = profile.currentMeds
    .filter((name) => name.trim() && !known.some((k) => k.includes(name.trim().toLowerCase())))
    .map((name) => ({ name: name.trim(), dose: '', schedule: '', times: '', startDate: '', form: '', condition: '', reason: '', note: '', remaining: '', expiryDate: '', adherence: '', missedReasons: '', source: 'profile' }));
  return [...fromCabinet, ...fromProfile];
}

/** ยาที่หยุดใช้แล้ว เภสัชกรต้องรู้เพื่อดูประวัติการใช้ยาและยาที่เคยมีปัญหา */
export const pastMedications = (meds: MedsState): BriefPastMedication[] =>
  meds.meds
    .filter((m) => !m.active)
    .map((m) => ({
      name: m.name,
      dose: instructionText(m),
      period: `เริ่ม ${m.startDate}${m.stoppedAt ? ` หยุด ${m.stoppedAt}` : ''}`,
      note: [m.reason, m.note].filter(Boolean).join(' · '),
    }));

/** บันทึกอาการของตัวเองในช่วงหลัง ไม่รวมบันทึกที่เขียนถึงคนอื่นในบ้าน */
export function recentLogs(posts: JournalPost[], authorId: string, selfLabel: string, now = new Date()): BriefLog[] {
  const since = now.getTime() - RECENT_LOG_DAYS * DAY_MS;
  return posts
    .filter((p) => p.authorId === authorId && p.about === selfLabel && new Date(p.createdAt).getTime() >= since)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((p) => ({ date: p.createdAt, title: p.title, symptoms: p.symptoms, mood: p.moodDetails.join(', '), content: p.content }));
}

/** ไฟล์ในข้อมูลสุขภาพที่ต้องส่งไปกับรายงาน */
export const profileAttachments = (brief: PatientBrief) => [
  ...(brief.allergies?.drugs.flatMap((d) => d.attachments) ?? []),
  ...(brief.history?.medicalDocs ?? []),
];

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
  // เทียบแบบวันต่อวัน: ถ้าใช้เวลาปัจจุบัน ยาที่เริ่มวันนี้จะกลายเป็น "ก่อนหน้า 1 วัน"
  const anchor = a.startedOn ? new Date(`${a.startedOn}T00:00:00`) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const items: string[] = [];
  for (const m of meds.meds) {
    if (m.startDate) {
      const start = new Date(`${m.startDate}T00:00:00`).getTime();
      const gap = (anchor.getTime() - start) / DAY_MS;
      if (gap >= 0 && gap <= NEW_MED_WINDOW_DAYS) {
        const days = Math.round(gap);
        const reference = a.startedOn ? 'วันที่เริ่มมีอาการ' : 'วันนี้';
        items.push(`เริ่มใช้ ${m.name} เมื่อ ${m.startDate} ${days === 0 ? `ตรงกับ${reference}` : `ก่อน${reference} ${days} วัน`}`);
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
    .map((b) => ({
      date: b.session.createdAt,
      providerName: b.provider?.displayName ?? 'ผู้ให้บริการ',
      topic: b.session.topic,
      severity: b.checkin?.severity ?? null,
      assessment: b.note?.assessment ?? '',
      advice: [b.note?.recommendation, b.note?.medicationAdvice].filter(Boolean).join(' · '),
      referral: b.note?.referral ?? '',
      followUpPlan: b.note?.followUpPlan ?? '',
    }));

export interface BriefInput {
  profile: OnboardingProfile;
  meds: MedsState;
  answers: CheckinAnswers;
  prior: SessionBundle[];
  scopes: ConsentScope[];
  /** บันทึกอาการของตัวเองช่วงหลัง */
  logs?: BriefLog[];
  fallbackName?: string;
  now?: Date;
}

/**
 * รวมข้อมูลจาก Health Profile เดิมกับอาการล่าสุดเป็น Patient Brief
 * ส่งเฉพาะข้อมูลสุขภาพ ไม่ส่งเบอร์โทร ที่อยู่ พิกัด และผู้ติดต่อฉุกเฉิน
 */
export function buildBrief({ profile, meds, answers, prior, scopes, logs = [], fallbackName, now = new Date() }: BriefInput): PatientBrief {
  const allow = (s: ConsentScope) => scopes.includes(s);
  const brief: PatientBrief = {
    generatedAt: now.toISOString(),
    scopes,
    assistant: summarize(answers),
  };

  if (allow('overview')) {
    brief.overview = {
      name: profile.fullName.trim() || fallbackName || '',
      age: ageFromProfile(profile, now),
      gender: profile.gender,
      heightCm: profile.heightCm,
      weightKg: profile.weightKg,
      bloodType: profile.bloodType,
      birthDate: [profile.birthDay, profile.birthMonth, profile.birthYear].filter(Boolean).join(' '),
      occupation: profile.occupation,
    };
    brief.lifestyle = {
      systolic: profile.systolic,
      diastolic: profile.diastolic,
      fastingGlucose: profile.fastingGlucose,
      smoking: profile.smoking,
      alcohol: profile.alcohol,
      exercise: profile.exercise,
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
      medicalNotes: profile.medicalNotes,
      medicalDocs: profile.medicalDocs ?? [],
    };
    brief.recentLogs = logs;
  }
  if (allow('allergies')) {
    brief.allergies = {
      noAllergies: profile.noAllergies,
      drugs: profile.drugAllergies.map((d) => ({
        drug: d.drug,
        symptoms: d.symptoms,
        severity: SEVERITY_LABEL[d.severity] ?? d.severity,
        attachments: d.attachments ?? [],
      })),
      other: profile.otherAllergies,
    };
  }
  if (allow('medications')) {
    brief.medications = currentMedications(profile, meds, now);
    brief.pastMedications = pastMedications(meds);
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
      location: answers.location,
      pattern: answers.pattern,
      worseWith: answers.worseWith,
      betterWith: answers.betterWith,
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

const textLine = (label: string, value?: string | number | null) => (value === undefined || value === null || value === '' ? null : `${label}: ${value}`);

/** รายงานแบบข้อความล้วน สำหรับคัดลอกไปวางในระบบของร้านยา ต้องมีข้อมูลครบเท่าที่แสดงบนหน้าจอ */
export function briefToText(b: PatientBrief): string {
  const out: (string | null)[] = [];
  const head = (t: string) => out.push('', `[${t}]`);
  const a = b.allergies;
  head('ประวัติแพ้ยา');
  if (a) {
    if (a.drugs.length === 0 && a.other.length === 0) out.push(a.noAllergies ? 'ผู้ใช้ยืนยันว่าไม่เคยแพ้' : 'ไม่ได้ระบุ');
    for (const d of a.drugs) out.push([d.drug, d.symptoms, d.severity].filter(Boolean).join(' · '));
    out.push(textLine('แพ้อื่น ๆ', a.other.join(', ')));
  }
  const s = b.symptoms;
  head('อาการล่าสุด (ผู้ใช้รายงาน)');
  if (s) {
    out.push(
      textLine('บันทึกเมื่อ', new Date(s.recordedAt).toLocaleString('th-TH')),
      textLine('เรื่องที่ปรึกษา', s.purpose),
      textLine('อาการ', s.symptoms.join(', ')),
      textLine('คำอธิบาย', s.description),
      textLine('ความรุนแรง', s.severity !== null ? `${s.severity}/10` : ''),
      textLine('ความรู้สึก', s.feelings.join(', ')),
      textLine('ตำแหน่ง', s.location),
      textLine('ลักษณะการเป็น', s.pattern),
      textLine('ระยะเวลา', s.duration),
      textLine('เริ่มเมื่อ', s.startedOn),
      textLine('แนวโน้ม', s.trend ? TREND_LABEL[s.trend] : ''),
      textLine('ทำให้แย่ลง', s.worseWith),
      textLine('ทำให้ดีขึ้น', s.betterWith),
      textLine('ยาที่ลองใช้แล้ว', s.previousMeds),
      textLine('อาการร่วม', s.additionalSymptoms),
      ...s.answers.map((x) => textLine(x.question, x.answer)),
      textLine('ไฟล์แนบ', s.attachments.map((f) => f.name).join(', '))
    );
  }
  if (b.changes) {
    head('การเปลี่ยนแปลงจากครั้งก่อน');
    out.push(
      textLine('ความรุนแรงครั้งก่อน', b.changes.previousSeverity !== null ? `${b.changes.previousSeverity}/10` : 'ไม่ระบุ'),
      textLine('ความรุนแรงครั้งนี้', b.changes.currentSeverity !== null ? `${b.changes.currentSeverity}/10` : 'ไม่ระบุ'),
      DIRECTION_LABEL[b.changes.direction],
      textLine('อาการที่เพิ่งแจ้งครั้งนี้', b.changes.newSymptoms.join(', '))
    );
  }
  head('ยาที่ใช้อยู่');
  if (!b.medications?.length) out.push('ไม่มีรายการยา');
  for (const m of b.medications ?? []) {
    out.push(
      `- ${m.name}`,
      textLine('  รูปแบบ', m.form),
      textLine('  ขนาด', m.dose),
      textLine('  ความถี่', m.schedule),
      textLine('  เวลา', m.times),
      textLine('  เริ่มใช้', m.startDate),
      textLine('  ใช้สำหรับ', [m.condition, m.reason].filter(Boolean).join(' · ')),
      textLine('  การกินยา 30 วัน', m.adherence),
      textLine('  เหตุผลที่ไม่ได้กิน', m.missedReasons),
      textLine('  คงเหลือ', m.remaining),
      textLine('  หมดอายุ', m.expiryDate),
      textLine('  หมายเหตุ', m.note)
    );
  }
  if (b.pastMedications?.length) {
    head('ยาที่หยุดใช้แล้ว');
    for (const m of b.pastMedications) out.push(`- ${[m.name, m.dose, m.period, m.note].filter(Boolean).join(' · ')}`);
  }
  if (b.medContext) {
    head('ข้อมูลยาที่ควรตรวจสอบ (ข้อเท็จจริงจากบันทึก ไม่ได้สรุปสาเหตุ)');
    out.push(...b.medContext.items.map((i) => `- ${i}`));
  }
  const o = b.overview;
  head('ข้อมูลผู้ป่วย');
  if (o) {
    out.push(
      textLine('ชื่อ', o.name),
      textLine('อายุ', o.age !== null ? `${o.age} ปี` : ''),
      textLine('วันเกิด', o.birthDate),
      textLine('เพศ', o.gender),
      textLine('น้ำหนัก', o.weightKg ? `${o.weightKg} กก.` : ''),
      textLine('ส่วนสูง', o.heightCm ? `${o.heightCm} ซม.` : ''),
      textLine('กรุ๊ปเลือด', o.bloodType),
      textLine('อาชีพ', o.occupation)
    );
  }
  const l = b.lifestyle;
  if (l) {
    head('ค่าตรวจและการใช้ชีวิต');
    out.push(
      textLine('ความดันล่าสุด', l.systolic || l.diastolic ? `${l.systolic || '-'}/${l.diastolic || '-'} mmHg` : ''),
      textLine('น้ำตาลตอนอดอาหาร', l.fastingGlucose ? `${l.fastingGlucose} mg/dL` : ''),
      textLine('บุหรี่', l.smoking),
      textLine('แอลกอฮอล์', l.alcohol),
      textLine('ออกกำลังกาย', l.exercise)
    );
  }
  const h = b.history;
  head('ประวัติสุขภาพ');
  if (h) {
    out.push(
      textLine('โรคประจำตัว', h.conditions.join(', ') || (h.noConditions ? 'ไม่มี' : 'ไม่ได้ระบุ')),
      textLine('การผ่าตัด/การรักษา', h.surgeryHistory),
      textLine('ประวัติครอบครัว', h.familyHistory.join(', ')),
      textLine('อาหารเสริม', h.supplements),
      textLine('หมายเหตุถึงเภสัชกร', h.notes),
      textLine('บันทึกทางการแพทย์', h.medicalNotes),
      textLine('เอกสารแนบ', h.medicalDocs.map((f) => f.name).join(', '))
    );
  }
  if (b.recentLogs?.length) {
    head('บันทึกอาการ 30 วันล่าสุด');
    for (const r of b.recentLogs) {
      out.push(`- ${[new Date(r.date).toLocaleDateString('th-TH'), r.title, r.symptoms.join(', '), r.mood, r.content].filter(Boolean).join(' · ')}`);
    }
  }
  head('การปรึกษาครั้งก่อน');
  if (!b.previous?.length) out.push('ยังไม่เคยปรึกษา');
  for (const p of b.previous ?? []) {
    out.push(`- ${[new Date(p.date).toLocaleDateString('th-TH'), p.providerName, p.topic, p.severity !== null ? `${p.severity}/10` : '', p.assessment, p.advice, p.referral, p.followUpPlan].filter(Boolean).join(' · ')}`);
  }
  head('จัดโดยระบบ ไม่ใช่ข้อมูลที่ผู้ใช้รายงาน ไม่ใช่การวินิจฉัย');
  out.push(b.assistant.summary, textLine('ข้อมูลที่ยังขาด', b.assistant.missing.join(', ')));
  return out.filter((x): x is string => x !== null).join('\n').trim();
}
