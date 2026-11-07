-- Growa Homecare: ระบบปรึกษา ส่วนเพิ่มที่ 4 (รันต่อจาก consult_schema.sql, consult_v2.sql และ consult_v3.sql รันซ้ำได้)
-- 1. หมวดหมู่ผู้ให้บริการที่เพิ่มได้เอง (ไม่จำกัดแค่เภสัชกรกับคลินิก)
-- 2. ทีมงานหลายคนทำงานพร้อมกัน: รับเรื่องแบบจองเคส คนแรกที่กดได้เคสนั้น คนอื่นรับซ้ำไม่ได้
-- 3. รีวิวคะแนนดาวและความคิดเห็นหลังปรึกษาจบ

-- ---------- 1. หมวดหมู่ ----------

create table if not exists public.consult_categories (
  id text primary key check (id ~ '^[a-z0-9_]{2,30}$'),
  label text not null check (char_length(trim(label)) between 2 and 40),
  sort integer not null default 100,
  created_at timestamptz not null default now()
);
create unique index if not exists consult_categories_label_idx on public.consult_categories (lower(trim(label)));

insert into public.consult_categories (id, label, sort)
values ('pharmacist', 'เภสัชกร', 10), ('clinic', 'คลินิก', 20)
on conflict (id) do nothing;

alter table public.consult_categories enable row level security;
drop policy if exists consult_categories_select on public.consult_categories;
create policy consult_categories_select on public.consult_categories for select to authenticated using (true);

-- ผู้ให้บริการอ้างหมวดหมู่ผ่านรหัส ชื่อหมวดเปลี่ยนภายหลังได้โดยไม่กระทบข้อมูล
alter table public.consult_providers drop constraint if exists consult_providers_kind_check;
alter table public.consult_providers drop constraint if exists consult_providers_kind_fkey;
alter table public.consult_providers
  add constraint consult_providers_kind_fkey foreign key (kind) references public.consult_categories (id) on update cascade;

-- บทบาทของทีมงานคือรหัสหมวดหมู่ของร้าน (หรือ admin)
alter table public.consult_staff drop constraint if exists consult_staff_role_check;
alter table public.consult_staff
  add constraint consult_staff_role_check check (role = 'admin' or role ~ '^[a-z0-9_]{2,30}$');

-- เพิ่มหมวดหมู่ใหม่ ชื่อซ้ำ (ไม่สนตัวพิมพ์) คืนรหัสเดิมแทน
create or replace function public.admin_add_category(p_label text)
returns text language plpgsql security definer set search_path = public as $$
declare
  clean text := trim(coalesce(p_label, ''));
  found_id text;
  new_id text;
begin
  if not public.consult_is_admin() then raise exception 'forbidden'; end if;
  if char_length(clean) < 2 or char_length(clean) > 40 then raise exception 'invalid_category'; end if;
  select id into found_id from public.consult_categories where lower(trim(label)) = lower(clean);
  if found_id is not null then return found_id; end if;
  if (select count(*) from public.consult_categories) >= 30 then raise exception 'category_limit'; end if;
  new_id := 'c' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
  insert into public.consult_categories (id, label) values (new_id, clean);
  return new_id;
end;
$$;

-- ---------- 2. ทีมงานหลายคน ----------

alter table public.consult_sessions
  add column if not exists assigned_to uuid references auth.users (id) on delete set null,
  add column if not exists assigned_name text not null default '' check (char_length(assigned_name) <= 60);
create index if not exists consult_sessions_assigned_idx on public.consult_sessions (assigned_to);

create or replace function public.consult_staff_provider()
returns uuid language sql stable security definer set search_path = public as $$
  select s.provider_id
  from public.consult_staff s
  join public.consult_providers p on p.id = s.provider_id
  where s.user_id = auth.uid() and s.role <> 'admin' and p.status <> 'banned';
$$;

-- ผู้ดูแลเคส: เจ้าหน้าที่ที่รับเคสนี้ (เคสเก่าที่ปิดแล้วและไม่มีผู้ดูแล ทีมงานของร้านเปิดดูได้)
create or replace function public.consult_is_session_handler(sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.consult_sessions s
    where s.id = sid
      and auth.uid() is not null
      and s.provider_id = public.consult_staff_provider()
      and (s.assigned_to = auth.uid() or (s.assigned_to is null and s.status in ('completed', 'cancelled')))
  );
$$;

-- เจ้าหน้าที่ร่วมอ่านสนทนาได้เฉพาะเคสที่ยังรอรับเรื่อง หรือเคสที่ตัวเองดูแล เพื่อไม่ให้ข้อมูลสุขภาพของเคสคนอื่นเปิดกว้างเกินจำเป็น
create or replace function public.consult_is_participant(sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.consult_sessions s
    where s.id = sid
      and auth.uid() is not null
      and (
        s.patient_id = auth.uid()
        or (s.provider_id = public.consult_staff_provider() and (s.status = 'requested' or public.consult_is_session_handler(sid)))
      )
  );
$$;

-- ส่งข้อความได้: ผู้ป่วยเจ้าของเคส หรือเจ้าหน้าที่ที่ดูแลเคสนั้นอยู่
create or replace function public.consult_can_send(sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.consult_sessions s
    where s.id = sid and auth.uid() is not null
      and (s.patient_id = auth.uid() or (s.assigned_to = auth.uid() and s.provider_id = public.consult_staff_provider()))
  );
$$;

drop policy if exists consult_messages_insert on public.consult_messages;
create policy consult_messages_insert on public.consult_messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.consult_can_send(session_id)
    and exists (select 1 from public.consult_sessions s where s.id = session_id and s.status in ('requested', 'active'))
  );

drop policy if exists consult_notes_select on public.consult_notes;
create policy consult_notes_select on public.consult_notes for select to authenticated
  using (
    public.consult_is_session_handler(session_id)
    or (confirmed_at is not null and exists (
      select 1 from public.consult_sessions s where s.id = session_id and s.patient_id = (select auth.uid())
    ))
  );
drop policy if exists consult_notes_insert on public.consult_notes;
create policy consult_notes_insert on public.consult_notes for insert to authenticated
  with check (public.consult_is_session_handler(session_id) and confirmed_at is null and author_id = (select auth.uid()));
drop policy if exists consult_notes_update on public.consult_notes;
create policy consult_notes_update on public.consult_notes for update to authenticated
  using (public.consult_is_session_handler(session_id) and confirmed_at is null)
  with check (public.consult_is_session_handler(session_id) and confirmed_at is null and author_id = (select auth.uid()));

create or replace function public.open_consult_brief(p_session uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  snap jsonb;
begin
  if not public.consult_is_session_handler(p_session) then raise exception 'forbidden'; end if;
  if not exists (select 1 from public.consult_consents where session_id = p_session and revoked_at is null) then
    raise exception 'consent_revoked';
  end if;
  select snapshot into snap from public.consult_briefs where session_id = p_session;
  insert into public.consult_access_log (session_id, actor_id, action) values (p_session, auth.uid(), 'brief_opened');
  return snap;
end;
$$;

-- รับเรื่อง = จองเคส: ล็อกแถวไว้ คนที่สองที่กดพร้อมกันจะเห็นว่ามีคนรับแล้ว (already_claimed)
-- กดซ้ำโดยคนที่รับอยู่แล้วไม่เป็นไร ปฏิเสธ (cancelled) ทำได้เฉพาะเคสที่ยังไม่มีผู้ดูแล หรือผู้ดูแลคือตัวเอง
create or replace function public.set_consult_status(p_session uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare
  s public.consult_sessions;
  is_staff boolean := public.consult_is_session_staff(p_session);
  me_name text;
begin
  select * into s from public.consult_sessions where id = p_session for update;
  if s.id is null or not (is_staff or s.patient_id = auth.uid()) then raise exception 'forbidden'; end if;
  if p_status = 'active' then
    if not is_staff then raise exception 'invalid_transition'; end if;
    if s.status = 'active' and s.assigned_to = auth.uid() then return; end if;
    if s.status = 'active' and s.assigned_to is not null then raise exception 'already_claimed'; end if;
    if s.status not in ('requested', 'active') then raise exception 'invalid_transition'; end if;
    select coalesce(nullif(left(split_part(u.email, '@', 1), 60), ''), 'เจ้าหน้าที่') into me_name from auth.users u where u.id = auth.uid();
    update public.consult_sessions
    set status = 'active', started_at = coalesce(started_at, now()), assigned_to = auth.uid(), assigned_name = coalesce(me_name, 'เจ้าหน้าที่')
    where id = p_session;
    insert into public.consult_access_log (session_id, actor_id, action) values (p_session, auth.uid(), 'claimed');
  elsif p_status = 'cancelled' then
    if s.status not in ('requested', 'active') then raise exception 'invalid_transition'; end if;
    if s.patient_id is distinct from auth.uid() and s.assigned_to is not null and s.assigned_to <> auth.uid() then
      raise exception 'already_claimed';
    end if;
    update public.consult_sessions set status = 'cancelled', ended_at = now() where id = p_session;
  else
    raise exception 'invalid_transition';
  end if;
end;
$$;

-- คืนเคสเข้าคิว เช่น ติดธุระ ให้เพื่อนร่วมงานรับต่อ
create or replace function public.release_consultation(p_session uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  s public.consult_sessions;
begin
  select * into s from public.consult_sessions where id = p_session for update;
  if s.id is null or s.assigned_to is distinct from auth.uid() or s.provider_id is distinct from public.consult_staff_provider() then
    raise exception 'forbidden';
  end if;
  if s.status <> 'active' then raise exception 'invalid_transition'; end if;
  update public.consult_sessions set status = 'requested', started_at = null, assigned_to = null, assigned_name = '' where id = p_session;
  insert into public.consult_access_log (session_id, actor_id, action) values (p_session, auth.uid(), 'released');
end;
$$;

-- รับช่วงต่อเคสของเพื่อนร่วมงานที่ไม่อยู่แล้ว บันทึกไว้ให้ผู้ป่วยเห็นว่าใครดูแลต่อ
create or replace function public.take_over_consultation(p_session uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  s public.consult_sessions;
  me_name text;
begin
  select * into s from public.consult_sessions where id = p_session for update;
  if s.id is null or s.provider_id is distinct from public.consult_staff_provider() then raise exception 'forbidden'; end if;
  if s.status <> 'active' then raise exception 'invalid_transition'; end if;
  if s.assigned_to = auth.uid() then return; end if;
  select coalesce(nullif(left(split_part(u.email, '@', 1), 60), ''), 'เจ้าหน้าที่') into me_name from auth.users u where u.id = auth.uid();
  update public.consult_sessions set assigned_to = auth.uid(), assigned_name = coalesce(me_name, 'เจ้าหน้าที่') where id = p_session;
  insert into public.consult_access_log (session_id, actor_id, action) values (p_session, auth.uid(), 'taken_over');
end;
$$;

create or replace function public.confirm_consult_note(p_session uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  s public.consult_sessions;
  n public.consult_notes;
begin
  select * into s from public.consult_sessions where id = p_session for update;
  if s.id is null or s.assigned_to is distinct from auth.uid() or s.provider_id is distinct from public.consult_staff_provider() then
    raise exception 'forbidden';
  end if;
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

-- ---------- 3. รีวิว ----------

create table if not exists public.consult_reviews (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.consult_sessions (id) on delete cascade,
  patient_id uuid not null references auth.users (id) on delete cascade,
  provider_id uuid not null references public.consult_providers (id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists consult_reviews_provider_idx on public.consult_reviews (provider_id, created_at desc);
create index if not exists consult_reviews_patient_idx on public.consult_reviews (patient_id);

alter table public.consult_reviews enable row level security;
-- ผู้ใช้อ่านได้เฉพาะรีวิวของตัวเอง คนอื่นดูผ่าน list_provider_reviews ซึ่งไม่เปิดเผยว่าใครรีวิว
drop policy if exists consult_reviews_select on public.consult_reviews;
create policy consult_reviews_select on public.consult_reviews for select to authenticated
  using (patient_id = (select auth.uid()));

-- คะแนนของร้านคำนวณจากรีวิวจริงเท่านั้น แอดมินและร้านตั้งเองผ่านแอปไม่ได้
create or replace function public.consult_refresh_rating(pid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.consult_providers
  set rating = (select round(avg(r.stars)::numeric, 1) from public.consult_reviews r where r.provider_id = pid),
      review_count = (select count(*) from public.consult_reviews r where r.provider_id = pid)
  where id = pid;
end;
$$;

create or replace function public.consult_review_changed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.consult_refresh_rating(coalesce(new.provider_id, old.provider_id));
  return null;
end;
$$;
drop trigger if exists consult_review_changed on public.consult_reviews;
create trigger consult_review_changed after insert or update or delete on public.consult_reviews
  for each row execute function public.consult_review_changed();

-- รีวิวได้เฉพาะเคสของตัวเองที่เสร็จสิ้นแล้ว (ยกเลิกไม่นับ) รีวิวซ้ำคือแก้รีวิวเดิม
create or replace function public.submit_consult_review(p_session uuid, p_stars integer, p_comment text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  s public.consult_sessions;
  review_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into s from public.consult_sessions where id = p_session;
  if s.id is null or s.patient_id <> auth.uid() then raise exception 'forbidden'; end if;
  if s.status <> 'completed' then raise exception 'review_not_allowed'; end if;
  if p_stars is null or p_stars < 1 or p_stars > 5 then raise exception 'invalid_rating'; end if;
  insert into public.consult_reviews (session_id, patient_id, provider_id, stars, comment)
  values (p_session, auth.uid(), s.provider_id, p_stars, left(trim(coalesce(p_comment, '')), 500))
  on conflict (session_id) do update set stars = excluded.stars, comment = excluded.comment, updated_at = now()
  returning id into review_id;
  return review_id;
end;
$$;

-- รีวิวของร้าน แบบไม่ระบุตัวตน เห็นได้ตามสิทธิ์เดียวกับการเห็นร้าน
create or replace function public.list_provider_reviews(p_provider uuid, p_limit integer default 50)
returns table (id uuid, stars integer, comment text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (
    exists (select 1 from public.consult_providers p where p.id = p_provider and p.status = 'open')
    or public.consult_is_admin()
    or p_provider = public.consult_staff_provider()
    or exists (select 1 from public.consult_sessions s where s.provider_id = p_provider and s.patient_id = auth.uid())
  ) then
    return;
  end if;
  return query
    select r.id, r.stars::integer, r.comment, r.created_at
    from public.consult_reviews r
    where r.provider_id = p_provider
    order by r.created_at desc
    limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$$;

-- แอดมินลบรีวิวที่ไม่เหมาะสม (เช่น คำหยาบ ข้อมูลส่วนตัว) คะแนนคำนวณใหม่ทันที
create or replace function public.admin_delete_review(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.consult_is_admin() then raise exception 'forbidden'; end if;
  delete from public.consult_reviews where id = p_id;
  if not found then raise exception 'forbidden'; end if;
end;
$$;

-- ---------- สิทธิ์ ----------

revoke all on public.consult_categories, public.consult_reviews from anon, authenticated;
grant select on public.consult_categories, public.consult_reviews to authenticated;

revoke execute on function public.consult_is_session_handler(uuid) from public, anon;
revoke execute on function public.consult_can_send(uuid) from public, anon;
revoke execute on function public.admin_add_category(text) from public, anon;
revoke execute on function public.release_consultation(uuid) from public, anon;
revoke execute on function public.take_over_consultation(uuid) from public, anon;
revoke execute on function public.submit_consult_review(uuid, integer, text) from public, anon;
revoke execute on function public.list_provider_reviews(uuid, integer) from public, anon;
revoke execute on function public.admin_delete_review(uuid) from public, anon;
revoke execute on function public.consult_refresh_rating(uuid) from public, anon, authenticated;
revoke execute on function public.consult_review_changed() from public, anon, authenticated;

grant execute on function public.consult_is_session_handler(uuid) to authenticated;
grant execute on function public.consult_can_send(uuid) to authenticated;
grant execute on function public.admin_add_category(text) to authenticated;
grant execute on function public.release_consultation(uuid) to authenticated;
grant execute on function public.take_over_consultation(uuid) to authenticated;
grant execute on function public.submit_consult_review(uuid, integer, text) to authenticated;
grant execute on function public.list_provider_reviews(uuid, integer) to authenticated;
grant execute on function public.admin_delete_review(uuid) to authenticated;
