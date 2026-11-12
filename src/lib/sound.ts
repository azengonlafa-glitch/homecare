import { SETTINGS_CHANGED_EVENT, loadSettings } from './settings';

/**
 * เสียงทั้งหมดของแอปสร้างจากเบราว์เซอร์เอง (Web Audio) ไม่ต้องมีไฟล์เสียง
 * - เสียงแจ้งเตือน (ติ๊งนอง): ปิดได้ที่ ตั้งค่า > การแจ้งเตือน > เสียงแจ้งเตือน
 * - เสียงเอฟเฟกต์ตอนกดปุ่ม เปิด/ปิดสวิตช์ เปิดหน้าต่าง บันทึกสำเร็จ: ปิดได้ที่ ... > เสียงเอฟเฟกต์
 * เบราว์เซอร์อาจบล็อกเสียงจนกว่าผู้ใช้จะเคยแตะหน้าเว็บ ถ้าถูกบล็อกจะเงียบไปเฉย ๆ
 */

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx ??= new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

interface Note {
  /** ความถี่เริ่ม (Hz) */
  freq: number;
  /** ความถี่ปลาย ถ้าต้องการให้เสียงไหลขึ้น/ลง */
  to?: number;
  /** เริ่มหลังจากต้นเสียง (วินาที) */
  at?: number;
  /** ความยาว (วินาที) */
  dur: number;
  /** ความดัง 0–1 (ก่อนคูณความดังรวม) */
  vol?: number;
  type?: OscillatorType;
}

function play(notes: Note[], master = 1): void {
  const ac = audio();
  if (!ac) return;
  const start = ac.currentTime + 0.01;
  for (const { freq, to, at = 0, dur, vol = 1, type = 'sine' } of notes) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const t0 = start + at;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur * 0.8);
    const peak = Math.max(0.0002, vol * master);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.012, dur / 4));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }
}

/* ---------- เสียงแจ้งเตือน ---------- */

/** เสียง "ติ๊งนอง" ตอนมีแจ้งเตือนใหม่ขณะเปิดแอปอยู่ */
export function playNotifySound(): void {
  try {
    if (!loadSettings().reminders.sound) return;
    play([
      { freq: 880, dur: 0.45, vol: 0.25 },
      { freq: 1318.5, at: 0.16, dur: 0.45, vol: 0.25 },
    ]);
  } catch {
    // เล่นเสียงไม่ได้: ข้ามได้
  }
}

/* ---------- เสียงเอฟเฟกต์ของหน้าจอ ---------- */

export type UiSound = 'tap' | 'nav' | 'toggleOn' | 'toggleOff' | 'open' | 'close' | 'success' | 'error';

/** ความดังรวมของเสียงเอฟเฟกต์ ตั้งให้เบากว่าเสียงแจ้งเตือนมาก */
const UI_VOLUME = 0.5;

const SOUNDS: Record<UiSound, Note[]> = {
  // ป๊อปเบา ๆ เหมือนฟองสบู่แตก
  tap: [{ freq: 520, to: 780, dur: 0.07, vol: 0.12 }],
  // ก๊อกไม้สั้น ๆ ตอนเปลี่ยนเมนู
  nav: [{ freq: 990, to: 740, dur: 0.09, vol: 0.14, type: 'triangle' }],
  // เปิดสวิตช์: สองโน้ตขึ้น / ปิดสวิตช์: สองโน้ตลง
  toggleOn: [
    { freq: 660, dur: 0.08, vol: 0.13, type: 'triangle' },
    { freq: 990, at: 0.06, dur: 0.1, vol: 0.13, type: 'triangle' },
  ],
  toggleOff: [
    { freq: 760, dur: 0.08, vol: 0.12, type: 'triangle' },
    { freq: 500, at: 0.06, dur: 0.1, vol: 0.12, type: 'triangle' },
  ],
  // หน้าต่างเลื่อนขึ้น / ลง
  open: [{ freq: 330, to: 720, dur: 0.16, vol: 0.1 }],
  close: [{ freq: 640, to: 300, dur: 0.14, vol: 0.09 }],
  // สำเร็จ: กระดิ่งไล่ขึ้น โด-มี-ซอล
  success: [
    { freq: 784, dur: 0.22, vol: 0.13, type: 'triangle' },
    { freq: 988, at: 0.08, dur: 0.22, vol: 0.13, type: 'triangle' },
    { freq: 1319, at: 0.16, dur: 0.38, vol: 0.13, type: 'triangle' },
  ],
  // ผิดพลาด: สองโน้ตต่ำลง นุ่ม ไม่ตกใจ
  error: [
    { freq: 392, dur: 0.16, vol: 0.14, type: 'triangle' },
    { freq: 294, at: 0.13, dur: 0.26, vol: 0.14, type: 'triangle' },
  ],
};

let uiSoundOn: boolean | null = null;
function uiSoundEnabled(): boolean {
  if (uiSoundOn === null) {
    uiSoundOn = loadSettings().reminders.uiSound;
    window.addEventListener(SETTINGS_CHANGED_EVENT, () => {
      uiSoundOn = loadSettings().reminders.uiSound;
    });
  }
  return uiSoundOn;
}

/** เล่นเสียงเอฟเฟกต์ (ไม่เล่นถ้าผู้ใช้ปิดเสียงเอฟเฟกต์ไว้) */
export function playUiSound(name: UiSound, force = false): void {
  try {
    if (!force && !uiSoundEnabled()) return;
    play(SOUNDS[name], UI_VOLUME);
  } catch {
    // เล่นเสียงไม่ได้: ข้ามได้
  }
}

const TOGGLE = 'input[type="checkbox"], input[type="radio"], [role="switch"], [role="checkbox"], [role="menuitemcheckbox"]';
const NAV = 'nav a[href], [role="tab"]';
const PRESSABLE = 'button, a[href], [role="button"], [role="option"], label, summary, select';

function isChecked(el: Element): boolean {
  if (el instanceof HTMLInputElement) return el.checked;
  return el.getAttribute('aria-checked') === 'true';
}

/**
 * ฟังการกดทั้งหน้าครั้งเดียว แล้วเลือกเสียงตามชนิดของสิ่งที่กด
 * ใส่ data-sound="off" ที่ปุ่ม (หรือกล่องที่ครอบ) เพื่อไม่ให้มีเสียง
 * หรือ data-sound="success" เป็นต้น เพื่อกำหนดเสียงเอง
 * คืนฟังก์ชันสำหรับเลิกฟัง
 */
export function installUiSounds(root: Document | HTMLElement = document): () => void {
  const onClick = (e: Event) => {
    const target = e.target as Element | null;
    if (!target || !(target instanceof Element)) return;

    const custom = target.closest<HTMLElement>('[data-sound]')?.dataset.sound;
    if (custom === 'off') return;

    const pressable = target.closest(`${TOGGLE}, ${NAV}, ${PRESSABLE}`);
    if (!pressable) return;
    if ((pressable as HTMLButtonElement).disabled || pressable.getAttribute('aria-disabled') === 'true') return;

    if (custom && custom in SOUNDS) {
      playUiSound(custom as UiSound);
      return;
    }

    // ป้ายที่ครอบช่องติ๊ก: ใช้เสียงของช่องติ๊ก (เบราว์เซอร์จะส่ง click ไปที่ช่องติ๊กอีกครั้ง จึงข้ามรอบของป้าย)
    if (pressable.tagName === 'LABEL') {
      const control = (pressable as HTMLLabelElement).control;
      if (control && control.matches(TOGGLE)) return;
    }

    const toggle = target.closest(TOGGLE);
    if (toggle) {
      // รอให้หน้าเปลี่ยนสถานะเสร็จก่อน แล้วค่อยอ่านว่าเปิดหรือปิด
      window.setTimeout(() => {
        if (toggle instanceof HTMLInputElement && toggle.type === 'radio') playUiSound('tap');
        else playUiSound(isChecked(toggle) ? 'toggleOn' : 'toggleOff');
      }, 0);
      return;
    }

    if (target.closest(NAV)) {
      playUiSound('nav');
      return;
    }

    playUiSound('tap');
  };

  root.addEventListener('click', onClick);
  return () => root.removeEventListener('click', onClick);
}
