import { queueSync } from '../cloud/queue';
import { cloudEnabled } from '../cloud/client';
import { useEffect, useState } from 'react';
import type { MemberRecord } from './members';
import { CURRENT_MEMBER_ID, loadSettings } from './settings';

/** สิ่งที่ขออนุญาต: ดูข้อมูล หรือ แก้ไขข้อมูล/จัดตาราง */
export type AccessScope = 'view' | 'edit';
/** คำตอบของเจ้าของข้อมูล: อนุญาตครั้งนี้ / อนุญาตตลอด / ไม่อนุญาต */
export type AccessDecision = 'once' | 'always' | 'denied';

export interface AccessRequest {
  id: string;
  /** ผู้ขออนุญาต */
  requesterId: string;
  /** เจ้าของข้อมูล */
  targetId: string;
  scope: AccessScope;
  message: string;
  decision: 'pending' | AccessDecision;
  createdAt: string;
  decidedAt: string | null;
  /** ใช้สิทธิ์แบบ "อนุญาตครั้งนี้" ไปแล้วหรือยัง (ใช้ได้ครั้งเดียว) */
  usedAt: string | null;
}

const REQUESTS_KEY = 'growa_access_requests_v1';
export const ACCESS_CHANGED_EVENT = 'growa-access-changed';
export const REQUEST_MESSAGE_MAX = 200;

export const SCOPE_LABEL: Record<AccessScope, string> = {
  view: 'ดูข้อมูล',
  edit: 'แก้ไขข้อมูลและจัดตาราง',
};

export const DECISION_LABEL: Record<'pending' | AccessDecision, string> = {
  pending: 'รอการอนุมัติ',
  once: 'อนุญาตครั้งนี้',
  always: 'อนุญาตตลอด',
  denied: 'ไม่อนุญาต',
};

const newId = () =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** คำขอตัวอย่างที่มีอยู่แล้ว (เพื่อให้เห็นหน้าจออนุมัติตั้งแต่เปิดครั้งแรก) */
const seedRequests = (): AccessRequest[] => [
  {
    id: 'seed-req-1',
    requesterId: 'mint',
    targetId: CURRENT_MEMBER_ID,
    scope: 'edit',
    message: 'ขออนุญาตจัดตารางยาให้แม่นะคะ จะได้ไม่ลืมมื้อเช้า',
    decision: 'pending',
    createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    decidedAt: null,
    usedAt: null,
  },
];

export function loadRequests(): AccessRequest[] {
  try {
    const raw = localStorage.getItem(REQUESTS_KEY);
    if (!raw) {
      if (cloudEnabled) return [];
      const seeded = seedRequests();
      localStorage.setItem(REQUESTS_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw) as AccessRequest[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(list: AccessRequest[]): void {
  try {
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(list));
  } catch (err) {
    console.error('Failed to save access requests', err);
  }
  queueSync('access');
  window.dispatchEvent(new Event(ACCESS_CHANGED_EVENT));
}

/** ส่งคำขออนุญาต (ถ้ามีคำขอที่ยังรออยู่แล้ว จะไม่สร้างซ้ำ) */
export function requestAccess(
  targetId: string,
  scope: AccessScope,
  message: string,
  requesterId = CURRENT_MEMBER_ID
): AccessRequest {
  const list = loadRequests();
  const existing = list.find(
    (r) => r.targetId === targetId && r.requesterId === requesterId && r.scope === scope && r.decision === 'pending'
  );
  if (existing) return existing;

  const created: AccessRequest = {
    id: newId(),
    requesterId,
    targetId,
    scope,
    message: message.trim().slice(0, REQUEST_MESSAGE_MAX),
    decision: 'pending',
    createdAt: new Date().toISOString(),
    decidedAt: null,
    usedAt: null,
  };
  persist([created, ...list]);
  return created;
}

/** เจ้าของข้อมูลตอบคำขอ: อนุญาตครั้งนี้ / อนุญาตตลอด / ไม่อนุญาต */
export function decideRequest(requestId: string, decision: AccessDecision): void {
  persist(
    loadRequests().map((r) =>
      r.id === requestId
        ? { ...r, decision, decidedAt: new Date().toISOString(), usedAt: decision === 'once' ? null : r.usedAt }
        : r
    )
  );
}

/** ใช้สิทธิ์แบบอนุญาตครั้งนี้ (หลังเข้าไปแก้ไขเสร็จ สิทธิ์จะหมด) */
export function consumeOnce(requestId: string): void {
  persist(
    loadRequests().map((r) => (r.id === requestId && r.decision === 'once' && !r.usedAt ? { ...r, usedAt: new Date().toISOString() } : r))
  );
}

/** คำขอที่เกี่ยวข้องกับสมาชิกคนหนึ่ง (ใช้แสดงสถานะบนหน้ารายละเอียด) */
export function requestsFor(
  targetId: string,
  requesterId = CURRENT_MEMBER_ID,
  requests = loadRequests()
): AccessRequest[] {
  return requests.filter((r) => r.targetId === targetId && r.requesterId === requesterId);
}

/** สิทธิ์ที่ยังมีผลอยู่ (pending/denied = ไม่มีสิทธิ์) */
function activeGrant(requests: AccessRequest[], targetId: string, requesterId: string, scope: AccessScope) {
  return requests.find(
    (r) =>
      r.targetId === targetId &&
      r.requesterId === requesterId &&
      r.scope === scope &&
      (r.decision === 'always' || (r.decision === 'once' && !r.usedAt))
  );
}

export function isBlocked(record: MemberRecord, requesterId = CURRENT_MEMBER_ID): boolean {
  return record.sharing.blockedEditors.includes(requesterId);
}

/** ดูข้อมูลของสมาชิกคนนี้ได้ไหม (เจ้าตัวเห็นของตัวเองได้เสมอ) */
export function canViewMember(
  record: MemberRecord,
  requesterId = CURRENT_MEMBER_ID,
  requests = loadRequests()
): boolean {
  if (record.id === requesterId) return true;
  if (record.sharing.shareData) return true;
  return !!activeGrant(requests, record.id, requesterId, 'view');
}

/** แก้ไขข้อมูล/จัดตารางของสมาชิกคนนี้ได้ไหม */
export function canEditMember(
  record: MemberRecord,
  requesterId = CURRENT_MEMBER_ID,
  requests = loadRequests()
): boolean {
  if (record.id === requesterId) return true;
  if (isBlocked(record, requesterId)) return false;
  if (record.sharing.editPolicy === 'all') return true;
  if (record.sharing.allowedEditors.includes(requesterId)) return true;
  return !!activeGrant(requests, record.id, requesterId, 'edit');
}

/** คำขอที่ยังรอคำตอบและส่งถึงเรา (ใช้แสดงบนกระดิ่งแจ้งเตือน) */
export function pendingIncoming(requests = loadRequests(), targetId = CURRENT_MEMBER_ID): AccessRequest[] {
  return requests.filter((r) => r.targetId === targetId && r.decision === 'pending');
}

/** ชื่อของสมาชิกจากรหัส (ใช้แสดงชื่อผู้ขอในรายการ) */
export function memberNameById(id: string): string {
  const members = loadSettings().members;
  if (id === CURRENT_MEMBER_ID) return members.find((m) => m.id === id)?.name ?? 'ฉัน';
  return members.find((m) => m.id === id)?.name ?? 'สมาชิก';
}

/** ติดตามการเปลี่ยนแปลงของคำขอ (อัปเดตทันทีเมื่ออนุมัติ/ส่งคำขอใหม่) */
export function useAccessRequests(): AccessRequest[] {
  const [requests, setRequests] = useState<AccessRequest[]>(loadRequests);

  useEffect(() => {
    const refresh = () => setRequests(loadRequests());
    window.addEventListener(ACCESS_CHANGED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(ACCESS_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  return requests;
}
