/** ข้อความแจ้งเตือนทดสอบ ไม่มีข้อมูลสุขภาพ เพราะอาจขึ้นบนหน้าจอล็อก */
export const testPayload = (): string =>
  JSON.stringify({
    title: 'Growa: ทดสอบแจ้งเตือน',
    body: 'ถ้าเห็นข้อความนี้ แปลว่าแจ้งเตือนถึงเครื่องนี้แล้ว',
    url: '/settings/reminders',
    tag: 'growa-test',
  });

/** กุญแจกันกดรัว: ส่งทดสอบได้ไม่เกินหนึ่งครั้งต่อนาทีต่อผู้ใช้ (ใช้ตาราง med_push_sent เดิม ไม่ต้องรัน SQL เพิ่ม) */
export const testKey = (now: Date = new Date()): string => `test:${now.toISOString().slice(0, 16)}`;
