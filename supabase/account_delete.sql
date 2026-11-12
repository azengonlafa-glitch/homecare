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
      delete from public.home_items where home_id = h and collection = 'member_records' and id = uid::text;
    end if;
  end if;

  delete from auth.users where id = uid;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
