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
