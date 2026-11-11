import { describe, expect, it } from 'vitest';
import { testKey, testPayload } from '../functions/push-test/payload';

describe('แจ้งเตือนทดสอบ', () => {
  it('ข้อความมีหัวเรื่อง เนื้อหา ลิงก์กลับหน้าตั้งค่า และไม่มีข้อมูลสุขภาพ', () => {
    const p = JSON.parse(testPayload());
    expect(p.title).toContain('ทดสอบ');
    expect(p.body).toBeTruthy();
    expect(p.url).toBe('/settings/reminders');
    expect(JSON.stringify(p)).not.toMatch(/ยา|mg|โรค/);
  });

  it('กุญแจกันกดรัวเปลี่ยนทุกนาที และเหมือนกันภายในนาทีเดียวกัน', () => {
    const a = testKey(new Date('2026-11-11T10:00:05Z'));
    const b = testKey(new Date('2026-11-11T10:00:55Z'));
    const c = testKey(new Date('2026-11-11T10:01:00Z'));
    expect(a).toBe(b);
    expect(c).not.toBe(a);
    expect(a.length).toBeLessThanOrEqual(40); // ตรงกับข้อจำกัดความยาวของคอลัมน์ dose_key
  });
});
