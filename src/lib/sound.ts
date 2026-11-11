import { loadSettings } from './settings';

let ctx: AudioContext | null = null;

/**
 * เสียง "ติ๊งนอง" สั้น ๆ สร้างจากเบราว์เซอร์เอง ไม่ต้องมีไฟล์เสียง
 * เล่นตอนมีแจ้งเตือนใหม่ขณะเปิดแอปอยู่ ปิดได้ที่ ตั้งค่า > การแจ้งเตือน
 * เบราว์เซอร์อาจบล็อกเสียงจนกว่าผู้ใช้จะเคยแตะหน้าเว็บ ถ้าถูกบล็อกจะเงียบไปเฉย ๆ
 */
export function playNotifySound(): void {
  try {
    if (!loadSettings().reminders.sound) return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx ??= new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    const start = ctx.currentTime + 0.02;
    [
      { freq: 880, at: 0 },
      { freq: 1318.5, at: 0.16 },
    ].forEach(({ freq, at }) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start + at);
      gain.gain.exponentialRampToValueAtTime(0.25, start + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + at + 0.45);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(start + at);
      osc.stop(start + at + 0.5);
    });
  } catch {
    // เล่นเสียงไม่ได้: ข้ามได้
  }
}
