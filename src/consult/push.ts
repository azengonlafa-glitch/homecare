import { requireClient } from '../cloud/client';
import { cloudEnabled } from '../cloud/client';

/**
 * สมัครรับแจ้งเตือนนัดติดตามจากเซิร์ฟเวอร์ (Web Push) ใช้ได้แม้ปิดแอป
 * ข้อความแจ้งเตือนไม่มีข้อมูลสุขภาพ เพราะอาจขึ้นบนหน้าจอล็อก
 */
/**
 * กุญแจสาธารณะ (VAPID public key) ฝังในโค้ดได้ เพราะเบราว์เซอร์ทุกเครื่องต้องเห็นอยู่แล้ว ไม่ใช่ความลับ
 * จึงไม่ต้องตั้งตัวแปรบน Vercel ส่วนกุญแจส่วนตัวอยู่ใน Edge Function secret เท่านั้น ห้ามใส่ที่นี่
 * ถ้าเปลี่ยนคู่กุญแจ ให้แก้ค่านี้หรือตั้ง VITE_VAPID_PUBLIC_KEY ทับ
 */
const DEFAULT_PUBLIC_KEY = 'BAGKElp2iQkzolqVCeY4UPWelJZ2sG9WREAwcsdGRhY8JR97z0e3lIlhU5pUWGwgMNPOAJjRia30t_COKcE8Ixc';
const PUBLIC_KEY = ((import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ?? DEFAULT_PUBLIC_KEY).trim();

export type PushState = 'unavailable' | 'needs-install' | 'blocked' | 'off' | 'on';

const hasPushApi = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** iPhone/iPad รับแจ้งเตือนจากเว็บได้เมื่อเพิ่มลงหน้าจอโฮมแล้วเท่านั้น */
const isIosBrowserTab = () =>
  typeof navigator !== 'undefined' &&
  /iPad|iPhone|iPod/.test(navigator.userAgent) &&
  !window.matchMedia('(display-mode: standalone)').matches;

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration('/');
  return registration ? registration.pushManager.getSubscription() : null;
}

export async function getPushState(): Promise<PushState> {
  // เปิดได้ทันทีที่เชื่อม Supabase ไม่ต้องรอเปิดระบบปรึกษาจริง เพราะแจ้งเตือนกินยาใช้ตารางสมัครรับแจ้งเตือนเดียวกัน
  if (!cloudEnabled || !PUBLIC_KEY) return 'unavailable';
  if (!hasPushApi()) return isIosBrowserTab() ? 'needs-install' : 'unavailable';
  if (Notification.permission === 'denied') return 'blocked';
  return (await currentSubscription()) ? 'on' : 'off';
}

function keyToBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64url.length / 4) * 4, '=');
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export async function enablePush(): Promise<PushState> {
  if (Notification.permission !== 'granted') {
    const answer = await Notification.requestPermission();
    if (answer !== 'granted') return answer === 'denied' ? 'blocked' : 'off';
  }
  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(PUBLIC_KEY) }));
  const json = subscription.toJSON();
  const { error } = await requireClient().rpc('save_push_subscription', {
    p_endpoint: subscription.endpoint,
    p_p256dh: json.keys?.p256dh ?? '',
    p_auth: json.keys?.auth ?? '',
  });
  if (error) {
    // เก็บที่เซิร์ฟเวอร์ไม่ได้ก็รับแจ้งเตือนไม่ได้ อย่าทิ้งสถานะว่าเปิดแล้ว
    await subscription.unsubscribe();
    throw error;
  }
  return 'on';
}

export async function disablePush(): Promise<PushState> {
  const subscription = await currentSubscription();
  if (subscription) {
    const { error } = await requireClient().from('consult_push_subscriptions').delete().eq('endpoint', subscription.endpoint);
    if (error) throw error;
    await subscription.unsubscribe();
  }
  return 'off';
}

/** เรียกก่อนออกจากระบบ ห้ามทำให้การออกจากระบบค้างหรือพัง */
export async function unsubscribeOnSignOut(): Promise<void> {
  if (!cloudEnabled || !hasPushApi()) return;
  await Promise.race([disablePush().catch(() => undefined), new Promise((resolve) => window.setTimeout(resolve, 3000))]);
}
