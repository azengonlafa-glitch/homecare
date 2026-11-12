import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { CONSENT_CLOSING, CONSENT_SECTIONS, CONSENT_VERSION, DATA_LOCATION_NOTE } from './consentDocument';

/**
 * ผูก "คำสัญญาในเอกสารยินยอม" กับ "สิ่งที่แอปมีจริง" ไม่ให้เริ่มไม่ตรงกัน
 * (PDPA ม.23 ให้แจ้งตามจริง และเอกสารที่ไม่ตรงกับสิ่งที่ระบบทำเป็นปัญหาได้พอ ๆ กับเขียนผิด)
 */
const allText = [
  CONSENT_CLOSING,
  ...CONSENT_SECTIONS.flatMap((s) => [s.title, ...(s.paragraphs ?? []), ...(s.items ?? []), ...(s.paragraphs2 ?? [])]),
].join('\n');

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf-8');

describe('เอกสารยินยอม', () => {
  it('หัวข้อเรียงเลขต่อเนื่อง', () => {
    CONSENT_SECTIONS.forEach((section, i) => expect(section.title.startsWith(`${i + 1}. `)).toBe(true));
  });

  it('เปลี่ยนเวอร์ชันเมื่อแก้เนื้อหาสำคัญ (ไม่ใช่ฉบับเก่า)', () => {
    expect(['draft-0.1', 'draft-0.2']).not.toContain(CONSENT_VERSION);
  });

  it('ไม่อ้างความสามารถที่แอปไม่มี: การตรวจหรือเตือนความเหมาะสมในการใช้ยา', () => {
    expect(allText).not.toContain('ช่วยตรวจความปลอดภัยในการใช้ยา');
    expect(allText).not.toContain('เตือนเมื่อยาที่เพิ่มอาจเกี่ยวข้องกับประวัติแพ้ยา');
    expect(allText).toContain('แอปไม่ได้ตรวจหรือเตือนความเหมาะสมในการใช้ยา');
  });

  it('ไม่ส่งต่อไปที่นโยบายที่ไม่มีอยู่จริง และบอกที่ตั้งเซิร์ฟเวอร์กับผู้รับข้อมูลภายนอก', () => {
    expect(allText).not.toContain('ที่กำหนดไว้ในนโยบายความเป็นส่วนตัว');
    expect(DATA_LOCATION_NOTE.length).toBeGreaterThan(0);
    for (const recipient of ['Supabase', 'Google Fonts', 'Web Push']) expect(allText).toContain(recipient);
    expect(allText).toContain('ไม่เกิน 30 วัน');
  });

  it('ข้อ 4 ข) เป็นทางเลือก และข้อ 12 ตรงกับพฤติกรรมจริง (ไม่ยินยอมข้อ 4 ก) ใช้แอปไม่ได้)', () => {
    expect(allText).toContain('ข) (ทางเลือก)');
    expect(allText).toContain('ถ้าไม่ให้ความยินยอมนี้ จะใช้แอปไม่ได้');
    expect(allText).not.toContain('อาจใช้บริการบางส่วนไม่ได้');
  });

  it('วิธีใช้สิทธิที่เอกสารบอกมีอยู่จริงในแอป (เส้นทางและฟังก์ชัน)', () => {
    expect(allText).toContain('ข้อมูลและความยินยอมของฉัน');
    const app = read('App.tsx');
    expect(app).toContain('path="data"'); // /settings/data
    expect(app).toContain('path="/privacy-policy"');
    const rights = read('lib/privacyRights.ts');
    for (const signature of ['export function downloadMyData', 'export function withdrawConsent', 'export async function deleteAccountAndData']) {
      expect(rights).toContain(signature);
    }
    expect(fs.existsSync(path.resolve(__dirname, '../../supabase/account_delete.sql'))).toBe(true);
  });
});
