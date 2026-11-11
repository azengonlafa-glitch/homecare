-- Growa Homecare: แจ้งเตือนถึงเวลากินยานอกเว็บ (Web Push)
-- รันหลัง deploy Edge Function med-dose-reminders และหลัง consult_v2.sql / consult_push_cron.sql
-- ใช้ความลับ cron ตัวเดิม (consult_cron_secret) ไม่ต้องสร้างใหม่

-- กันส่งซ้ำ: หนึ่งแถวต่อผู้ใช้ต่อมื้อ (รหัส yyyy-mm-dd:ช่วงเวลา) เข้าถึงได้เฉพาะ service role
create table if not exists public.med_push_sent (
  user_id uuid not null references auth.users (id) on delete cascade,
  dose_key text not null check (char_length(dose_key) <= 40),
  sent_at timestamptz not null default now(),
  primary key (user_id, dose_key)
);
alter table public.med_push_sent enable row level security;
revoke all on public.med_push_sent from anon, authenticated;

-- ล้างบันทึกที่เก่ากว่า 3 วันทุกคืน (ไม่ต้องใช้แล้ว)
select cron.schedule(
  'med-push-sent-cleanup',
  '30 19 * * *',
  $$ delete from public.med_push_sent where sent_at < now() - interval '3 days' $$
);

-- ตรวจเวลากินยาทุก 5 นาที
select cron.schedule(
  'med-dose-reminders',
  '*/5 * * * *',
  $job$
  select net.http_post(
    url := 'https://idczulbdpkndboxjguyk.supabase.co/functions/v1/med-dose-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'consult_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $job$
);
