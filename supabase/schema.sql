-- Growa Homecare: ฐานข้อมูล Supabase
-- วิธีใช้: เปิด Supabase Dashboard -> SQL Editor -> วางทั้งไฟล์นี้แล้วกด Run (รันซ้ำได้ ไม่พัง)

create extension if not exists pgcrypto;

-- ---------- ตาราง ----------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text not null default '',
  photo text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.homes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.home_members (
  home_id uuid not null references public.homes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member', 'external')),
  relation text not null default '',
  joined_at timestamptz not null default now(),
  primary key (home_id, user_id)
);
-- หนึ่งบัญชีอยู่ได้หนึ่งบ้าน (แอปออกแบบมาแบบนี้)
create unique index if not exists home_members_one_home_per_user on public.home_members (user_id);
-- owner มีได้คนเดียวต่อบ้าน
create unique index if not exists home_members_one_owner_per_home on public.home_members (home_id) where role = 'owner';

-- ข้อมูลที่ใช้ร่วมกันในบ้าน: ปฏิทิน บันทึกอาการ คำขออนุญาต ข้อมูลสมาชิก ฯลฯ (หนึ่งแถวต่อหนึ่งรายการ)
create table if not exists public.home_items (
  home_id uuid not null references public.homes (id) on delete cascade,
  collection text not null,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  primary key (home_id, collection, id)
);

-- ข้อมูลส่วนตัวของผู้ใช้: ตู้ยา การตั้งค่า ข้อมูลสุขภาพพื้นฐาน
create table if not exists public.user_docs (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

create index if not exists homes_created_by_idx on public.homes (created_by);
create index if not exists home_items_updated_by_idx on public.home_items (updated_by);

alter table public.home_items replica identity full;

-- ---------- ฟังก์ชันช่วยตรวจสิทธิ์ ----------

create or replace function public.is_home_member(h uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.home_members where home_id = h and user_id = auth.uid());
$$;

create or replace function public.home_role(h uuid)
returns text language sql stable security definer set search_path = public as $$
  select role from public.home_members where home_id = h and user_id = auth.uid();
$$;

create or replace function public.shares_home_with(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.home_members a
    join public.home_members b on a.home_id = b.home_id
    where a.user_id = auth.uid() and b.user_id = uid
  );
$$;

-- ---------- สร้างโปรไฟล์อัตโนมัติเมื่อสมัคร ----------

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Row Level Security ----------

alter table public.profiles enable row level security;
alter table public.homes enable row level security;
alter table public.home_members enable row level security;
alter table public.home_items enable row level security;
alter table public.user_docs enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = (select auth.uid()) or public.shares_home_with(id));
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert with check (id = (select auth.uid()));
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists homes_select on public.homes;
create policy homes_select on public.homes for select using (public.is_home_member(id));
drop policy if exists homes_update on public.homes;
create policy homes_update on public.homes for update
  using (public.home_role(id) = 'owner') with check (public.home_role(id) = 'owner');

drop policy if exists home_members_select on public.home_members;
create policy home_members_select on public.home_members for select using (public.is_home_member(home_id));
-- ผู้ใช้แก้ความสัมพันธ์ของตัวเองได้ (การเปลี่ยนบทบาท/ลบสมาชิกทำผ่านฟังก์ชันด้านล่างเท่านั้น)
drop policy if exists home_members_update_self on public.home_members;
create policy home_members_update_self on public.home_members for update
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists home_items_all on public.home_items;
create policy home_items_all on public.home_items for all
  using (public.is_home_member(home_id)) with check (public.is_home_member(home_id));

drop policy if exists user_docs_all on public.user_docs;
create policy user_docs_all on public.user_docs for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- กันผู้ใช้เปลี่ยนบทบาท/ย้ายบ้านของตัวเองผ่านการอัปเดตตรง ๆ (ผ่าน API = บทบาท authenticated/anon)
-- ฟังก์ชันของระบบ (set_member_role, transfer_ownership) ทำงานในบทบาทเจ้าของฟังก์ชัน จึงเปลี่ยนได้ (ดู fix_member_roles.sql)
create or replace function public.guard_member_update()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.role is distinct from old.role
          or new.home_id is distinct from old.home_id
          or new.user_id is distinct from old.user_id) then
    raise exception 'forbidden';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_member_update on public.home_members;
create trigger guard_member_update before update on public.home_members
  for each row execute function public.guard_member_update();

-- ---------- ฟังก์ชันจัดการบ้าน (เรียกผ่าน supabase.rpc) ----------

create or replace function public.gen_invite_code()
returns text language plpgsql set search_path = public as $$
declare
  code text;
begin
  loop
    code := lpad((floor(random() * 90000000) + 10000000)::bigint::text, 8, '0');
    exit when not exists (select 1 from public.homes where invite_code = code);
  end loop;
  return code;
end;
$$;

create or replace function public.create_home(p_name text, p_relation text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  hid uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from public.home_members where user_id = auth.uid()) then
    raise exception 'already_in_home';
  end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'name_required'; end if;
  insert into public.homes (name, invite_code, created_by)
  values (trim(p_name), public.gen_invite_code(), auth.uid())
  returning id into hid;
  insert into public.home_members (home_id, user_id, role, relation)
  values (hid, auth.uid(), 'owner', coalesce(nullif(trim(p_relation), ''), 'ฉัน'));
  return hid;
end;
$$;

create or replace function public.join_home(p_code text, p_relation text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  hid uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from public.home_members where user_id = auth.uid()) then
    raise exception 'already_in_home';
  end if;
  select id into hid from public.homes where invite_code = regexp_replace(coalesce(p_code, ''), '\D', '', 'g');
  if hid is null then raise exception 'invalid_code'; end if;
  insert into public.home_members (home_id, user_id, role, relation)
  values (hid, auth.uid(), 'member', coalesce(nullif(trim(p_relation), ''), 'สมาชิก'));
  return hid;
end;
$$;

create or replace function public.regenerate_invite(p_home uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  code text;
begin
  if public.home_role(p_home) is distinct from 'owner' then raise exception 'forbidden'; end if;
  code := public.gen_invite_code();
  update public.homes set invite_code = code where id = p_home;
  return code;
end;
$$;

create or replace function public.set_member_role(p_home uuid, p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.home_role(p_home) is distinct from 'owner' then raise exception 'forbidden'; end if;
  if p_role not in ('member', 'external') then raise exception 'invalid_role'; end if;
  if p_user = auth.uid() then raise exception 'forbidden'; end if;
  update public.home_members set role = p_role where home_id = p_home and user_id = p_user;
end;
$$;

create or replace function public.transfer_ownership(p_home uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.home_role(p_home) is distinct from 'owner' then raise exception 'forbidden'; end if;
  if p_user = auth.uid() or not exists (select 1 from public.home_members where home_id = p_home and user_id = p_user) then
    raise exception 'invalid_target';
  end if;
  update public.home_members set role = 'member' where home_id = p_home and user_id = auth.uid();
  update public.home_members set role = 'owner' where home_id = p_home and user_id = p_user;
end;
$$;

-- เจ้าของบ้านลบสมาชิกคนอื่น หรือสมาชิกออกจากบ้านเอง (เจ้าของบ้านออกเองไม่ได้ ต้องมอบบทบาทหรือลบบ้านก่อน)
create or replace function public.remove_member(p_home uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  caller_role text := public.home_role(p_home);
begin
  if caller_role is null then raise exception 'forbidden'; end if;
  if p_user = auth.uid() then
    if caller_role = 'owner' then raise exception 'owner_cannot_leave'; end if;
  elsif caller_role is distinct from 'owner' then
    raise exception 'forbidden';
  end if;
  delete from public.home_members where home_id = p_home and user_id = p_user;
  delete from public.home_items where home_id = p_home and collection = 'member_records' and id = p_user::text;
end;
$$;

create or replace function public.delete_home(p_home uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.home_role(p_home) is distinct from 'owner' then raise exception 'forbidden'; end if;
  delete from public.homes where id = p_home;
end;
$$;

-- ถอนสิทธิ์เริ่มต้น (PUBLIC/anon) จากฟังก์ชันทั้งหมด แล้วให้เฉพาะผู้ที่ล็อกอินแล้วเรียกได้
revoke execute on function public.create_home(text, text) from public, anon;
revoke execute on function public.join_home(text, text) from public, anon;
revoke execute on function public.regenerate_invite(uuid) from public, anon;
revoke execute on function public.set_member_role(uuid, uuid, text) from public, anon;
revoke execute on function public.transfer_ownership(uuid, uuid) from public, anon;
revoke execute on function public.remove_member(uuid, uuid) from public, anon;
revoke execute on function public.delete_home(uuid) from public, anon;
revoke execute on function public.is_home_member(uuid) from public, anon;
revoke execute on function public.home_role(uuid) from public, anon;
revoke execute on function public.shares_home_with(uuid) from public, anon;
revoke execute on function public.gen_invite_code() from public, anon, authenticated;
-- trigger ทำงานด้วยสิทธิ์เจ้าของฟังก์ชัน ไม่ต้องเปิดให้ใครเรียกผ่าน API
revoke execute on function public.handle_new_user() from public, anon, authenticated;

grant execute on function public.create_home(text, text) to authenticated;
grant execute on function public.join_home(text, text) to authenticated;
grant execute on function public.regenerate_invite(uuid) to authenticated;
grant execute on function public.set_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.transfer_ownership(uuid, uuid) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
grant execute on function public.delete_home(uuid) to authenticated;
-- ใช้ในเงื่อนไข RLS ซึ่งประเมินด้วยสิทธิ์ของผู้ที่ล็อกอิน
grant execute on function public.is_home_member(uuid) to authenticated;
grant execute on function public.home_role(uuid) to authenticated;
grant execute on function public.shares_home_with(uuid) to authenticated;

-- ---------- เก็บไฟล์แนบ (รูปยา เอกสารทางการแพทย์ ฯลฯ) ----------
-- path ของไฟล์: {home_id}/{file_id}

insert into storage.buckets (id, name, public) values ('attachments', 'attachments', false)
on conflict (id) do nothing;

drop policy if exists attachments_select on storage.objects;
create policy attachments_select on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and public.is_home_member(((storage.foldername(name))[1])::uuid));
drop policy if exists attachments_insert on storage.objects;
create policy attachments_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and public.is_home_member(((storage.foldername(name))[1])::uuid));
drop policy if exists attachments_delete on storage.objects;
create policy attachments_delete on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and public.is_home_member(((storage.foldername(name))[1])::uuid));

-- ---------- Realtime (ให้ข้อมูลเปลี่ยนบนหน้าจอคนอื่นทันที) ----------

do $$
begin
  begin alter publication supabase_realtime add table public.home_items; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.home_members; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.homes; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.profiles; exception when duplicate_object then null; end;
end $$;
