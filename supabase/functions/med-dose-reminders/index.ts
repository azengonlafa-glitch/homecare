import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as webpush from 'jsr:@negrel/webpush@0.5';
import { sendDoseReminders, type PushSubscriptionRow, type SendResult } from './doses.ts';

/**
 * ส่งแจ้งเตือนถึงเวลากินยา เรียกโดย pg_cron ทุก 5 นาที (supabase/med_push.sql)
 * ใช้ Secrets ชุดเดียวกับ consult-followup-reminders: VAPID_KEYS_JSON, VAPID_SUBJECT
 * ปิด verify_jwt เพราะตรวจสิทธิ์เองด้วย x-cron-secret เทียบกับ Vault
 * ข้อความไม่มีชื่อยา และไม่บันทึก endpoint หรือรหัสผู้ใช้ลง log
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
        .pushTextMessage(payload, { ttl: 1_800, urgency: webpush.Urgency.High });
      return 'ok';
    } catch (err) {
      if (err instanceof webpush.PushMessageError && err.isGone()) return 'gone';
      console.error('push failed', err instanceof Error ? err.name : 'unknown');
      return 'failed';
    }
  };

  try {
    const summary = await sendDoseReminders({
      async listUsers() {
        const { data: subs, error: subError } = await db.from('consult_push_subscriptions').select('user_id').limit(5000);
        if (subError) throw subError;
        const ids = [...new Set((subs ?? []).map((s: { user_id: string }) => s.user_id))];
        if (ids.length === 0) return [];
        const { data: docs, error } = await db
          .from('user_docs')
          .select('user_id, key, data')
          .in('user_id', ids)
          .in('key', ['meds', 'settings']);
        if (error) throw error;
        return ids.map((id) => {
          // deno-lint-ignore no-explicit-any
          const mine = (docs ?? []).filter((d: { user_id: string }) => d.user_id === id) as { key: string; data: any }[];
          const settings = mine.find((d) => d.key === 'settings')?.data;
          return {
            user_id: id,
            meds: mine.find((d) => d.key === 'meds')?.data ?? null,
            doseReminders: settings?.reminders?.doseWindow !== false,
          };
        });
      },
      async listSubscriptions(userIds) {
        if (userIds.length === 0) return [];
        const { data, error } = await db.from('consult_push_subscriptions').select('endpoint, user_id, p256dh, auth').in('user_id', userIds);
        if (error) throw error;
        return data ?? [];
      },
      async claim(userId, key) {
        const { error } = await db.from('med_push_sent').insert({ user_id: userId, dose_key: key });
        if (!error) return true;
        if (error.code === '23505') return false; // เคยส่งไปแล้ว
        throw error;
      },
      async release(userId, key) {
        await db.from('med_push_sent').delete().eq('user_id', userId).eq('dose_key', key);
      },
      send,
      async deleteSubscription(endpoint) {
        const { error } = await db.from('consult_push_subscriptions').delete().eq('endpoint', endpoint);
        if (error) throw error;
      },
    });
    console.log('dose reminders', summary);
    return json(summary);
  } catch (err) {
    console.error('dose reminders failed', err instanceof Error ? err.message : 'unknown');
    return json({ error: 'failed' }, 500);
  }
});
