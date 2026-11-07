-- Growa Homecare: ระบบปรึกษา ส่วนเพิ่มที่ 3 (รันต่อจาก consult_schema.sql และ consult_v2.sql รันซ้ำได้)
-- 1. ข้อมูลผู้ให้บริการละเอียดขึ้น: แนะนำตัว ที่ตั้ง ช่องทางติดต่อ รูปที่อัปโหลด
-- 2. สถานะร้าน: เปิด / ปิดชั่วคราว / ถูกแบน (แทนค่า active เดิม) และลบร้าน
-- 3. ทีมงานต่อร้านสูงสุด 5 คน พร้อมเบอร์โทร

-- ---------- 1. ข้อมูลผู้ให้บริการ ----------

alter table public.consult_providers
  add column if not exists about text not null default '' check (char_length(about) <= 2000),
  add column if not exists address text not null default '' check (char_length(address) <= 500),
  add column if not exists province text not null default '' check (char_length(province) <= 100),
  add column if not exists map_url text not null default '' check (map_url = '' or (map_url like 'https://%' and char_length(map_url) <= 500)),
  add column if not exists phone text not null default '' check (phone = '' or phone ~ '^0[0-9]{8,9}$'),
  add column if not exists line_id text not null default '' check (char_length(line_id) <= 60),
  add column if not exists contact_email text not null default '' check (contact_email = '' or (contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' and char_length(contact_email) <= 200)),
  add column if not exists website text not null default '' check (website = '' or (website like 'https://%' and char_length(website) <= 300)),
  add column if not exists status text not null default 'open' check (status in ('open', 'paused', 'banned')),
  add column if not exists status_note text not null default '' check (char_length(status_note) <= 300);

-- รูปเก็บเป็นข้อมูลภาพที่ย่อแล้วในแถวเดียวกับผู้ให้บริการ (แบบเดียวกับรูปโปรไฟล์สมาชิก) รับเฉพาะรูปหรือลิงก์ https
alter table public.consult_providers drop constraint if exists consult_providers_photo_check;
alter table public.consult_providers add constraint consult_providers_photo_check
  check (
    photo_url = ''
    or (photo_url like 'https://%' and char_length(photo_url) <= 500)
    or (photo_url ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$' and char_length(photo_url) <= 150000)
  );

-- ย้ายค่า active เดิมไปเป็นสถานะ แล้วเปลี่ยนนโยบายที่เคยอ่านค่า active
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'consult_providers' and column_name = 'active'
  ) then
    execute 'update public.consult_providers set status = case when active then ''open'' else ''paused'' end';
  end if;
end $$;

-- ทีมงานของร้านที่ถูกแบนเข้าพื้นที่ทำงานไม่ได้อีก ร้านที่ปิดชั่วคราวยังทำงานต่อกับการปรึกษาที่เปิดอยู่ได้
create or replace function public.consult_staff_provider()
returns uuid language sql stable security definer set search_path = public as $$
  select s.provider_id
  from public.consult_staff s
  join public.consult_providers p on p.id = s.provider_id
  where s.user_id = auth.uid() and s.role in ('pharmacist', 'clinic') and p.status <> 'banned';
$$;

-- ผู้ใช้เห็นเฉพาะร้านที่เปิดอยู่ และร้านที่เคยปรึกษา (เพื่อให้ประวัติและห้องสนทนาเดิมยังแสดงชื่อร้านได้แม้ร้านปิดแล้ว)
drop policy if exists consult_providers_select on public.consult_providers;
create policy consult_providers_select on public.consult_providers for select to authenticated
  using (
    status = 'open'
    or public.consult_is_admin()
    or id = public.consult_staff_provider()
    or exists (
      select 1 from public.consult_sessions s
      where s.provider_id = consult_providers.id and s.patient_id = (select auth.uid())
    )
  );

alter table public.consult_providers drop column if exists active;

-- เริ่มปรึกษาได้เฉพาะร้านที่เปิดอยู่
create or replace function public.start_consultation(
  p_session uuid,
  p_provider uuid,
  p_channel text,
  p_topic text,
  p_patient_label text,
  p_urgency text,
  p_scheduled timestamptz,
  p_checkin jsonb,
  p_brief jsonb,
  p_scopes text[],
  p_consent_version text
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  prov public.consult_providers;
  existing uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select patient_id into existing from public.consult_sessions where id = p_session;
  if existing is not null then
    if existing = uid then return p_session; end if;
    raise exception 'forbidden';
  end if;
  select * into prov from public.consult_providers where id = p_provider and status = 'open';
  if prov.id is null then raise exception 'provider_unavailable'; end if;
  if not (p_channel = any (prov.channels)) then raise exception 'channel_unavailable'; end if;
  if not ('symptoms' = any (p_scopes)) then raise exception 'consent_required'; end if;
  if coalesce(trim(p_consent_version), '') = '' then raise exception 'consent_required'; end if;
  if p_channel = 'appointment' and p_scheduled is null then raise exception 'schedule_required'; end if;
  if coalesce(p_brief #>> '{safety,level}', 'none') = 'emergency' then raise exception 'emergency_not_queued'; end if;

  insert into public.consult_sessions (id, patient_id, patient_label, provider_id, channel, topic, urgency, scheduled_at)
  values (p_session, uid, left(coalesce(p_patient_label, ''), 200), p_provider, p_channel, left(coalesce(p_topic, ''), 300),
          case when p_urgency = 'urgent' then 'urgent' else 'routine' end, p_scheduled);
  insert into public.consult_checkins (session_id, patient_id, data) values (p_session, uid, p_checkin);
  insert into public.consult_consents (session_id, patient_id, provider_id, scopes, version)
  values (p_session, uid, p_provider, p_scopes, p_consent_version);
  insert into public.consult_briefs (session_id, patient_id, snapshot) values (p_session, uid, p_brief);
  insert into public.consult_access_log (session_id, actor_id, action) values (p_session, uid, 'consent_granted');
  return p_session;
end;
$$;

-- ---------- 2. สถานะร้านและการลบ ----------

-- ปิดชั่วคราวหรือแบน คืนจำนวนการปรึกษาที่ถูกยกเลิก (แบนยกเลิกการปรึกษาที่ค้างอยู่ทั้งหมด ปิดชั่วคราวไม่ยกเลิก)
create or replace function public.admin_set_provider_status(p_provider uuid, p_status text, p_note text default '')
returns integer language plpgsql security definer set search_path = public as $$
declare
  cancelled integer := 0;
begin
  if not public.consult_is_admin() then raise exception 'forbidden'; end if;
  if p_status not in ('open', 'paused', 'banned') then raise exception 'invalid_status'; end if;
  update public.consult_providers
  set status = p_status,
      status_note = case when p_status = 'open' then '' else left(coalesce(p_note, ''), 300) end,
      is_online = case when p_status = 'open' then is_online else false end
  where id = p_provider;
  if not found then raise exception 'provider_unavailable'; end if;

  if p_status = 'banned' then
    with c as (
      update public.consult_sessions set status = 'cancelled', ended_at = now()
      where provider_id = p_provider and status in ('requested', 'active')
      returning id
    ), l as (
      insert into public.consult_access_log (session_id, actor_id, action)
      select id, auth.uid(), 'cancelled_by_admin' from c
      returning 1
    )
    select count(*) into cancelled from l;
  end if;
  return cancelled;
end;
$$;

-- ลบร้านได้เมื่อไม่มีประวัติการปรึกษาเหลืออยู่ ถ้ามีประวัติแล้วต้องแบนแทน เพื่อไม่ให้ประวัติของผู้ป่วยขาดหาย
create or replace function public.admin_delete_provider(p_provider uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.consult_is_admin() then raise exception 'forbidden'; end if;
  if not exists (select 1 from public.consult_providers where id = p_provider) then raise exception 'provider_unavailable'; end if;
  if exists (select 1 from public.consult_sessions where provider_id = p_provider) then raise exception 'provider_has_history'; end if;
  delete from public.consult_staff where provider_id = p_provider;
  delete from public.consult_providers where id = p_provider;
end;
$$;

-- ---------- 3. ทีมงาน ----------

alter table public.consult_staff
  add column if not exists phone text not null default '' check (phone = '' or phone ~ '^0[0-9]{8,9}$');

drop function if exists public.admin_list_staff();
create function public.admin_list_staff()
returns table (user_id uuid, email text, role text, provider_id uuid, phone text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.consult_is_admin() then raise exception 'forbidden'; end if;
  return query
    select s.user_id, u.email::text, s.role, s.provider_id, s.phone, s.created_at
    from public.consult_staff s join auth.users u on u.id = s.user_id
    order by s.created_at;
end;
$$;

-- ผูกบัญชีเข้าร้านพร้อมเบอร์ ผูกซ้ำเพื่อแก้เบอร์ได้ ร้านละไม่เกิน 5 คน และย้ายคนข้ามร้านเงียบ ๆ ไม่ได้
drop function if exists public.admin_assign_staff(text, uuid);
create or replace function public.admin_assign_staff(p_email text, p_provider uuid, p_phone text default '')
returns void language plpgsql security definer set search_path = public as $$
declare
  target uuid;
  prov_kind text;
  existing_provider uuid;
  has_row boolean;
  clean_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
begin
  if not public.consult_is_admin() then raise exception 'forbidden'; end if;
  if clean_phone <> '' and clean_phone !~ '^0[0-9]{8,9}$' then raise exception 'invalid_phone'; end if;
  select id into target from auth.users where lower(email) = lower(trim(p_email));
  if target is null then raise exception 'user_not_found'; end if;
  select kind into prov_kind from public.consult_providers where id = p_provider;
  if prov_kind is null then raise exception 'provider_unavailable'; end if;
  if exists (select 1 from public.consult_staff where user_id = target and role = 'admin') then
    raise exception 'target_is_admin';
  end if;
  select provider_id into existing_provider from public.consult_staff where user_id = target;
  has_row := found;
  if has_row and existing_provider is distinct from p_provider then raise exception 'staff_other_provider'; end if;
  if not has_row and (select count(*) from public.consult_staff where provider_id = p_provider) >= 5 then
    raise exception 'staff_limit';
  end if;
  insert into public.consult_staff (user_id, role, provider_id, phone) values (target, prov_kind, p_provider, clean_phone)
  on conflict (user_id) do update set phone = excluded.phone;
end;
$$;

-- ---------- สิทธิ์ ----------

revoke execute on function public.admin_set_provider_status(uuid, text, text) from public, anon;
revoke execute on function public.admin_delete_provider(uuid) from public, anon;
revoke execute on function public.admin_list_staff() from public, anon;
revoke execute on function public.admin_assign_staff(text, uuid, text) from public, anon;

grant execute on function public.admin_set_provider_status(uuid, text, text) to authenticated;
grant execute on function public.admin_delete_provider(uuid) to authenticated;
grant execute on function public.admin_list_staff() to authenticated;
grant execute on function public.admin_assign_staff(text, uuid, text) to authenticated;
