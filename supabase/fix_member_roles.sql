-- =====================================================================
-- Growa Homecare: แก้บั๊ก "ผู้ดูแลหลักเปลี่ยนบทบาทสมาชิก / มอบบทบาทผู้ดูแลหลักไม่ได้" (รันซ้ำได้)
--
-- เดิม: ตัวกัน guard_member_update ห้ามเปลี่ยน role / home_id / user_id จากทุกทาง
--       รวมถึงฟังก์ชันของระบบ (set_member_role, transfer_ownership) จึงขึ้น forbidden เสมอ
--       ผลคือผู้ดูแลหลักที่ยังมีสมาชิกในบ้าน มอบบทบาทไม่ได้ และลบบัญชีตัวเองไม่ได้
-- ใหม่: ห้ามเฉพาะการแก้ตรงโดยผู้ใช้ (บทบาท authenticated / anon ผ่าน API)
--       ฟังก์ชันของระบบ (SECURITY DEFINER ที่ตรวจสิทธิ์ผู้ดูแลหลักเองแล้ว) ทำงานในบทบาทเจ้าของฟังก์ชัน จึงผ่านได้
-- =====================================================================

create or replace function public.guard_member_update()
returns trigger language plpgsql set search_path = public as $$
begin
  -- current_user คือบทบาทที่กำลังทำงาน: ผู้ใช้ที่แก้ตรงผ่าน API = authenticated/anon
  -- ส่วนฟังก์ชัน SECURITY DEFINER ทำงานในบทบาทเจ้าของฟังก์ชัน (ไม่ใช่ authenticated/anon)
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
