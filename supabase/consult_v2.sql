-- Growa Homecare: ระบบปรึกษา ส่วนเพิ่ม (รันต่อจาก consult_schema.sql รันซ้ำได้)
-- 1. หน้าแอดมินจัดการผู้ให้บริการและบัญชีเจ้าหน้าที่
-- 2. ผู้ใช้ลบข้อมูลการปรึกษาของตัวเอง (PDPA)
-- 3. ที่เก็บการสมัครรับแจ้งเตือน Web Push
-- 4. ตั้งเวลานัดในห้องสนทนา

-- ---------- 1. แอดมิน ----------
-- แอดมินเห็นและผูกบัญชีเจ้าหน้าที่ได้ แต่ตั้งแอดมินคนใหม่ไม่ได้ (ทำจาก SQL Editor เท่านั้น) และยังอ่านข้อมูลสุขภาพไม่ได้

create or replace function public.admin_list_staff()
returns table (user_id uuid, email text, role text, provider_id uuid, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.consult_is_admin() then raise exception 'forbidden'; end if;
  return query
    select s.user_id, u.email::text, s.role, s.provider_id, s.created_at
    from public.consult_staff s join auth.users u on u.id = s.user_id
    order by s.created_at;
end;
$$;

-- บทบาทตามประเภทผู้ให้บริการ เพื่อไม่ให้เลือกไม่ตรงกัน
create or replace function public.admin_assign_staff(p_email text, p_provider uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  target uuid;
  prov_kind text;
begin
  if not public.consult_is_admin() then raise exception 'forbidden'; end if;
  select id into target from auth.users where lower(email) = lower(trim(p_email));
  if target is null then raise exception 'user_not_found'; end if;
  select kind into prov_kind from public.consult_providers where id = p_provider;
  if prov_kind is null then raise exception 'provider_unavailable'; end if;
  if exists (select 1 from public.consult_staff where user_id = target and role = 'admin') then
    raise exception 'target_is_admin';
  end if;
  insert into public.consult_staff (user_id, role, provider_id) values (target, prov_kind, p_provider)
  on conflict (user_id) do update set role = excluded.role, provider_id = excluded.provider_id;
end;
$$;

create or replace function public.admin_remove_staff(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.consult_is_admin() then raise exception 'forbidden'; end if;
  delete from public.consult_staff where user_id = p_user and role <> 'admin';
  if not found then raise exception 'forbidden'; end if;
end;
$$;

-- ---------- 2. ลบข้อมูลตามคำขอ ----------

-- เก็บแค่ว่ามีการลบเมื่อไร ไม่เก็บข้อมูลสุขภาพ เพื่อใช้เป็นหลักฐานว่าดำเนินการตามคำขอแล้ว
create table if not exists public.consult_erasure_log (
  id bigint generated always as identity primary key,
  patient_id uuid references auth.users (id) on delete set null,
  session_id uuid not null,
  at timestamptz not null default now()
);
create index if not exists consult_erasure_log_patient_idx on public.consult_erasure_log (patient_id);
alter table public.consult_erasure_log enable row level security;
drop policy if exists consult_erasure_log_select on public.consult_erasure_log;
create policy consult_erasure_log_select on public.consult_erasure_log for select to authenticated
  using (patient_id = (select auth.uid()) or public.consult_is_admin());

create or replace function public.consult_is_session_patient(sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.consult_sessions s where s.id = sid and s.patient_id = auth.uid());
$$;

drop policy if exists consult_files_delete on storage.objects;
create policy consult_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'consult-files' and public.consult_is_session_patient(((storage.foldername(name))[1])::uuid));

-- ลบทั้งการปรึกษา รวมข้อความ แบบสอบถาม Brief บันทึกของเภสัชกร และนัดติดตาม (ตามลูกโซ่ของ foreign key)
-- ต้องลบไฟล์ก่อน และต้องปิดการปรึกษาก่อน เพื่อไม่ให้ลบระหว่างที่เภสัชกรกำลังดูแลอยู่
create or replace function public.delete_consult_session(p_session uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  s public.consult_sessions;
begin
  select * into s from public.consult_sessions where id = p_session for update;
  if s.id is null or s.patient_id is distinct from auth.uid() then raise exception 'forbidden'; end if;
  if s.status in ('requested', 'active') then raise exception 'session_open'; end if;
  if exists (
    select 1 from storage.objects o
    where o.bucket_id = 'consult-files' and (storage.foldername(o.name))[1] = p_session::text
  ) then
    raise exception 'files_remaining';
  end if;
  insert into public.consult_erasure_log (patient_id, session_id) values (auth.uid(), p_session);
  delete from public.consult_sessions where id = p_session;
end;
$$;

-- ---------- 3. แจ้งเตือน ----------

alter table public.consult_followups add column if not exists reminded_at timestamptz;

create table if not exists public.consult_push_subscriptions (
  endpoint text primary key check (endpoint like 'https://%' and char_length(endpoint) <= 1000),
  user_id uuid not null references auth.users (id) on delete cascade,
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  created_at timestamptz not null default now()
);
create index if not exists consult_push_subscriptions_user_idx on public.consult_push_subscriptions (user_id);
alter table public.consult_push_subscriptions enable row level security;

drop policy if exists consult_push_select on public.consult_push_subscriptions;
create policy consult_push_select on public.consult_push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists consult_push_delete on public.consult_push_subscriptions;
create policy consult_push_delete on public.consult_push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

-- ผ่านฟังก์ชัน เพราะเบราว์เซอร์เดียวกันอาจเปลี่ยนบัญชี: เครื่องนี้ต้องรับแจ้งเตือนของบัญชีล่าสุดเท่านั้น
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  insert into public.consult_push_subscriptions (endpoint, user_id, p256dh, auth)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth;
end;
$$;

-- ---------- 4. เวลานัด ----------
-- นัดหมายไม่ใช่ช่องทางที่ต้องเลือกตอนเริ่ม ตั้งหรือเปลี่ยนได้ในห้องสนทนาระหว่างที่การปรึกษายังเปิดอยู่

create or replace function public.set_consult_schedule(p_session uuid, p_when timestamptz)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.consult_is_participant(p_session) then raise exception 'forbidden'; end if;
  if p_when is null or p_when <= now() then raise exception 'schedule_required'; end if;
  update public.consult_sessions set scheduled_at = p_when
  where id = p_session and status in ('requested', 'active');
  if not found then raise exception 'invalid_transition'; end if;
end;
$$;

-- ---------- สิทธิ์ ----------

revoke all on public.consult_erasure_log, public.consult_push_subscriptions from anon, authenticated;
grant select on public.consult_erasure_log to authenticated;
grant select, delete on public.consult_push_subscriptions to authenticated;

revoke execute on function public.admin_list_staff() from public, anon;
revoke execute on function public.admin_assign_staff(text, uuid) from public, anon;
revoke execute on function public.admin_remove_staff(uuid) from public, anon;
revoke execute on function public.consult_is_session_patient(uuid) from public, anon;
revoke execute on function public.delete_consult_session(uuid) from public, anon;
revoke execute on function public.save_push_subscription(text, text, text) from public, anon;
revoke execute on function public.set_consult_schedule(uuid, timestamptz) from public, anon;

grant execute on function public.admin_list_staff() to authenticated;
grant execute on function public.admin_assign_staff(text, uuid) to authenticated;
grant execute on function public.admin_remove_staff(uuid) to authenticated;
grant execute on function public.consult_is_session_patient(uuid) to authenticated;
grant execute on function public.delete_consult_session(uuid) to authenticated;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;
grant execute on function public.set_consult_schedule(uuid, timestamptz) to authenticated;
