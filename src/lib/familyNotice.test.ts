import { describe, expect, it } from 'vitest';
import { familyNoticeText } from './medAlerts';

const alert = {
  form: 'tablet' as const,
  period: 'morning' as const,
  body: 'ยาสมมติ (เวลา 08:00 น.) ยังไม่ได้บันทึก',
  dueTime: '08:00',
  round: 2,
};

describe('ข้อความแจ้งคนในบ้านเมื่อสมาชิกยังไม่ได้กินยา', () => {
  it('เปิดแชร์ข้อมูล: บอกชื่อยา', () => {
    const t = familyNoticeText('คุณสมมติ', alert, true);
    expect(t.body).toContain('ยาสมมติ');
  });

  it('ปิดแชร์ข้อมูล: ไม่มีชื่อยาทั้งในหัวข้อและเนื้อความ แต่ยังบอกมื้อและเวลา', () => {
    const t = familyNoticeText('คุณสมมติ', alert, false);
    expect(t.title).not.toContain('ยาสมมติ');
    expect(t.body).not.toContain('ยาสมมติ');
    expect(t.title).toContain('คุณสมมติ');
    expect(t.body).toContain('08:00');
    expect(t.body).toContain('ช่วยโทรถามหรือแวะดูหน่อย');
  });
});
