import { SYMPTOM_LABEL, TREND_LABEL, purposeLabel, symptomLabels, SYMPTOM_REQUIRED_PURPOSES } from './options';
import type { BriefAssistant, CheckinAnswers } from './types';

/**
 * ผู้ช่วยเตรียมข้อมูลแบบกฎตายตัว ไม่ได้เรียก AI และไม่มีการส่งข้อมูลออกนอกเครื่อง
 * ทำหน้าที่จัดเรียงข้อมูลเท่านั้น ไม่วินิจฉัยและไม่แนะนำยา
 */

const SYMPTOM_WORDS: Record<string, string[]> = {
  headache: ['ปวดหัว', 'ปวดศีรษะ', 'มึนหัว'],
  dizziness: ['เวียนหัว', 'เวียนศีรษะ', 'บ้านหมุน'],
  fever: ['มีไข้', 'ตัวร้อน', 'เป็นไข้'],
  cough: ['ไอ'],
  sore_throat: ['เจ็บคอ'],
  stomach_pain: ['ปวดท้อง', 'จุกท้อง'],
  nausea: ['คลื่นไส้', 'พะอืดพะอม'],
  itching: ['คัน'],
  rash: ['ผื่น'],
};

export interface StructuringHints {
  /** อาการที่พบในข้อความแต่ยังไม่ได้เลือก */
  symptoms: { value: string; label: string }[];
  /** ระยะเวลาที่พบในข้อความ เช่น "3 วัน" */
  duration: string | null;
}

/** อ่านข้อความที่ผู้ใช้พิมพ์แล้วเสนอข้อมูลให้เลือกเติม ผู้ใช้ต้องกดยืนยันเองทุกครั้ง */
export function structureText(a: Pick<CheckinAnswers, 'description' | 'symptoms' | 'duration'>): StructuringHints {
  const text = a.description;
  const symptoms = Object.entries(SYMPTOM_WORDS)
    .filter(([id, words]) => !a.symptoms.includes(id) && words.some((w) => text.includes(w)))
    .map(([value]) => ({ value, label: SYMPTOM_LABEL[value] ?? value }));
  const found = !a.duration ? text.match(/(\d+)\s*(ชั่วโมง|ชม\.?|วัน|สัปดาห์|อาทิตย์|เดือน)/) : null;
  return { symptoms, duration: found ? `${found[1]} ${found[2]}` : null };
}

/** ข้อมูลสำคัญที่ยังขาด พร้อมคำถามให้กรอกเพิ่ม */
export function findMissing(a: CheckinAnswers): string[] {
  const missing: string[] = [];
  const needsSymptoms = SYMPTOM_REQUIRED_PURPOSES.includes(a.purpose) || a.symptoms.length > 0;
  if (needsSymptoms) {
    if (!a.duration) missing.push('เป็นมานานแค่ไหนแล้ว');
    if (!a.startedOn) missing.push('เริ่มเป็นเมื่อไร');
    if (!a.trend) missing.push('อาการดีขึ้นหรือแย่ลง');
    if (a.severity === null) missing.push('ระดับความรุนแรงของอาการ');
    if (!a.previousMeds.trim()) missing.push('ได้ลองใช้ยาอะไรไปแล้วบ้าง');
    if (!a.location.trim()) missing.push('เป็นที่ตำแหน่งไหน');
  }
  if (!a.description.trim()) missing.push('คำอธิบายอาการหรือคำถามด้วยคำพูดของคุณเอง');
  return missing;
}

/** สรุปจากข้อมูลที่ผู้ใช้กรอกเท่านั้น ไม่ตีความเพิ่ม */
export function summarize(a: CheckinAnswers): BriefAssistant {
  const parts: string[] = [`เรื่องที่ปรึกษา: ${purposeLabel(a) || 'ไม่ระบุ'}`];
  const symptoms = symptomLabels(a);
  if (symptoms.length) parts.push(`อาการ: ${symptoms.join(', ')}`);
  if (a.severity !== null) parts.push(`ความรุนแรงที่รายงาน ${a.severity}/10`);
  if (a.duration) parts.push(`เป็นมา ${a.duration}`);
  if (a.trend) parts.push(`แนวโน้ม${TREND_LABEL[a.trend]}`);
  return { engine: 'rules', summary: parts.join(' · '), missing: findMissing(a) };
}
