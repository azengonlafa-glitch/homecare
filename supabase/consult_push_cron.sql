-- Growa Homecare: ตั้งเวลาส่งแจ้งเตือนนัดติดตามทุกวัน 09:00 น. ไทย (02:00 UTC)
-- รันหลัง deploy Edge Function consult-followup-reminders แล้ว แทนค่า <project-ref> ก่อนรัน
-- ความลับของ cron สุ่มใน Vault ไม่อยู่ในโค้ด และไม่มีใครต้องคัดลอกค่านี้

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'consult_cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'consult_cron_secret');
  end if;
end $$;

-- Edge Function ใช้ตรวจว่าคำขอมาจาก cron จริง เรียกได้เฉพาะ service role
create or replace function public.consult_check_cron_secret(p_secret text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'consult_cron_secret' and decrypted_secret = p_secret);
$$;
revoke execute on function public.consult_check_cron_secret(text) from public, anon, authenticated;
grant execute on function public.consult_check_cron_secret(text) to service_role;

select cron.schedule(
  'consult-followup-reminders',
  '0 2 * * *',
  $job$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/consult-followup-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'consult_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $job$
);
