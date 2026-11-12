import { describe, expect, it } from 'vitest';
import { shouldAskPush } from './pushPrompt';
import type { PushState } from './push';

describe('ชวนเปิดแจ้งเตือนผู้ใช้ใหม่', () => {
  it('ถามเฉพาะเมื่อเปิดใช้ได้และยังไม่เคยตอบ', () => {
    const asks = (['off', 'needs-install'] as PushState[]).map((s) => shouldAskPush(s, false));
    expect(asks).toEqual([true, true]);
  });

  it('ไม่ถามเมื่อเปิดอยู่แล้ว ถูกบล็อก หรือเครื่องไม่รองรับ', () => {
    for (const s of ['on', 'blocked', 'unavailable'] as PushState[]) expect(shouldAskPush(s, false)).toBe(false);
  });

  it('ตอบแล้วไม่ถามซ้ำ ไม่ว่าสถานะใด', () => {
    for (const s of ['off', 'needs-install', 'on', 'blocked', 'unavailable'] as PushState[]) expect(shouldAskPush(s, true)).toBe(false);
  });
});
