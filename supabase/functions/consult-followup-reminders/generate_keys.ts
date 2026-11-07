// สร้างกุญแจ VAPID ครั้งเดียว: deno run supabase/functions/consult-followup-reminders/generate_keys.ts > vapid.json
// บรรทัดแรกของ stderr คือกุญแจสาธารณะสำหรับ VITE_VAPID_PUBLIC_KEY
// เนื้อหา vapid.json คือกุญแจส่วนตัว ใส่ใน Edge Function secret ชื่อ VAPID_KEYS_JSON แล้วลบไฟล์ ห้าม commit
import * as webpush from 'jsr:@negrel/webpush@0.5';

const keys = await webpush.generateVapidKeys({ extractable: true });
const exported = await webpush.exportVapidKeys(keys);
const raw = new Uint8Array(await crypto.subtle.exportKey('raw', keys.publicKey));
const publicKey = btoa(String.fromCharCode(...raw)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
console.error(publicKey);
console.log(JSON.stringify(exported));
