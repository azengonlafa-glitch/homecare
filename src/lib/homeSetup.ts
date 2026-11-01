const SETUP_KEY = 'growa_home_setup_v1';

export interface HomeSetup {
  mode: 'join' | 'create';
  /** รหัสเชิญ 8 หลัก (เมื่อ mode = join) */
  inviteCode?: string;
  homeName?: string;
  recipientFirstName?: string;
  recipientLastName?: string;
  timeZone?: string;
  healthConditions?: string[];
  heardFrom?: string;
}

export function loadHomeSetup(): HomeSetup | null {
  try {
    const item = localStorage.getItem(SETUP_KEY);
    return item ? (JSON.parse(item) as HomeSetup) : null;
  } catch {
    return null;
  }
}

export function saveHomeSetup(setup: HomeSetup): void {
  try {
    localStorage.setItem(SETUP_KEY, JSON.stringify(setup));
  } catch (err) {
    console.error('Failed to save home setup to localStorage', err);
  }
}

/** หน้าที่ต้องไปต่อหลังเข้าสู่ระบบ: ถ้ายังไม่เคยเข้าร่วม/สร้างบ้านให้ไปหน้าตั้งค่าบ้านก่อน */
export function pathAfterLogin(): string {
  return loadHomeSetup() ? '/' : '/setup';
}
