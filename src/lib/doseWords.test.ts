import { describe, expect, it } from 'vitest';
import {
  FORM_GROUPS,
  FORM_OPTIONS,
  UNIT_OPTIONS,
  commonDoseWords,
  doseStatusLabel,
  doseWords,
  formatMedForm,
  skipReasonsFor,
  type MedForm,
} from './meds';

describe('doseWords: คำพูดตามรูปแบบยา', () => {
  const cases: [MedForm, string, string][] = [
    ['tablet', 'กิน', 'กินยา'],
    ['capsule', 'กิน', 'กินยา'],
    ['liquid', 'กิน', 'กินยา'],
    ['injection', 'ฉีด', 'ฉีดยา'],
    ['drops', 'หยอด', 'หยอดยา'],
    ['topical', 'ทา', 'ทายา'],
    ['spray', 'พ่น', 'พ่นยา'],
    ['testkit', 'ตรวจ', 'ตรวจ'],
    ['needle', 'ใช้', 'ใช้อุปกรณ์'],
    ['other', 'ใช้', 'ใช้ยา'],
    ['powder', 'กิน', 'กินยา'],
    ['effervescent', 'กิน', 'กินยา'],
    ['supplement', 'กิน', 'กินวิตามิน'],
    ['herbal', 'กิน', 'กินยาสมุนไพร'],
    ['lozenge', 'อม', 'อมยา'],
    ['sublingual', 'อม', 'อมยา'],
    ['pen', 'ฉีด', 'ฉีดยา'],
    ['patch', 'แปะ', 'แปะยา'],
    ['eye', 'หยอด', 'หยอดตา'],
    ['ear', 'หยอด', 'หยอดหู'],
    ['inhaler', 'สูด', 'สูดยา'],
    ['suppository', 'เหน็บ', 'เหน็บยา'],
  ];
  it.each(cases)('%s -> %s / %s', (form, verb, phrase) => {
    const w = doseWords(form);
    expect(w.verb).toBe(verb);
    expect(w.phrase).toBe(phrase);
    expect(w.done).toBe(`${verb}แล้ว`);
    expect(w.skip).toBe(`ไม่${verb}`);
    expect(w.notDone).toBe(`ไม่ได้${verb}`);
  });

  it('ไม่ทราบรูปแบบ = ยากิน', () => {
    expect(doseWords(undefined).done).toBe('กินแล้ว');
    expect(doseWords(null).verb).toBe('กิน');
  });

  it('"พอ…อีก X วัน": ยากินใช้ กิน นอกนั้นใช้ ใช้', () => {
    expect(doseWords('tablet').use).toBe('กิน');
    expect(doseWords('liquid').use).toBe('กิน');
    expect(doseWords('drops').use).toBe('ใช้');
    expect(doseWords('injection').use).toBe('ใช้');
  });
});

describe('commonDoseWords: สรุปรวมหลายยา', () => {
  it('กริยาเดียวกันหมด = ใช้คำนั้น', () => {
    expect(commonDoseWords(['tablet', 'capsule', 'liquid']).done).toBe('กินแล้ว');
    expect(commonDoseWords(['drops', 'drops']).done).toBe('หยอดแล้ว');
  });
  it('ปนกัน = คำกลาง "ใช้ยา"', () => {
    const w = commonDoseWords(['tablet', 'drops']);
    expect(w.verb).toBe('ใช้');
    expect(w.phrase).toBe('ใช้ยา');
  });
  it('ไม่มียา = ยากิน', () => {
    expect(commonDoseWords([]).verb).toBe('กิน');
  });
  it('กริยาเดียวกันแต่วลีต่างกัน ใช้วลีกลาง ไม่ใช่วลีของตัวแรก', () => {
    // วิตามิน + ยาเม็ด: ห้ามสรุปรวมว่า "กินวิตามิน" ทั้งที่มียาด้วย
    expect(commonDoseWords(['supplement', 'tablet']).phrase).toBe('กินยา');
    expect(commonDoseWords(['supplement', 'supplement']).phrase).toBe('กินวิตามิน');
    expect(commonDoseWords(['eye', 'ear']).phrase).toBe('หยอดยา');
    expect(commonDoseWords(['eye', 'ear']).verb).toBe('หยอด');
  });
});

describe('ป้ายสถานะและเหตุผลตามรูปแบบยา', () => {
  it('doseStatusLabel', () => {
    expect(doseStatusLabel('taken', 'drops')).toBe('หยอดแล้ว');
    expect(doseStatusLabel('missed', 'injection')).toBe('ไม่ได้ฉีด');
    expect(doseStatusLabel('skipped', 'drops')).toBe('งดตามแพทย์สั่ง');
    expect(doseStatusLabel('taken')).toBe('กินแล้ว');
  });
  it('เหตุผลที่ไม่ทำตามมื้อ: ลืม/ทำไม่ได้ ตามกริยา', () => {
    const labels = skipReasonsFor('drops').map((r) => r.label);
    expect(labels).toContain('ลืมหยอด');
    expect(labels).toContain('ไม่สบาย หยอดไม่ได้');
    expect(skipReasonsFor('tablet').map((r) => r.label)).toContain('ลืมกิน');
  });
  it('หมอสั่งงดไม่นับว่าพลาด ที่เหลือนับเป็นพลาด', () => {
    const rs = skipReasonsFor('drops');
    expect(rs.find((r) => r.value === 'doctor')?.status).toBe('skipped');
    expect(rs.filter((r) => r.value !== 'doctor').every((r) => r.status === 'missed')).toBe(true);
  });
});

describe('รายการรูปแบบยา (FORM_OPTIONS)', () => {
  it('ป้ายและรหัสไม่ซ้ำ (ยาของสมาชิกแปลงรูปแบบกลับด้วยการเทียบป้าย)', () => {
    const labels = FORM_OPTIONS.map((f) => f.label);
    const values = FORM_OPTIONS.map((f) => f.value);
    expect(new Set(labels).size).toBe(labels.length);
    expect(new Set(values).size).toBe(values.length);
  });

  it('ป้ายเดิมที่ผู้ใช้เคยบันทึกไว้ยังอยู่ครบและตรงรหัสเดิม', () => {
    const legacy: [MedForm, string][] = [
      ['tablet', 'ยาเม็ด'],
      ['capsule', 'แคปซูล'],
      ['liquid', 'ยาน้ำ'],
      ['injection', 'ยาฉีด'],
      ['needle', 'เข็ม/อุปกรณ์ฉีดยา'],
      ['testkit', 'ชุดตรวจ/แผ่นตรวจ'],
      ['topical', 'ยาทา/ครีม'],
      ['drops', 'ยาหยอด'],
      ['spray', 'ยาพ่น'],
      ['other', 'อื่น ๆ'],
    ];
    for (const [value, label] of legacy) {
      expect(FORM_OPTIONS.find((f) => f.label === label)?.value).toBe(value);
    }
  });

  it('ทุกรูปแบบอยู่ในหมวดที่มีจริง หมวดละอย่างน้อย 1 รายการ และมีคำกริยา', () => {
    const groups = new Set(FORM_GROUPS.map((g) => g.id));
    for (const f of FORM_OPTIONS) {
      expect(groups.has(f.group)).toBe(true);
      expect(doseWords(f.value).verb.length).toBeGreaterThan(0);
    }
    for (const g of FORM_GROUPS) {
      expect(FORM_OPTIONS.some((f) => f.group === g.id)).toBe(true);
    }
  });

  it('หน่วยเริ่มต้นของทุกรูปแบบมีในตัวเลือกหน่วย', () => {
    const units = new Set(UNIT_OPTIONS.map((u) => u.value));
    for (const f of FORM_OPTIONS) expect(units.has(f.unit)).toBe(true);
  });

  it('formatMedForm: ใช้ป้ายของรูปแบบ และ "อื่น ๆ" ใช้ข้อความที่ผู้ใช้พิมพ์', () => {
    expect(formatMedForm({ form: 'patch' })).toBe('แผ่นแปะ');
    expect(formatMedForm({ form: 'eye' })).toBe('ยาหยอดตา');
    expect(formatMedForm({ form: 'other', customForm: ' น้ำเกลือล้างจมูก ' })).toBe('น้ำเกลือล้างจมูก');
  });
});
