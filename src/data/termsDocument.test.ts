import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TERMS_INTRO, TERMS_IS_DRAFT, TERMS_SECTIONS, TERMS_VERSION } from './termsDocument';

const read = (file: string) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
const allText = [TERMS_INTRO, ...TERMS_SECTIONS.flatMap((s) => [s.title, ...(s.paragraphs ?? []), ...(s.items ?? [])])].join('\n');

describe('ข้อกำหนดการใช้งาน', () => {
  it('ยังเป็นฉบับร่างที่ติดป้ายไว้ จนกว่าผู้รู้กฎหมายตรวจ', () => {
    expect(TERMS_IS_DRAFT).toBe(true);
    expect(TERMS_VERSION).toMatch(/^draft-/);
  });

  it('หัวข้อเรียงเลขต่อเนื่องและทุกหัวข้อมีเนื้อหา', () => {
    TERMS_SECTIONS.forEach((s, i) => {
      expect(s.title.startsWith(`${i + 1}. `), s.title).toBe(true);
      expect((s.paragraphs?.length ?? 0) + (s.items?.length ?? 0), s.title).toBeGreaterThan(0);
    });
  });

  it('บอกชัดว่าไม่ใช่คำแนะนำทางการแพทย์/เหตุฉุกเฉิน และแจ้งเตือนอาจไม่ตรงเวลา', () => {
    expect(allText).toContain('ไม่ใช่เครื่องมือวินิจฉัยหรือรักษาโรค');
    expect(allText).toContain('ไม่ใช่ช่องทางแจ้งเหตุฉุกเฉิน');
    expect(allText).toContain('ไม่รับประกันว่าการแจ้งเตือนจะมาถึงตรงเวลา');
  });

  it('ทางลบบัญชีที่เขียนไว้ตรงกับหน้าที่มีจริงในแอป', () => {
    expect(allText).toContain('ตั้งค่า › ข้อมูลและความยินยอมของฉัน');
    expect(read('src/pages/settings/DataSettingsPage.tsx')).toContain('ลบบัญชี');
    expect(read('src/App.tsx')).toContain('path="data"');
  });

  it('มีหน้า /terms ที่เปิดได้โดยไม่ต้องล็อกอิน และช่องติ๊กตอนสมัครลิงก์ไปถึง', () => {
    const app = read('src/App.tsx');
    const route = app.split('\n').find((l) => l.includes('path="/terms"')) ?? '';
    expect(route).toContain('TermsPage');
    // เส้นทางสาธารณะต้องไม่ห่อด้วยตัวบังคับล็อกอิน
    expect(route).not.toContain('RequireAuth');
    expect(read('src/pages/LoginPage.tsx')).toContain('href="/terms"');
  });
});
