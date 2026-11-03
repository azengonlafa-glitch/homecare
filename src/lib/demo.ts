import { clearHomeSetup } from './homeSetup';
import { clearOnboarding } from './onboarding';
import { clearAllFiles } from './fileStore';
import { resetHomeData } from './storage';
import { clearJournal } from './journal';
import { clearCalendar } from './calendar';
import { clearMeds } from './meds';

/**
 * เริ่มต้น Demo ใหม่ตั้งแต่ศูนย์: ล้างการตั้งค่าบ้าน ข้อมูลพื้นฐาน ไฟล์แนบ บันทึกอาการ กิจกรรมในปฏิทิน และข้อมูลบ้านตัวอย่าง
 * เพื่อให้ผู้ทดสอบเดินครบทุกขั้น (สร้าง/เข้าร่วมบ้าน -> กรอกข้อมูล -> หน้าหลัก) ได้ทุกครั้งที่กด Demo
 */
export function resetDemoState(): void {
  clearHomeSetup();
  clearOnboarding();
  void clearAllFiles();
  clearJournal();
  clearCalendar();
  clearMeds();
  resetHomeData();
}
