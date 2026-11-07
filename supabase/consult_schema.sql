-- Growa Homecare: ระบบปรึกษาเภสัชกร/คลินิก (Smart Consultation)
-- ไฟล์นี้แยกจาก schema.sql รันซ้ำได้ ไม่แตะตารางเดิม
--
-- หลักการ
-- 1. ข้อมูลปรึกษาไม่อยู่ใน home_items เพราะสมาชิกทุกคนในบ้านอ่าน home_items ได้
-- 2. ผู้ให้บริการอ่านข้อมูลสุขภาพได้ทางเดียวคือ open_consult_brief() ซึ่งตรวจความยินยอมและบันทึกการเข้าถึงทุกครั้ง
-- 3. บทบาทเจ้าหน้าที่กำหนดในตาราง consult_staff เท่านั้น ผู้ใช้ตั้งเองไม่ได้ และแอดมินอ่านข้อมูลสุขภาพไม่ได้

-- ---------- ตาราง ----------

create table if not exists public.consult_providers (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('pharmacist', 'clinic')),
  display_name text not null,
  photo_url text not null default '',
  specialties text[] not null default '{}',
  org_name text not null default '',
  license_no text not null default '',
  hours text not null default '',
  channels text[] not null default '{chat}',
  is_online boolean not null default false,
  rating numeric(2, 1) check (rating is null or (rating >= 0 and rating <= 5)),
  review_count integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.consult_staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('pharmacist', 'clinic', 'admin')),
  provider_id uuid references public.consult_providers (id) on delete set null,
  created_at timestamptz not null default now(),
  check (role = 'admin' or provider_id is not null)
);
create index if not exists consult_staff_provider_idx on public.consult_staff (provider_id);

create table if not exists public.consult_sessions (
  id uuid primary key,
  patient_id uuid not null references auth.users (id) on delete cascade,
  patient_label text not null default '',
  provider_id uuid not null references public.consult_providers (id) on delete restrict,
  channel text not null check (channel in ('chat', 'voice', 'video', 'appointment')),
  status text not null default 'requested' check (status in ('requested', 'active', 'completed', 'cancelled')),
  topic text not null default '',
  urgency text not null default 'routine' check (urgency in ('routine', 'urgent')),
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz
);
create index if not exists consult_sessions_patient_idx on public.consult_sessions (patient_id, created_at desc);
create index if not exists consult_sessions_provider_idx on public.consult_sessions (provider_id, status);

-- ผลแบบสอบถามแต่ละครั้ง มีเวลาของตัวเอง แก้ไขย้อนหลังไม่ได้ และแยกจากข้อมูลสุขภาพพื้นฐานใน user_docs
create table if not exists public.consult_checkins (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.consult_sessions (id) on delete cascade,
  patient_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null check (pg_column_size(data) < 262144),
  created_at timestamptz not null default now()
);
create index if not exists consult_checkins_patient_idx on public.consult_checkins (patient_id);

create table if not exists public.consult_consents (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.consult_sessions (id) on delete cascade,
  patient_id uuid not null references auth.users (id) on delete cascade,
  provider_id uuid not null references public.consult_providers (id) on delete restrict,
  scopes text[] not null check (scopes <@ array['overview','history','allergies','medications','symptoms','previous']::text[]),
  version text not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists consult_consents_patient_idx on public.consult_consents (patient_id);
create index if not exists consult_consents_provider_idx on public.consult_consents (provider_id);

create table if not exists public.consult_briefs (
  session_id uuid primary key references public.consult_sessions (id) on delete cascade,
  patient_id uuid not null references auth.users (id) on delete cascade,
  snapshot jsonb not null check (pg_column_size(snapshot) < 524288),
  created_at timestamptz not null default now()
);
create index if not exists consult_briefs_patient_idx on public.consult_briefs (patient_id);

create table if not exists public.consult_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.consult_sessions (id) on delete cascade,
  sender_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  sender_role text not null default 'patient' check (sender_role in ('patient', 'staff')),
  body text not null default '' check (char_length(body) <= 4000),
  attachments jsonb not null default '[]' check (jsonb_typeof(attachments) = 'array' and pg_column_size(attachments) < 16384),
  created_at timestamptz not null default now(),
  check (char_length(trim(body)) > 0 or jsonb_array_length(attachments) > 0)
);
create index if not exists consult_messages_session_idx on public.consult_messages (session_id, created_at);
create index if not exists consult_messages_sender_idx on public.consult_messages (sender_id);

create table if not exists public.consult_notes (
  session_id uuid primary key references public.consult_sessions (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  assessment text not null default '',
  medication_advice text not null default '',
  recommendation text not null default '',
  referral text not null default '',
  follow_up_plan text not null default '',
  follow_up_due date,
  confirmed_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists consult_notes_author_idx on public.consult_notes (author_id);

create table if not exists public.consult_followups (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.consult_sessions (id) on delete cascade,
  patient_id uuid not null references auth.users (id) on delete cascade,
  provider_id uuid not null references public.consult_providers (id) on delete restrict,
  due_date date not null,
  plan text not null default '',
  status text not null default 'pending' check (status in ('pending', 'responded', 'reviewed')),
  response jsonb check (response is null or pg_column_size(response) < 65536),
  responded_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists consult_followups_session_idx on public.consult_followups (session_id);
create index if not exists consult_followups_patient_idx on public.consult_followups (patient_id, due_date);
create index if not exists consult_followups_provider_idx on public.consult_followups (provider_id);

-- บันทึกว่าใครเปิดดูข้อมูลสุขภาพเมื่อไร (เพิ่มได้ผ่านฟังก์ชันเท่านั้น แก้และลบไม่ได้)
create table if not exists public.consult_access_log (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.consult_sessions (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  at timestamptz not null default now()
);
create index if not exists consult_access_log_session_idx on public.consult_access_log (session_id, at desc);
create index if not exists consult_access_log_actor_idx on public.consult_access_log (actor_id);

-- ---------- ฟังก์ชันช่วยตรวจสิทธิ์ ----------

create or replace function public.consult_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.consult_staff where user_id = auth.uid() and role = 'admin');
$$;

create or replace function public.consult_staff_provider()
returns uuid language sql stable security definer set search_path = public as $$
  select provider_id from public.consult_staff where user_id = auth.uid() and role in ('pharmacist', 'clinic');
$$;

create or replace function public.consult_is_participant(sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.consult_sessions s
    where s.id = sid
      and auth.uid() is not null
      and (s.patient_id = auth.uid() or s.provider_id = public.consult_staff_provider())
  );
$$;

create or replace function public.consult_is_session_staff(sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.consult_sessions s
    where s.id = sid and s.provider_id = public.consult_staff_provider()
  );
$$;

-- ---------- Row Level Security ----------

alter table public.consult_providers enable row level security;
alter table public.consult_staff enable row level security;
alter table public.consult_sessions enable row level security;
alter table public.consult_checkins enable row level security;
alter table public.consult_consents enable row level security;
alter table public.consult_briefs enable row level security;
alter table public.consult_messages enable row level security;
alter table public.consult_notes enable row level security;
alter table public.consult_followups enable row level security;
alter table public.consult_access_log enable row level security;

drop policy if exists consult_providers_select on public.consult_providers;
create policy consult_providers_select on public.consult_providers for select to authenticated
  using (active or public.consult_is_admin() or id = public.consult_staff_provider());
drop policy if exists consult_providers_admin_insert on public.consult_providers;
create policy consult_providers_admin_insert on public.consult_providers for insert to authenticated
  with check (public.consult_is_admin());
drop policy if exists consult_providers_admin_update on public.consult_providers;
create policy consult_providers_admin_update on public.consult_providers for update to authenticated
  using (public.consult_is_admin()) with check (public.consult_is_admin());

-- ไม่มี policy เขียน: กำหนดบทบาทได้จาก SQL Editor เท่านั้น
drop policy if exists consult_staff_select on public.consult_staff;
create policy consult_staff_select on public.consult_staff for select to authenticated
  using (user_id = (select auth.uid()) or public.consult_is_admin());

drop policy if exists consult_sessions_select on public.consult_sessions;
create policy consult_sessions_select on public.consult_sessions for select to authenticated
  using (patient_id = (select auth.uid()) or provider_id = public.consult_staff_provider());

drop policy if exists consult_checkins_select on public.consult_checkins;
create policy consult_checkins_select on public.consult_checkins for select to authenticated
  using (patient_id = (select auth.uid()));

drop policy if exists consult_consents_select on public.consult_consents;
create policy consult_consents_select on public.consult_consents for select to authenticated
  using (patient_id = (select auth.uid()) or provider_id = public.consult_staff_provider());

drop policy if exists consult_briefs_select on public.consult_briefs;
create policy consult_briefs_select on public.consult_briefs for select to authenticated
  using (patient_id = (select auth.uid()));

drop policy if exists consult_messages_select on public.consult_messages;
create policy consult_messages_select on public.consult_messages for select to authenticated
  using (public.consult_is_participant(session_id));
drop policy if exists consult_messages_insert on public.consult_messages;
create policy consult_messages_insert on public.consult_messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.consult_is_participant(session_id)
    and exists (select 1 from public.consult_sessions s where s.id = session_id and s.status in ('requested', 'active'))
  );

drop policy if exists consult_notes_select on public.consult_notes;
create policy consult_notes_select on public.consult_notes for select to authenticated
  using (
    public.consult_is_session_staff(session_id)
    or (confirmed_at is not null and exists (
      select 1 from public.consult_sessions s where s.id = session_id and s.patient_id = (select auth.uid())
    ))
  );
drop policy if exists consult_notes_insert on public.consult_notes;
create policy consult_notes_insert on public.consult_notes for insert to authenticated
  with check (public.consult_is_session_staff(session_id) and confirmed_at is null and author_id = (select auth.uid()));
drop policy if exists consult_notes_update on public.consult_notes;
create policy consult_notes_update on public.consult_notes for update to authenticated
  using (public.consult_is_session_staff(session_id) and confirmed_at is null)
  with check (public.consult_is_session_staff(session_id) and confirmed_at is null and author_id = (select auth.uid()));

drop policy if exists consult_followups_select on public.consult_followups;
create policy consult_followups_select on public.consult_followups for select to authenticated
  using (patient_id = (select auth.uid()) or provider_id = public.consult_staff_provider());

drop policy if exists consult_access_log_select on public.consult_access_log;
create policy consult_access_log_select on public.consult_access_log for select to authenticated
  using (
    public.consult_is_admin()
    or exists (select 1 from public.consult_sessions s where s.id = session_id and s.patient_id = (select auth.uid()))
  );

-- ผู้ส่งกำหนดบทบาทเองไม่ได้: ระบบคำนวณจากรหัสผู้ใช้ และใช้เวลาของเซิร์ฟเวอร์
create or replace function public.consult_message_defaults()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.created_at := now();
  new.sender_role := case
    when exists (select 1 from public.consult_sessions s where s.id = new.session_id and s.patient_id = new.sender_id)
    then 'patient' else 'staff' end;
  return new;
end;
$$;
drop trigger if exists consult_message_defaults on public.consult_messages;
create trigger consult_message_defaults before insert on public.consult_messages
  for each row execute function public.consult_message_defaults();

-- เวลาแก้บันทึก และห้ามตั้งเวลายืนยันเองผ่านการอัปเดตตรง ๆ
create or replace function public.consult_note_touch()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists consult_note_touch on public.consult_notes;
create trigger consult_note_touch before insert or update on public.consult_notes
  for each row execute function public.consult_note_touch();

-- ---------- ฟังก์ชันหลัก (เรียกผ่าน supabase.rpc) ----------

-- สร้างการปรึกษา ความยินยอม แบบสอบถาม และ Brief พร้อมกันในธุรกรรมเดียว (เรียกซ้ำด้วยรหัสเดิมได้ ไม่สร้างซ้ำ)
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
  select * into prov from public.consult_providers where id = p_provider and active;
  if prov.id is null then raise exception 'provider_unavailable'; end if;
  if not (p_channel = any (prov.channels)) then raise exception 'channel_unavailable'; end if;
  if not ('symptoms' = any (p_scopes)) then raise exception 'consent_required'; end if;
  if coalesce(trim(p_consent_version), '') = '' then raise exception 'consent_required'; end if;
  if p_channel = 'appointment' and p_scheduled is null then raise exception 'schedule_required'; end if;
  -- กรณีฉุกเฉินต้องไปหน่วยฉุกเฉิน ไม่รับเข้าคิว
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

-- ทางเดียวที่ผู้ให้บริการอ่าน Brief ได้: ต้องเป็นเจ้าหน้าที่ของผู้ให้บริการที่ผู้ใช้เลือก และความยินยอมยังไม่ถูกถอน
create or replace function public.open_consult_brief(p_session uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  snap jsonb;
begin
  if not public.consult_is_session_staff(p_session) then raise exception 'forbidden'; end if;
  if not exists (select 1 from public.consult_consents where session_id = p_session and revoked_at is null) then
    raise exception 'consent_revoked';
  end if;
  select snapshot into snap from public.consult_briefs where session_id = p_session;
  insert into public.consult_access_log (session_id, actor_id, action) values (p_session, auth.uid(), 'brief_opened');
  return snap;
end;
$$;

create or replace function public.revoke_consult_consent(p_session uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.consult_consents set revoked_at = now()
  where session_id = p_session and patient_id = auth.uid() and revoked_at is null;
  if not found then raise exception 'forbidden'; end if;
  insert into public.consult_access_log (session_id, actor_id, action) values (p_session, auth.uid(), 'consent_revoked');
end;
$$;

-- เปลี่ยนสถานะ: เจ้าหน้าที่รับเรื่องหรือปฏิเสธ ผู้ใช้ยกเลิก (ปิดงานด้วย confirm_consult_note เท่านั้น)
create or replace function public.set_consult_status(p_session uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare
  s public.consult_sessions;
  is_staff boolean := public.consult_is_session_staff(p_session);
begin
  select * into s from public.consult_sessions where id = p_session for update;
  if s.id is null or not (is_staff or s.patient_id = auth.uid()) then raise exception 'forbidden'; end if;
  if p_status = 'active' then
    if not is_staff or s.status <> 'requested' then raise exception 'invalid_transition'; end if;
    update public.consult_sessions set status = 'active', started_at = now() where id = p_session;
  elsif p_status = 'cancelled' then
    if s.status not in ('requested', 'active') then raise exception 'invalid_transition'; end if;
    update public.consult_sessions set status = 'cancelled', ended_at = now() where id = p_session;
  else
    raise exception 'invalid_transition';
  end if;
end;
$$;

-- เภสัชกรยืนยันผลเอง: ล็อกบันทึก ปิดการปรึกษา และสร้างนัดติดตามถ้ากำหนดวันไว้
create or replace function public.confirm_consult_note(p_session uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  s public.consult_sessions;
  n public.consult_notes;
begin
  if not public.consult_is_session_staff(p_session) then raise exception 'forbidden'; end if;
  select * into s from public.consult_sessions where id = p_session for update;
  if s.status <> 'active' then raise exception 'invalid_transition'; end if;
  select * into n from public.consult_notes where session_id = p_session;
  if n.session_id is null or (trim(n.assessment) = '' and trim(n.recommendation) = '' and trim(n.medication_advice) = '') then
    raise exception 'note_required';
  end if;
  update public.consult_notes set confirmed_at = now() where session_id = p_session;
  update public.consult_sessions set status = 'completed', ended_at = now() where id = p_session;
  if n.follow_up_due is not null then
    insert into public.consult_followups (session_id, patient_id, provider_id, due_date, plan)
    values (p_session, s.patient_id, s.provider_id, n.follow_up_due, n.follow_up_plan);
  end if;
end;
$$;

create or replace function public.respond_consult_followup(p_id uuid, p_response jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.consult_followups
  set response = p_response, status = 'responded', responded_at = now()
  where id = p_id and patient_id = auth.uid() and status = 'pending';
  if not found then raise exception 'forbidden'; end if;
end;
$$;

create or replace function public.review_consult_followup(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.consult_followups
  set status = 'reviewed', reviewed_at = now()
  where id = p_id and provider_id = public.consult_staff_provider() and status = 'responded';
  if not found then raise exception 'forbidden'; end if;
end;
$$;

create or replace function public.set_provider_online(p_online boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  pid uuid := public.consult_staff_provider();
begin
  if pid is null then raise exception 'forbidden'; end if;
  update public.consult_providers set is_online = p_online where id = pid;
end;
$$;

-- ---------- สิทธิ์ ----------

revoke all on public.consult_providers, public.consult_staff, public.consult_sessions, public.consult_checkins,
  public.consult_consents, public.consult_briefs, public.consult_messages, public.consult_notes,
  public.consult_followups, public.consult_access_log from anon, authenticated;

grant select, insert, update on public.consult_providers to authenticated;
grant select on public.consult_staff, public.consult_sessions, public.consult_checkins, public.consult_consents,
  public.consult_briefs, public.consult_followups, public.consult_access_log to authenticated;
grant select, insert on public.consult_messages to authenticated;
grant select, insert, update on public.consult_notes to authenticated;

revoke execute on function public.consult_is_admin() from public, anon;
revoke execute on function public.consult_staff_provider() from public, anon;
revoke execute on function public.consult_is_participant(uuid) from public, anon;
revoke execute on function public.consult_is_session_staff(uuid) from public, anon;
revoke execute on function public.start_consultation(uuid, uuid, text, text, text, text, timestamptz, jsonb, jsonb, text[], text) from public, anon;
revoke execute on function public.open_consult_brief(uuid) from public, anon;
revoke execute on function public.revoke_consult_consent(uuid) from public, anon;
revoke execute on function public.set_consult_status(uuid, text) from public, anon;
revoke execute on function public.confirm_consult_note(uuid) from public, anon;
revoke execute on function public.respond_consult_followup(uuid, jsonb) from public, anon;
revoke execute on function public.review_consult_followup(uuid) from public, anon;
revoke execute on function public.set_provider_online(boolean) from public, anon;
revoke execute on function public.consult_message_defaults() from public, anon, authenticated;
revoke execute on function public.consult_note_touch() from public, anon, authenticated;

grant execute on function public.consult_is_admin() to authenticated;
grant execute on function public.consult_staff_provider() to authenticated;
grant execute on function public.consult_is_participant(uuid) to authenticated;
grant execute on function public.consult_is_session_staff(uuid) to authenticated;
grant execute on function public.start_consultation(uuid, uuid, text, text, text, text, timestamptz, jsonb, jsonb, text[], text) to authenticated;
grant execute on function public.open_consult_brief(uuid) to authenticated;
grant execute on function public.revoke_consult_consent(uuid) to authenticated;
grant execute on function public.set_consult_status(uuid, text) to authenticated;
grant execute on function public.confirm_consult_note(uuid) to authenticated;
grant execute on function public.respond_consult_followup(uuid, jsonb) to authenticated;
grant execute on function public.review_consult_followup(uuid) to authenticated;
grant execute on function public.set_provider_online(boolean) to authenticated;

-- ---------- ไฟล์แนบ ----------
-- path ของไฟล์: {session_id}/{file_id} แยกจาก bucket attachments ของบ้าน เพื่อให้เห็นเฉพาะผู้ใช้กับผู้ให้บริการ

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('consult-files', 'consult-files', false, 20971520,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists consult_files_select on storage.objects;
create policy consult_files_select on storage.objects for select to authenticated
  using (bucket_id = 'consult-files' and public.consult_is_participant(((storage.foldername(name))[1])::uuid));
drop policy if exists consult_files_insert on storage.objects;
create policy consult_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'consult-files' and public.consult_is_participant(((storage.foldername(name))[1])::uuid));

-- ---------- Realtime ----------

do $$
begin
  begin alter publication supabase_realtime add table public.consult_messages; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.consult_sessions; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.consult_followups; exception when duplicate_object then null; end;
end $$;
