-- Growa Smart Consultation v5: ช่องสัญญาณการโทร (WebRTC) ผ่าน Supabase Realtime แบบ private
-- รันต่อจาก consult_v4.sql ไม่แตะตารางเดิม รันซ้ำได้
--
-- เสียงและภาพวิ่งตรงระหว่างผู้ป่วยกับผู้ให้บริการ (เบราว์เซอร์ต่อเบราว์เซอร์) ไม่ผ่านฐานข้อมูล
-- ฐานข้อมูลดูแลแค่ "ใครคุยสัญญาณนัดหมายการโทรของเคสไหนได้" เท่านั้น:
--   - ช่อง consult-call:<รหัสเคส> เข้าได้เฉพาะผู้ป่วยเจ้าของเคส กับเจ้าหน้าที่ที่รับเรื่องเคสนั้น
--   - เฉพาะเคสที่กำลังปรึกษา (active) ปิดเคสแล้วหรือยังไม่มีคนรับ ส่งสัญญาณไม่ได้
--   - เพื่อนร่วมงานที่ไม่ใช่ผู้ดูแลเคส แอดมิน และบัญชีอื่นทั้งหมด ฟังหรือส่งสัญญาณไม่ได้

create or replace function public.consult_can_signal(p_topic text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  sid uuid;
begin
  -- ตรวจรูปแบบก่อนแปลงชนิด กันชื่อช่องแปลก ๆ ทำให้เกิดข้อผิดพลาดแทนที่จะถูกปฏิเสธ
  if p_topic is null or p_topic !~ '^consult-call:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  sid := substr(p_topic, 14)::uuid;
  return exists (
    select 1 from public.consult_sessions s
    where s.id = sid
      and auth.uid() is not null
      and s.status = 'active'
      and (s.patient_id = auth.uid() or (s.assigned_to = auth.uid() and s.provider_id = public.consult_staff_provider()))
  );
end;
$$;

revoke execute on function public.consult_can_signal(text) from public, anon;
grant execute on function public.consult_can_signal(text) to authenticated;

-- Realtime Authorization: ช่อง private ต้องมี policy บน realtime.messages ไม่มี policy = ปฏิเสธทั้งหมด
drop policy if exists consult_call_signal_read on realtime.messages;
create policy consult_call_signal_read on realtime.messages for select to authenticated
  using (realtime.messages.extension = 'broadcast' and public.consult_can_signal((select realtime.topic())));

drop policy if exists consult_call_signal_write on realtime.messages;
create policy consult_call_signal_write on realtime.messages for insert to authenticated
  with check (realtime.messages.extension = 'broadcast' and public.consult_can_signal((select realtime.topic())));
