import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * กันคำเก่าที่เคยทำให้ผู้ใช้สับสนกลับเข้ามาในข้อความหน้าจอ (ดูแผนแก้ภาษา 2026-11-12)
 * ตรวจเฉพาะโค้ดที่ไม่ใช่คอมเมนต์ และข้ามไฟล์เทสต์
 */
const BANNED: [RegExp, string][] = [
  [/ออกจากบ้าน/, 'ใช้ "ออกจากกลุ่มบ้าน" (ออกจากบ้านฟังเหมือนเดินออกไปนอกบ้าน)'],
  [/เจ้าของบ้าน/, 'ใช้ "ผู้ดูแลหลัก"'],
  [/ผู้ดูแลบ้าน/, 'ใช้ "ผู้ดูแลหลัก"'],
  [/โอนความเป็น|โอนบ้าน/, 'ใช้ "มอบบทบาทผู้ดูแลหลัก"'],
  [/โหมดทั้งหมด/, 'ใช้ "เมนู"'],
  [/นะคะ/, 'ไม่ใช้หางเสียงบอกเพศในข้อความระบบหรือข้อความที่ส่งในนามผู้ใช้'],
  [/อัพเดต/, 'ใช้ "อัปเดต"'],
  [/กฎตายตัว/, 'ศัพท์เทคนิค ใช้ "สรุปจากข้อมูลที่กรอกไว้"'],
];

const SRC = path.resolve(__dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

const stripComments = (code: string) =>
  code
    .split(String.fromCharCode(13)).join('') // ไฟล์บางไฟล์ขึ้นบรรทัดแบบ CRLF ทำให้ . ไม่จับถึงท้ายบรรทัด
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .split('\n')
    .map((line) => line.replace(/(^|\s)\/\/.*$/, '$1'))
    .join('\n');

describe('ศัพท์ในข้อความหน้าจอ', () => {
  it('ไม่มีคำเก่าที่เลิกใช้แล้ว', () => {
    const found: string[] = [];
    for (const file of walk(SRC)) {
      const code = stripComments(fs.readFileSync(file, 'utf-8'));
      for (const [re, hint] of BANNED) {
        if (re.test(code)) found.push(`${path.relative(SRC, file)}: ${re.source} -> ${hint}`);
      }
    }
    expect(found).toEqual([]);
  });
});
