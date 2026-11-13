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

revoke execute on function public.member_sharing(uuid, text) from public, anon;
revoke execute on function public.member_access_granted(uuid, text, text) from public, anon;
revoke execute on function public.can_edit_member(uuid, text) from public, anon;
revoke execute on function public.can_view_member(uuid, text) from public, anon;
grant execute on function public.member_sharing(uuid, text) to authenticated;
grant execute on function public.member_access_granted(uuid, text, text) to authenticated;
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
