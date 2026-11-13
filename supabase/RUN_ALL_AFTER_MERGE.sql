-- Growa Homecare: รันครั้งเดียวหลัง merge (รวม 4 ไฟล์ตามลำดับ + เปลี่ยนเช็คยาเป็นทุก 1 นาที)
-- สร้างจาก account_delete.sql, hardening.sql, health_privacy.sql, data_access_log.sql ห้ามแก้มือ ถ้าไฟล์ต้นทางเปลี่ยนให้สร้างใหม่

-- ============================== account_delete.sql ==============================
-- Growa Homecare: ลบบัญชีของฉัน (PDPA ม.33 สิทธิขอให้ลบข้อมูล)
-- วิธีใช้: Supabase Dashboard -> SQL Editor -> วางทั้งไฟล์แล้วกด Run (รันซ้ำได้ ไม่พัง)
-- ต้องรันหลัง schema.sql และ consult_schema.sql / consult_v2.sql
--
-- ฟังก์ชันนี้ลบได้เฉพาะบัญชีของผู้ที่เรียกเองเท่านั้น (auth.uid()) ไม่รับรหัสผู้ใช้จากภายนอก
-- ลบบัญชี (auth.users) แล้วข้อมูลในตารางต่อไปนี้หายตามด้วย "on delete cascade":
--   profiles, home_members, user_docs, consult_sessions (และข้อความ แบบสอบถาม Brief บันทึก นัดติดตามที่ผูกกับการปรึกษา),
--   consult_consents, consult_checkins, consult_followups, consult_reviews, consult_push_subscriptions, med_push_sent
-- ที่ไม่ได้ลบตามบัญชีโดยตั้งใจ: consult_erasure_log (เก็บหลักฐานว่ามีการลบ รหัสผู้ใช้ถูกตั้งเป็นว่าง)
--
-- ไฟล์ใน Storage ลบด้วย SQL ไม่ได้ ต้องลบผ่าน Storage API ก่อน (แอปทำให้ใน deleteMyAccount() ก่อนเรียกฟังก์ชันนี้)

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  h uuid;
  r text;
  n integer;
begin
  if uid is null then raise exception 'not_authenticated'; end if;

  select home_id, role into h, r from public.home_members where user_id = uid;
  if h is not null then
    select count(*) into n from public.home_members where home_id = h;
    if r = 'owner' and n > 1 then
      -- ผู้ดูแลหลักที่ยังมีคนอื่นอยู่ในบ้าน ต้องมอบบทบาทให้คนอื่นก่อน (ไม่ทิ้งบ้านที่ไม่มีเจ้าของ)
      raise exception 'owner_has_members';
    elsif r = 'owner' then
      -- อยู่คนเดียว: ลบบ้านและข้อมูลของบ้านทั้งหมด
      delete from public.homes where id = h;
    else
      -- สมาชิกทั่วไป: ถอนข้อมูลสมาชิกของตัวเองที่เผยแพร่ในบ้าน (เหมือนตอนออกจากบ้านเอง)
      delete from public.home_items where home_id = h and collection in ('member_records', 'member_health') and id = uid::text;
    end if;
  end if;

  -- บันทึกว่าใครเข้าดู/แก้ข้อมูลของบัญชีนี้ (data_access_log.sql) ถ้าติดตั้งไว้ ลบไปด้วย
  if to_regclass('public.member_data_log') is not null then
    delete from public.member_data_log where target_id = uid::text;
  end if;

  delete from auth.users where id = uid;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ============================== hardening.sql ==============================
-- =====================================================================
-- Growa Homecare: ปิดช่องโหว่เล็ก ๆ ก่อนใช้งานจริง (รันหลัง schema.sql) รันซ้ำได้
--
-- 1) จำกัดการเดารหัสเชิญเข้าบ้าน: ใส่รหัสผิดได้ไม่เกิน 10 ครั้งใน 15 นาทีต่อบัญชี
--    (รหัสเป็นตัวเลข 8 หลัก ถ้าไม่จำกัด คนที่ล็อกอินแล้วยิงเดาไปเรื่อย ๆ อาจเข้าบ้านคนอื่นได้)
--    รหัสผิดจะคืนค่า null แทนการโยนข้อผิดพลาด เพราะการโยนข้อผิดพลาดจะย้อนการบันทึกครั้งที่ลองไปด้วย
--    แอปตั้งแต่เวอร์ชันนี้แปลง null เป็น "ไม่พบรหัสเชิญนี้" เอง
-- 2) จำกัดขนาดไฟล์แนบในถัง attachments ไม่เกิน 20 MB (ตรงกับที่แอปจำกัดไว้)
-- =====================================================================

create table if not exists public.home_join_attempts (
  user_id uuid not null,
  at timestamptz not null default now()
);
create index if not exists home_join_attempts_user_at_idx on public.home_join_attempts (user_id, at desc);
alter table public.home_join_attempts enable row level security;
-- ไม่มี policy: ไม่มีใครอ่าน/เขียนตรงได้ ใช้ผ่าน join_home เท่านั้น
revoke all on public.home_join_attempts from anon, authenticated;

create or replace function public.join_home(p_code text, p_relation text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  hid uuid;
  recent int;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from public.home_members where user_id = auth.uid()) then
    raise exception 'already_in_home';
  end if;

  select count(*) into recent from public.home_join_attempts
  where user_id = auth.uid() and at > now() - interval '15 minutes';
  if recent >= 10 then raise exception 'too_many_attempts'; end if;

  select id into hid from public.homes where invite_code = regexp_replace(coalesce(p_code, ''), '\D', '', 'g');
  if hid is null then
    insert into public.home_join_attempts (user_id) values (auth.uid());
    -- เก็บไว้แค่ 1 วัน ไม่ให้ตารางโตเรื่อย ๆ
    delete from public.home_join_attempts where at < now() - interval '1 day';
    return null;
  end if;

  insert into public.home_members (home_id, user_id, role, relation)
  values (hid, auth.uid(), 'member', coalesce(nullif(trim(p_relation), ''), 'สมาชิก'));
  return hid;
end;
$$;
revoke execute on function public.join_home(text, text) from public, anon;
grant execute on function public.join_home(text, text) to authenticated;

update storage.buckets set file_size_limit = 20971520 where id = 'attachments';

-- ============================== health_privacy.sql ==============================
-- =====================================================================
-- Growa Homecare: ให้ฐานข้อมูลบังคับการซ่อนข้อมูลสุขภาพจริง (รันหลัง schema.sql) รันซ้ำได้
--
-- เดิม: ข้อมูลของสมาชิกแต่ละคน (รวมโรค แพ้ยา ยา ค่าที่วัด บันทึกการกินยา) อยู่ใน home_items
--       collection 'member_records' ซึ่งทุกคนในบ้านอ่าน/แก้ได้ สวิตช์ "ไม่แชร์" และสิทธิ์แก้ไขมีผลแค่บนหน้าจอ
-- ใหม่:
--   member_records = ส่วนที่ทุกคนในบ้านเห็น (อายุ เพศ รูป วันเกิด ผู้ดูแลหลัก อารมณ์วันนี้ ค่าความเป็นส่วนตัว)
--   member_health  = ส่วนสุขภาพ (health, meds, vitals, doseLogs, heightCm, weightKg)
--     อ่านได้: เจ้าของ / เจ้าของเปิดแชร์ (shareData) / ได้รับอนุญาตให้ดู / มีสิทธิ์แก้ไข
--     แก้ได้:  เจ้าของ / editPolicy = all / อยู่ใน allowedEditors / ได้รับอนุญาตให้แก้  (ถ้าอยู่ใน blockedEditors แก้ไม่ได้เด็ดขาด)
--   ค่าความเป็นส่วนตัว (sharing) เปลี่ยนได้เฉพาะเจ้าของ
--   คำขออนุญาต (collection 'access'): ผู้ขอสร้างได้แค่คำขอที่ "รออนุมัติ" มีแต่เจ้าของข้อมูลที่อนุมัติได้
--     ผู้ขอแก้ได้อย่างเดียวคือบันทึกว่าใช้สิทธิ์ "อนุญาตครั้งนี้" ไปแล้ว (usedAt)
--
-- ลำดับเอาขึ้น: เอาแอปเวอร์ชันที่แยกข้อมูลได้ขึ้นก่อน แล้วค่อยรันไฟล์นี้
-- แท็บเก่าที่ยังส่งข้อมูลสุขภาพมาในแถว member_records จะถูกตัดออกและย้ายไป member_health ให้อัตโนมัติ
-- =====================================================================

-- ---------- ฟังก์ชันช่วยตรวจสิทธิ์ (อ่านข้ามสิทธิ์ RLS ได้ จึงต้องตรวจผู้เรียกเอง) ----------

create or replace function public.member_sharing(h uuid, target text)
returns jsonb language sql stable security definer set search_path = public as $$
  select data -> 'sharing' from public.home_items
  where home_id = h and collection = 'member_records' and id = target;
$$;

create or replace function public.member_access_granted(h uuid, target text, p_scope text)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.home_items a
    where a.home_id = h and a.collection = 'access'
      and a.data ->> 'targetId' = target
      and a.data ->> 'requesterId' = auth.uid()::text
      and a.data ->> 'scope' = p_scope
      and (a.data ->> 'decision' = 'always' or (a.data ->> 'decision' = 'once' and nullif(a.data ->> 'usedAt', '') is null))
  );
$$;

create or replace function public.can_edit_member(h uuid, target text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  me text := auth.uid()::text;
  s jsonb;
begin
  if me is null or not public.is_home_member(h) then return false; end if;
  if target = me then return true; end if;
  s := public.member_sharing(h, target);
  if coalesce(s -> 'blockedEditors' ? me, false) then return false; end if;
  return coalesce(s ->> 'editPolicy', '') = 'all'
      or coalesce(s -> 'allowedEditors' ? me, false)
      or public.member_access_granted(h, target, 'edit');
end;
$$;

create or replace function public.can_view_member(h uuid, target text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  me text := auth.uid()::text;
begin
  if me is null or not public.is_home_member(h) then return false; end if;
  if target = me then return true; end if;
  -- ไม่มีแถวค่าความเป็นส่วนตัว = ถือว่าไม่แชร์ (ปลอดภัยไว้ก่อน)
  return coalesce((public.member_sharing(h, target) ->> 'shareData')::boolean, false)
      or public.member_access_granted(h, target, 'view')
      or public.can_edit_member(h, target);
end;
$$;

-- member_sharing / member_access_granted ใช้ภายในฟังก์ชันตรวจสิทธิ์เท่านั้น ผู้ใช้เรียกตรงไม่ได้
-- (ถ้าเรียกได้ คนนอกบ้านอ่านค่าความเป็นส่วนตัวของสมาชิกคนอื่นได้ เพราะฟังก์ชันนี้ไม่ตรวจว่าเป็นสมาชิกบ้าน)
revoke execute on function public.member_sharing(uuid, text) from public, anon, authenticated;
revoke execute on function public.member_access_granted(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.can_edit_member(uuid, text) from public, anon;
revoke execute on function public.can_view_member(uuid, text) from public, anon;
grant execute on function public.can_edit_member(uuid, text) to authenticated;
grant execute on function public.can_view_member(uuid, text) to authenticated;

-- ---------- ย้ายข้อมูลเดิม: ตัดส่วนสุขภาพออกจาก member_records ไปไว้ใน member_health ----------

insert into public.home_items (home_id, collection, id, data, updated_by, updated_at)
select r.home_id, 'member_health', r.id,
       (select jsonb_object_agg(k, r.data -> k)
          from unnest(array['health', 'meds', 'vitals', 'doseLogs', 'heightCm', 'weightKg']) k
         where r.data ? k),
       r.updated_by, r.updated_at
from public.home_items r
where r.collection = 'member_records'
  and r.data ?| array['health', 'meds', 'vitals', 'doseLogs', 'heightCm', 'weightKg']
-- ช่วงที่แอปใหม่ขึ้นแล้วแต่ยังไม่รันไฟล์นี้ อาจมีแถวสุขภาพอยู่แล้ว: เก็บฉบับที่ใหม่กว่า
on conflict (home_id, collection, id) do update
  set data = excluded.data, updated_by = excluded.updated_by, updated_at = excluded.updated_at
  where public.home_items.updated_at < excluded.updated_at;

update public.home_items
set data = data - array['health', 'meds', 'vitals', 'doseLogs', 'heightCm', 'weightKg']
where collection = 'member_records'
  and data ?| array['health', 'meds', 'vitals', 'doseLogs', 'heightCm', 'weightKg'];

-- ---------- ตัวเฝ้าการเขียน: ค่าความเป็นส่วนตัว คำขออนุญาต และแท็บเก่าที่ส่งข้อมูลสุขภาพมาผิดที่ ----------

create or replace function public.home_items_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  me text := auth.uid()::text;
  health_keys constant text[] := array['health', 'meds', 'vitals', 'doseLogs', 'heightCm', 'weightKg'];
  -- ค่าเริ่มต้นตรงกับแอป (defaultSharing ใน src/lib/members.ts): ทุกคนในบ้านดูได้ แต่ต้องขออนุญาตเจ้าของก่อนแก้ไข
  default_sharing constant jsonb := '{"shareData": true, "editPolicy": "choose", "allowedEditors": [], "blockedEditors": []}';
  part jsonb;
  row_exists boolean;
begin
  -- งานของระบบ (SQL editor, cron, ฟังก์ชันของเซิร์ฟเวอร์ที่ไม่มีผู้ใช้) ไม่ต้องตรวจ
  if me is null then return new; end if;

  if tg_op = 'INSERT' then
    select exists (select 1 from public.home_items where home_id = new.home_id and collection = new.collection and id = new.id)
      into row_exists;
    -- upsert ที่ชนแถวเดิม: ให้ขั้น UPDATE เป็นคนตรวจ
    if row_exists then return new; end if;
  end if;

  if new.collection = 'member_records' then
    -- แท็บเก่า (ก่อนแยกข้อมูล) ยังส่งข้อมูลสุขภาพมาในแถวนี้: ตัดออก และย้ายไปแถวสุขภาพถ้ามีสิทธิ์แก้
    if new.data ?| health_keys then
      select jsonb_object_agg(k, new.data -> k) into part from unnest(health_keys) k where new.data ? k;
      new.data := new.data - health_keys;
      if public.can_edit_member(new.home_id, new.id) then
        insert into public.home_items (home_id, collection, id, data, updated_by, updated_at)
        values (new.home_id, 'member_health', new.id, part, auth.uid(), now())
        on conflict (home_id, collection, id)
        do update set data = public.home_items.data || excluded.data, updated_by = excluded.updated_by, updated_at = now();
      end if;
    end if;

    if new.id <> me then
      if tg_op = 'INSERT' then
        -- สร้างแถวให้คนอื่นได้ (เช่น สมาชิกใหม่ที่ยังไม่มีแถว) แต่ค่าความเป็นส่วนตัวต้องเป็นค่าเริ่มต้นเสมอ
        new.data := jsonb_set(new.data, '{sharing}', default_sharing);
      else
        if not public.can_edit_member(old.home_id, old.id) then raise exception 'forbidden'; end if;
        -- คนอื่นเปลี่ยนค่าความเป็นส่วนตัวของเจ้าของไม่ได้: คงค่าเดิมไว้
        new.data := jsonb_set(new.data, '{sharing}', coalesce(old.data -> 'sharing', default_sharing));
      end if;
    end if;

  elsif new.collection = 'access' then
    if tg_op = 'INSERT' then
      if new.data ->> 'requesterId' is distinct from me then raise exception 'forbidden'; end if;
      if coalesce(new.data ->> 'decision', 'pending') <> 'pending' or nullif(new.data ->> 'usedAt', '') is not null then
        raise exception 'forbidden';
      end if;
    else
      if new.data is not distinct from old.data then return new; end if;
      if (new.data ->> 'requesterId') is distinct from (old.data ->> 'requesterId')
         or (new.data ->> 'targetId') is distinct from (old.data ->> 'targetId')
         or (new.data ->> 'scope') is distinct from (old.data ->> 'scope') then
        raise exception 'forbidden';
      end if;
      if old.data ->> 'targetId' = me then
        null; -- เจ้าของข้อมูลตอบหรือเปลี่ยนคำตอบได้
      elsif old.data ->> 'requesterId' = me then
        -- ผู้ขอทำได้อย่างเดียว: บันทึกว่าใช้สิทธิ์ "อนุญาตครั้งนี้" ไปแล้ว
        if (new.data - 'usedAt') is distinct from (old.data - 'usedAt')
           or old.data ->> 'decision' <> 'once'
           or nullif(old.data ->> 'usedAt', '') is not null then
          raise exception 'forbidden';
        end if;
      else
        raise exception 'forbidden';
      end if;
    end if;
  end if;

  return new;
end;
$$;
revoke execute on function public.home_items_guard() from public, anon, authenticated;

drop trigger if exists home_items_guard on public.home_items;
create trigger home_items_guard before insert or update on public.home_items
  for each row execute function public.home_items_guard();

-- ---------- สิทธิ์อ่าน/เขียนรายแถว ----------

drop policy if exists home_items_all on public.home_items;
drop policy if exists home_items_select on public.home_items;
drop policy if exists home_items_insert on public.home_items;
drop policy if exists home_items_update on public.home_items;
drop policy if exists home_items_delete on public.home_items;

create policy home_items_select on public.home_items for select to authenticated
  using (public.is_home_member(home_id)
         and (collection <> 'member_health' or public.can_view_member(home_id, id)));

create policy home_items_insert on public.home_items for insert to authenticated
  with check (public.is_home_member(home_id)
              and (collection <> 'member_health' or public.can_edit_member(home_id, id)));

create policy home_items_update on public.home_items for update to authenticated
  using (public.is_home_member(home_id)
         and (collection <> 'member_health' or public.can_edit_member(home_id, id)))
  with check (public.is_home_member(home_id)
              and (collection <> 'member_health' or public.can_edit_member(home_id, id)));

-- ลบข้อมูลสมาชิกได้เฉพาะของตัวเอง (ออกจากบ้าน/ถูกเชิญออกใช้ remove_member) ลบคำขออนุญาตได้เฉพาะผู้ขอหรือเจ้าของข้อมูล
create policy home_items_delete on public.home_items for delete to authenticated
  using (public.is_home_member(home_id)
         and (collection not in ('member_records', 'member_health') or id = (select auth.uid())::text)
         and (collection <> 'access'
              or data ->> 'requesterId' = (select auth.uid())::text
              or data ->> 'targetId' = (select auth.uid())::text));

-- ---------- ออกจากบ้าน: ลบทั้งสองส่วนของข้อมูลสมาชิก ----------

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
  delete from public.home_items
  where home_id = p_home and collection in ('member_records', 'member_health') and id = p_user::text;
end;
$$;
revoke execute on function public.remove_member(uuid, uuid) from public, anon;
grant execute on function public.remove_member(uuid, uuid) to authenticated;

-- ============================== data_access_log.sql ==============================
-- =====================================================================
-- Growa Homecare: บันทึกว่าใครเข้าดู/แก้ข้อมูลสุขภาพของฉัน (รันหลัง health_privacy.sql) รันซ้ำได้
--
-- ข้อมูลสุขภาพเป็นข้อมูลอ่อนไหว เจ้าของข้อมูลควรตรวจสอบได้ว่าใครเข้ามาดูหรือแก้ไข
-- - แก้ไข (edit): ฐานข้อมูลบันทึกให้เองทุกครั้งที่คนอื่นแก้ข้อมูลสุขภาพของเรา เก็บเฉพาะ "หัวข้อที่แก้" ไม่เก็บค่า
-- - เข้าดู (view): แอปเรียก log_member_view ตอนเปิดหน้าข้อมูลของสมาชิกคนอื่น (บันทึกแบบอ้างอิงตามที่แอปแจ้ง
--   ไม่ใช่การดักทุกการอ่านที่ฐานข้อมูล) ซ้ำคนเดิม/เป้าหมายเดิมภายใน 15 นาทีนับเป็นครั้งเดียว
-- - อ่านได้เฉพาะเจ้าของข้อมูล เขียนได้เฉพาะผ่านตัวบันทึกนี้ ผู้ใช้แก้หรือลบเองไม่ได้ เก็บไว้ 1 ปี
-- =====================================================================

create table if not exists public.member_data_log (
  id bigint generated always as identity primary key,
  home_id uuid not null references public.homes (id) on delete cascade,
  -- เจ้าของข้อมูล (รหัสผู้ใช้เป็นข้อความ เหมือน id ของ home_items)
  target_id text not null,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (action in ('view', 'edit')),
  -- หัวข้อที่แก้ เช่น health, meds, vitals (ไม่เก็บค่าจริง)
  keys text[] not null default '{}',
  at timestamptz not null default now()
);

create index if not exists member_data_log_target_at_idx on public.member_data_log (target_id, at desc);
create index if not exists member_data_log_actor_idx on public.member_data_log (actor_id);
create index if not exists member_data_log_home_idx on public.member_data_log (home_id);

alter table public.member_data_log enable row level security;

drop policy if exists member_data_log_select on public.member_data_log;
create policy member_data_log_select on public.member_data_log for select to authenticated
  using (target_id = (select auth.uid())::text);

-- ไม่มี policy สำหรับเพิ่ม/แก้/ลบ: ทำได้เฉพาะผ่านตัวบันทึกด้านล่าง
revoke insert, update, delete on public.member_data_log from anon, authenticated;

-- ---------- บันทึกการแก้ไขโดยคนอื่น ----------

create or replace function public.log_health_edit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  actor uuid := auth.uid();
  old_data jsonb := '{}'::jsonb;
  changed text[];
begin
  -- ไม่ใช่ผู้ใช้ (cron, SQL editor) หรือเจ้าของแก้เอง: ไม่ต้องบันทึก
  if actor is null or actor::text = new.id then return new; end if;
  if tg_op = 'UPDATE' then old_data := old.data; end if;

  select coalesce(array_agg(k order by k), '{}') into changed
  from (
    select k from jsonb_object_keys(new.data) k
    union
    select k from jsonb_object_keys(old_data) k
  ) keys
  where (new.data -> k) is distinct from (old_data -> k);

  if array_length(changed, 1) is null then return new; end if;

  insert into public.member_data_log (home_id, target_id, actor_id, action, keys)
  values (new.home_id, new.id, actor, 'edit', changed);
  return new;
end;
$$;
revoke execute on function public.log_health_edit() from public, anon, authenticated;

drop trigger if exists member_health_edit_log on public.home_items;
create trigger member_health_edit_log after insert or update on public.home_items
  for each row when (new.collection = 'member_health')
  execute function public.log_health_edit();

-- ---------- บันทึกการเข้าดู (แอปเรียกตอนเปิดหน้าข้อมูลของสมาชิกคนอื่น) ----------

create or replace function public.log_member_view(p_home uuid, p_target text)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if p_target = me::text then return; end if;
  -- บันทึกได้เฉพาะเมื่อมีสิทธิ์ดูข้อมูลของคนนั้นจริง (กันคนอื่นยิงบันทึกปลอมใส่ใครก็ได้)
  if not public.can_view_member(p_home, p_target) then return; end if;

  if exists (
    select 1 from public.member_data_log
    where actor_id = me and target_id = p_target and action = 'view' and at > now() - interval '15 minutes'
  ) then
    return;
  end if;

  insert into public.member_data_log (home_id, target_id, actor_id, action)
  values (p_home, p_target, me, 'view');

  -- เก็บไว้ 1 ปี ไม่ให้ตารางโตเรื่อย ๆ
  delete from public.member_data_log where at < now() - interval '1 year';
end;
$$;
revoke execute on function public.log_member_view(uuid, text) from public, anon;
grant execute on function public.log_member_view(uuid, text) to authenticated;

-- ============================== เช็คเวลากินยาทุก 1 นาที ==============================
select cron.alter_job((select jobid from cron.job where jobname = 'med-dose-reminders'), schedule := '* * * * *');
