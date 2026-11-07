import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as webpush from 'jsr:@negrel/webpush@0.5';
import { bangkokToday, sendDueReminders, type PushSubscriptionRow, type SendResult } from './reminders.ts';

/**
 * ส่งแจ้งเตือนนัดติดตามที่ถึงกำหนด เรียกโดย pg_cron วันละครั้ง (supabase/consult_push_cron.sql)
 * Secrets ที่ต้องตั้ง: VAPID_KEYS_JSON, VAPID_SUBJECT (SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY มีให้อยู่แล้ว)
 * ปิด verify_jwt เพราะตรวจสิทธิ์เองด้วย x-cron-secret เทียบกับ Vault
 * ไม่บันทึก endpoint หรือรหัสผู้ใช้ลง log
 */
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'not_configured' }, 500);
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  const secret = req.headers.get('x-cron-secret') ?? '';
  const { data: allowed, error: authError } = await db.rpc('consult_check_cron_secret', { p_secret: secret });
  if (authError) {
    console.error('secret check failed', authError.message);
    return json({ error: 'auth_check_failed' }, 500);
  }
  if (!secret || allowed !== true) return json({ error: 'unauthorized' }, 401);

  const keysJson = Deno.env.get('VAPID_KEYS_JSON');
  const subject = Deno.env.get('VAPID_SUBJECT');
  if (!keysJson || !subject) return json({ error: 'vapid_not_configured' }, 500);

  const vapidKeys = await webpush.importVapidKeys(JSON.parse(keysJson), { extractable: false });
  const server = await webpush.ApplicationServer.new({ contactInformation: subject, vapidKeys });

  const send = async (sub: PushSubscriptionRow, payload: string): Promise<SendResult> => {
    try {
      await server
        .subscribe({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } })
        .pushTextMessage(payload, { ttl: 86_400, urgency: webpush.Urgency.Normal });
      return 'ok';
    } catch (err) {
      if (err instanceof webpush.PushMessageError && err.isGone()) return 'gone';
      console.error('push failed', err instanceof Error ? err.name : 'unknown');
      return 'failed';
    }
  };

  const summary = await sendDueReminders(
    {
      async listDue(today) {
        const { data, error } = await db
          .from('consult_followups')
          .select('id, patient_id')
          .eq('status', 'pending')
          .lte('due_date', today)
          .is('reminded_at', null)
          .limit(500);
        if (error) throw error;
        return data ?? [];
      },
      async listSubscriptions(userIds) {
        const { data, error } = await db.from('consult_push_subscriptions').select('endpoint, user_id, p256dh, auth').in('user_id', userIds);
        if (error) throw error;
        return data ?? [];
      },
      send,
      async deleteSubscription(endpoint) {
        const { error } = await db.from('consult_push_subscriptions').delete().eq('endpoint', endpoint);
        if (error) throw error;
      },
      async markReminded(id) {
        const { error } = await db.from('consult_followups').update({ reminded_at: new Date().toISOString() }).eq('id', id);
        if (error) throw error;
      },
    },
    bangkokToday()
  );

  console.log('reminders', summary);
  return json(summary);
});
