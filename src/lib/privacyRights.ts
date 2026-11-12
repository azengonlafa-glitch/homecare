import { cloudEnabled } from '../cloud/client';
import { deleteMyAccount, wipeEverythingLocal } from '../cloud/engine';
import { readAuthUser } from '../cloud/identity';
import { unsubscribeOnSignOut } from '../consult/push';
import { CONSENT_VERSION } from '../data/consentDocument';
import { currentJournalUser, loadPosts } from './journal';
import { loadFolders } from './folders';
import { loadMemberRecord, saveMemberRecord } from './members';
import { loadMeds } from './meds';
import { loadOnboarding, saveOnboarding } from './onboarding';
import { CURRENT_MEMBER_ID, loadSettings } from './settings';

/**
 * สิทธิเจ้าของข้อมูลตาม PDPA ที่ทำได้เองในแอป: ขอสำเนา (ม.30) ถอนความยินยอม (ม.19) ลบบัญชี (ม.33)
 * ข้อความที่เกี่ยวข้องอยู่ในเอกสารยินยอมข้อ 9 และข้อ 11 (data/consentDocument.ts) ต้องตรงกับที่ทำจริงในไฟล์นี้
 */

/** ข้อมูลที่ไม่อยู่ในไฟล์สำเนา (ต้องบอกผู้ใช้ตรง ๆ ว่าขอได้ทางช่องทางติดต่อ) */
export const EXPORT_NOT_INCLUDED = [
  'ไฟล์แนบและรูปภาพ (มีเฉพาะชื่อไฟล์)',
  'ข้อความและไฟล์ในการปรึกษาเภสัชกรหรือคลินิก',
  'ข้อมูลของสมาชิกคนอื่นในบ้าน',
];

export function buildMyDataExport(now: Date = new Date()) {
  const user = currentJournalUser();
  const account = readAuthUser();
  const onboarding = loadOnboarding();
  // ตัดส่วนที่เป็นข้อมูลของบ้านและคนอื่นออก เหลือเฉพาะการตั้งค่าของตัวเอง
  const { members: _members, inviteCode: _inviteCode, home: _home, homeName: _homeName, ...mySettings } =
    loadSettings() as unknown as Record<string, unknown>;

  return {
    exportedAt: now.toISOString(),
    about: 'สำเนาข้อมูลของคุณที่เก็บไว้ใน Growa Homecare (ฉบับร่างช่วงทดสอบ)',
    notIncluded: EXPORT_NOT_INCLUDED,
    account: { name: user.name, email: account?.email ?? '' },
    consent: {
      acceptedAt: onboarding.profile.consentAt,
      documentVersion: onboarding.profile.consentVersion,
      shareWithHouseholdMembers: onboarding.profile.consentShareHome,
    },
    healthProfile: onboarding.profile,
    settings: mySettings,
    meds: loadMeds(),
    myRecordInHome: loadMemberRecord(CURRENT_MEMBER_ID),
    myJournalPosts: loadPosts().filter((post) => post.authorId === user.id),
    folders: loadFolders(),
  };
}

export function downloadMyData(): void {
  const data = buildMyDataExport();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `growa-my-data-${data.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * ถอนความยินยอมหลัก (ข้อ 4 ก): ใช้แอปต่อไม่ได้จนกว่าจะยินยอมใหม่ ข้อมูลยังอยู่จนกว่าจะลบบัญชี
 * พร้อมปิดการแสดงข้อมูลให้คนในบ้านทันที (ข้อ 4 ข) เพื่อหยุดการเปิดเผยระหว่างรอ
 */
export function withdrawConsent(): void {
  const state = loadOnboarding();
  saveOnboarding({
    ...state,
    completed: false,
    skipped: false,
    profile: { ...state.profile, consent: false, consentAt: null, consentVersion: null, consentShareHome: false },
  });
  const record = loadMemberRecord(CURRENT_MEMBER_ID);
  saveMemberRecord({ ...record, sharing: { ...record.sharing, shareData: false } });
}

/** ลบบัญชีและข้อมูล: โหมดคลาวด์ลบที่เซิร์ฟเวอร์ด้วย โหมดต้นแบบล้างเฉพาะข้อมูลในเครื่อง */
export async function deleteAccountAndData(): Promise<void> {
  if (!cloudEnabled) {
    wipeEverythingLocal();
    window.location.replace('/login');
    return;
  }
  // เครื่องนี้ต้องเลิกรับแจ้งเตือนของบัญชีนี้ก่อน (หลังลบบัญชีจะไม่มีสิทธิ์ลบการสมัครแล้ว) ถ้าไม่สำเร็จไม่ขวางการลบ
  await unsubscribeOnSignOut().catch(() => undefined);
  await deleteMyAccount();
}

/** เวอร์ชันเอกสารที่ใช้อยู่ตอนนี้ (ไว้เทียบว่าที่ผู้ใช้ยอมรับไว้เป็นฉบับล่าสุดหรือไม่) */
export const CURRENT_CONSENT_VERSION = CONSENT_VERSION;
