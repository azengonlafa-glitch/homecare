import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as webpush from 'jsr:@negrel/webpush@0.5';
import { testKey, testPayload } from './payload.ts';

/**
 * ส่งแจ้งเตือนทดสอบให้ "เครื่องของผู้ที่กดปุ่ม" เท่านั้น (เปิด verify_jwt ไว้ตามค่าเริ่มต้น ต้องล็อกอิน)
 * ใช้ VAPID secrets ชุดเดียวกับ med-dose-reminders และกันกดรัวด้วยตาราง med_push_sent
 * ไม่บันทึก endpoint หรือรหัสผู้ใช้ลง log
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const keysJson = Deno.env.get('VAPID_KEYS_JSON');
  const subject = Deno.env.get('VAPID_SUBJECT');
  if (!url || !serviceKey) return json({ error: 'not_configured' }, 500);
  if (!keysJson || !subject) return json({ error: 'vapid_not_configured' }, 500);

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  // ระบุตัวผู้ใช้จากโทเค็นที่ส่งมา ไม่เชื่อรหัสผู้ใช้ที่ส่งมาในเนื้อความ
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user) return json({ error: 'unauthorized' }, 401);
  const userId = auth.user.id;

  const { data: subs, error: subError } = await db.from('consult_push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', userId);
  if (subError) {
    console.error('subscription lookup failed', subError.message);
    return json({ error: 'failed' }, 500);
  }
  if (!subs || subs.length === 0) return json({ devices: 0, sent: 0, failed: 0 });

  const key = testKey();
  const { error: claimError } = await db.from('med_push_sent').insert({ user_id: userId, dose_key: key });
  if (claimError) {
    if (claimError.code === '23505') return json({ error: 'too_soon' }, 429);
    console.error('claim failed', claimError.message);
    return json({ error: 'failed' }, 500);
  }

  const vapidKeys = await webpush.importVapidKeys(JSON.parse(keysJson), { extractable: false });
  const server = await webpush.ApplicationServer.new({ contactInformation: subject, vapidKeys });
  const payload = testPayload();

  let sent = 0;
  let failed = 0;
  for (const sub of subs as { endpoint: string; p256dh: string; auth: string }[]) {
    try {
      await server.subscribe({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }).pushTextMessage(payload, { ttl: 300, urgency: webpush.Urgency.High });
      sent += 1;
    } catch (err) {
      if (err instanceof webpush.PushMessageError && err.isGone()) {
        await db.from('consult_push_subscriptions').delete().eq('endpoint', sub.endpoint);
      }
      failed += 1;
      console.error('test push failed', err instanceof Error ? err.name : 'unknown');
    }
  }
  return json({ devices: subs.length, sent, failed });
});
