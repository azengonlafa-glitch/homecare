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
