import { useEffect, useState, useCallback, useRef } from 'react';
import {
  MEDS_CHANGED_EVENT,
  PERIOD_LABEL,
  findLog,
  isDue,
  isScheduledOn,
  periodTime,
  stockLevel,
  daysLeft,
  daysToExpiry,
  doseWords,
  todayKey,
  loadMeds,
  type DoseLog,
  type DosePeriod,
  type Medication,
  type MedsState,
} from './meds';
import { parseKey, type CalendarEvent, eventsByDay, addDays, CALENDAR_CHANGED_EVENT, loadEvents } from './calendar';
import type { HouseholdMember, AppSettings } from './settings';
import { CURRENT_MEMBER_ID, SETTINGS_CHANGED_EVENT, loadSettings } from './settings';
import { MEMBERS_CHANGED_EVENT, loadMemberRecord, type MemberRecord } from './members';
import { JOURNAL_CHANGED_EVENT, loadPosts, type JournalPost } from './journal';
import { canViewMember } from './access';
import {
  classifyBp,
  classifyGlucose,
  hasDiabetes,
  isAppointmentFor,
  isMedicalEvent,
  medFromMember,
} from './memberDashboard';

// ==========================================
// 1. ชนิดข้อมูลและการจัดหมวดหมู่ (Types)
// ==========================================

export type NotificationCategory = 'medication' | 'appointment' | 'family' | 'system';

export type NotificationType =
  // Medication
  | 'dose_due'
  | 'dose_unconfirmed'
  | 'dose_skipped'
  | 'dose_upcoming'
  | 'stock_low'
  | 'stock_out'
  | 'med_expiring'
  // Appointment
  | 'appointment_upcoming'
  | 'checkup_due'
  | 'appointment_changed'
  // Family
  | 'health_change'
  | 'new_med'
  | 'treatment_updated'
  | 'journal_posted'
  | 'new_member'
  // System
  | 'sync_success'
  | 'order_success'
  | 'delivery_updated';

export type NotificationPriority = 'urgent' | 'important' | 'routine';
export type NotificationActionStatus = 'pending' | 'resolved' | 'dismissed';

export interface NotificationRecipientRecord {
  memberId: string;
  memberName: string;
  role: 'caregiver' | 'patient' | 'family';
  deliveredAt: string;
  readAt?: string | null;
}

export interface HealthNotification {
  id: string;
  fingerprint: string; // คีย์ระบุเอกลักษณ์ ป้องกันการส่งซ้ำ
  category: NotificationCategory;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  body: string;
  detail?: string;

  // สมาชิกที่เกี่ยวข้อง
  memberId?: string;
  memberName?: string;
  actorId?: string;
  actorName?: string;

  // ลิงก์นำทาง & ปุ่มดำเนินการ
  link?: string;
  actionLabel?: string;

  // ข้อมูลบริบทเฉพาะ
  medId?: string;
  medName?: string;
  period?: DosePeriod;
  dateKey?: string; // yyyy-mm-dd
  eventId?: string;

  // ประวัติผู้รับ (บันทึกว่าแจ้งเตือนไปหาใครและเมื่อไร)
  recipients: NotificationRecipientRecord[];

  createdAt: string;
  escalatedAt?: string | null; // เวลาที่ส่งต่อหาผู้ดูแลเมื่อเลยกำหนด

  // สถานะการอ่านของตัวผู้ใช้ปัจจุบัน
  isRead: boolean;
  readAt?: string | null;

  // สถานะการจัดการ (แยกสถานะอ่านแล้วกับสถานะจัดการแล้ว)
  actionStatus: NotificationActionStatus;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  resolveReason?: string | null;
}

// 2.3 การตั้งค่าผู้รับการแจ้งเตือน
export type RecipientPermission = 'all' | 'important_only' | 'own_only' | 'none';

export interface MemberRoutingConfig {
  memberId: string;
  medication: RecipientPermission;
  appointment: RecipientPermission;
  family: RecipientPermission;
  system: RecipientPermission;
  escalationDelayMin: number; // เช่น 15, 30, 45, 60 นาที
}

export const NOTIFICATIONS_STORAGE_KEY = 'growa_notifications_v2';
export const NOTIFICATIONS_CHANGED_EVENT = 'growa-notifications-changed';
export const ROUTING_SETTINGS_STORAGE_KEY = 'growa_notification_routing_v1';

export const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  medication: 'ยาและการดูแล',
  appointment: 'นัดหมายแพทย์',
  family: 'เหตุการณ์ในครอบครัว',
  system: 'ระบบ',
};

export const PRIORITY_LABELS: Record<NotificationPriority, string> = {
  urgent: 'เร่งด่วน',
  important: 'สำคัญ',
  routine: 'ทั่วไป',
};

export const DEFAULT_ESCALATION_DELAY_MIN = 30;

// ==========================================
// 2. การกำหนดค่าเริ่มต้นและการตั้งค่าผู้รับ (Routing Rules)
// ==========================================

export function defaultRoutingForMember(
  member: HouseholdMember,
  primaryCaregiverId?: string
): MemberRoutingConfig {
  const isPrimaryCaregiver = member.role === 'owner' || member.id === primaryCaregiverId;
  if (isPrimaryCaregiver) {
    return {
      memberId: member.id,
      medication: 'all',
      appointment: 'all',
      family: 'all',
      system: 'all',
      escalationDelayMin: DEFAULT_ESCALATION_DELAY_MIN,
    };
  }

  // สมาชิกทั่วไป หรือผู้สูงอายุ/ผู้ป่วย
  return {
    memberId: member.id,
    medication: 'own_only',
    appointment: 'own_only',
    family: 'important_only',
    system: 'important_only',
    escalationDelayMin: DEFAULT_ESCALATION_DELAY_MIN,
  };
}

export function loadRoutingConfigs(members: HouseholdMember[]): Record<string, MemberRoutingConfig> {
  const result: Record<string, MemberRoutingConfig> = {};
  const owner = members.find((m: HouseholdMember) => m.role === 'owner');
  for (const m of members) {
    result[m.id] = defaultRoutingForMember(m, owner?.id);
  }

  try {
    const raw = localStorage.getItem(ROUTING_SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, Partial<MemberRoutingConfig>>;
      for (const m of members) {
        if (parsed[m.id]) {
          result[m.id] = { ...result[m.id], ...parsed[m.id] };
        }
      }
    }
  } catch {
    // ใช้ค่าเริ่มต้น
  }

  return result;
}

export function saveRoutingConfigs(configs: Record<string, MemberRoutingConfig>): void {
  try {
    localStorage.setItem(ROUTING_SETTINGS_STORAGE_KEY, JSON.stringify(configs));
  } catch {
    // ข้ามได้
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
  }
}

/** ตรวจสอบว่าสมาชิกคนนี้มีสิทธิ์รับการแจ้งเตือนนี้หรือไม่ (ทั้งด้าน Routing และ Privacy Access Control) */
export function shouldDeliverToMember(
  notification: Pick<HealthNotification, 'category' | 'priority' | 'memberId'>,
  memberId: string,
  configs: Record<string, MemberRoutingConfig>,
  memberRecords?: Record<string, MemberRecord>
): boolean {
  // 1. Privacy & Authorization: ข้อมูลคลินิกเฉพาะบุคคล (ยา / สัญญาณชีพ / การเปลี่ยนแปลงสุขภาพ)
  // หากแจ้งเตือนข้อมูลของสมาชิกคนอื่น ผู้รับต้องมีสิทธิ์ดูข้อมูลของสมาชิกคนนั้น (canViewMember)
  if (notification.memberId && notification.memberId !== memberId) {
    if (notification.category === 'medication' || notification.category === 'family') {
      if (memberRecords && memberRecords[notification.memberId]) {
        const targetRec = memberRecords[notification.memberId];
        if (!canViewMember(targetRec, memberId)) {
          return false;
        }
      }
    }
  }

  // 2. Routing Configuration
  const cfg = configs[memberId];
  if (!cfg) return true;

  const perm = cfg[notification.category];
  if (perm === 'none') return false;
  if (perm === 'all') return true;
  if (perm === 'important_only') {
    return notification.priority === 'urgent' || notification.priority === 'important';
  }
  if (perm === 'own_only') {
    if (!notification.memberId) return true;
    return notification.memberId === memberId;
  }
  return true;
}

// ==========================================
// 3. ตัวช่วยคำนวณเวลาและการตรวจจับเหตุการณ์
// ==========================================

const minutesOf = (hhmm: string): number => {
  const [h, mi] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (mi || 0);
};

export interface NotificationGenerationContext {
  now?: Date;
  settings: AppSettings;
  medsState: MedsState;
  memberRecords?: Record<string, MemberRecord>;
  events?: CalendarEvent[];
  posts?: JournalPost[];
  routingConfigs?: Record<string, MemberRoutingConfig>;
}

/**
 * สร้างและรวบรวมเหตุการณ์การแจ้งเตือนสุขภาพทั้งหมดตามกฎทางสุขภาพ:
 * 1. ยา: ถึงเวลา, เลยเวลา, ข้ามยา, ใกล้ถึงเวลา, ยาหมด/ใกล้หมด, หมดอายุ
 * 2. นัดหมาย: ใกล้ถึงวันนัดแพทย์, ถึงกำหนดตรวจสุขภาพประจำปี/โรคเรื้อรัง
 * 3. ครอบครัว: ค่าสุขภาพผิดปกติ, เพิ่มยาใหม่, เพิ่มบันทึกอาการ, สมาชิกใหม่
 * 4. ระบบ: การขอเติมยาสำเร็จ, การซิงก์ข้อมูล
 */
export function generateHealthNotifications(
  ctx: NotificationGenerationContext,
  existingList: HealthNotification[] = []
): HealthNotification[] {
  const now = ctx.now ?? new Date();
  const today = todayKey(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const members: HouseholdMember[] = ctx.settings.members;
  const owner = members.find((m: HouseholdMember) => m.role === 'owner') ?? members[0];
  const routing = ctx.routingConfigs ?? loadRoutingConfigs(members);

  const existingMap = new Map<string, HealthNotification>();
  for (const item of existingList) {
    existingMap.set(item.fingerprint, item);
  }

  const generated: HealthNotification[] = [];

  // ----------------------------------------------------
  // หมวด 1: ยาและการดูแล (Medication Notifications)
  // ครอบคลุมทั้งยาของผู้ใช้ปัจจุบัน และยาของสมาชิกทุกคนในบ้าน
  // ----------------------------------------------------
  const inspectMedicationDoses = (
    targetMemberId: string,
    targetMemberName: string,
    meds: Medication[],
    logs: DoseLog[]
  ) => {
    const activeMeds = meds.filter((m) => m.active);
    for (const med of activeMeds) {
      // คำตามรูปแบบยา (กิน/ฉีด/หยอด/ทา/พ่น/ตรวจ/ใช้) ให้ตรงกับหน้ายาและตัวเตือนบนหน้าบันทึกอาการ
      const w = doseWords(med.form);
      // 1.1 ตรวจสอบมื้อยาของวันนี้
      if (isScheduledOn(med, today)) {
        for (const p of med.periods as DosePeriod[]) {
          const schedTime = periodTime(med, p);
          const schedMin = minutesOf(schedTime);
          const log = findLog(logs, today, med.id, p);

          // A) มีการบันทึกว่า "ข้ามยา" หรือ "ไม่ได้กิน" (dose_skipped)
          if (log && (log.status === 'skipped' || log.status === 'missed')) {
            const fp = `med:dose_skipped:${today}:${targetMemberId}:${med.id}:${p}`;
            const isMeMember = targetMemberId === CURRENT_MEMBER_ID;
            const title =
              log.status === 'skipped'
                ? `มีการข้ามยา ${med.name} (มื้อ${PERIOD_LABEL[p as DosePeriod]})` + (!isMeMember ? ` ของ ${targetMemberName}` : '')
                : `ไม่ได้${w.phrase} ${med.name} (มื้อ${PERIOD_LABEL[p as DosePeriod]})` + (!isMeMember ? ` ของ ${targetMemberName}` : '');
            const body = log.reason
              ? `ระบุเหตุผล: ${log.reason}`
              : `บันทึกเวลา ${new Date(log.at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`;

            generated.push(
              buildOrMerge(existingMap, {
                fingerprint: fp,
                category: 'medication',
                type: 'dose_skipped',
                priority: log.status === 'skipped' ? 'important' : 'urgent',
                title,
                body,
                detail: `มื้อ${PERIOD_LABEL[p]} ${schedTime} น. ${body}`,
                memberId: targetMemberId,
                memberName: targetMemberName,
                medId: med.id,
                medName: med.name,
                period: p,
                dateKey: today,
                link: targetMemberId === CURRENT_MEMBER_ID ? '/meds' : `/members/${targetMemberId}`,
                actionLabel: 'ดูตารางยา',
                actionStatus: 'resolved',
                resolveReason: log.status === 'skipped' ? 'งดยาตามคำแนะนำ' : 'บันทึกว่าไม่ได้รับประทาน',
                resolvedAt: log.at,
                createdAt: log.at,
                now,
                members,
                ownerId: owner?.id,
                routing,
                memberRecords: ctx.memberRecords,
              })
            );
          }

          // B) ยังไม่มีการบันทึก (ยังไม่ได้กิน)
          if (!log) {
            // B1: ถึงเวลาหรือเลยเวลารับประทานยาแล้ว (dose_due หรือ dose_unconfirmed)
            if (nowMin >= schedMin) {
              const isLate = isDue(med, p, now); // เลยเวลาผ่อนผัน
              const fp = isLate
                ? `med:dose_unconfirmed:${today}:${targetMemberId}:${med.id}:${p}`
                : `med:dose_due:${today}:${targetMemberId}:${med.id}:${p}`;
              const isMeMember = targetMemberId === CURRENT_MEMBER_ID;
              const title = isLate
                ? `ยังไม่ได้${w.phrase}: ${med.name}` + (!isMeMember ? ` (${targetMemberName})` : '')
                : `ถึงเวลา${w.phrase}: ${med.name}` + (!isMeMember ? ` (${targetMemberName})` : '');
              const body = isLate
                ? `มื้อ${PERIOD_LABEL[p as DosePeriod]} (${schedTime} น.) เลยเวลากำหนดแล้ว กรุณาตรวจสอบ`
                : `มื้อ${PERIOD_LABEL[p as DosePeriod]} ${schedTime} น. ครั้งละ ${med.perDose} ${med.unit}`;

              const escalationDelay = routing[targetMemberId]?.escalationDelayMin ?? DEFAULT_ESCALATION_DELAY_MIN;
              const minutesPast = nowMin - schedMin;
              const isEscalated = minutesPast >= escalationDelay;

              generated.push(
                buildOrMerge(existingMap, {
                  fingerprint: fp,
                  category: 'medication',
                  type: isLate ? 'dose_unconfirmed' : 'dose_due',
                  priority: isLate ? 'urgent' : 'important',
                  title,
                  body,
                  detail: `เวลาตามตาราง: ${schedTime} น. (เลยเวลามา ${minutesPast} นาที)`,
                  memberId: targetMemberId,
                  memberName: targetMemberName,
                  medId: med.id,
                  medName: med.name,
                  period: p,
                  dateKey: today,
                  link: targetMemberId === CURRENT_MEMBER_ID ? '/meds' : `/members/${targetMemberId}`,
                  actionLabel: targetMemberId === CURRENT_MEMBER_ID ? `ยืนยันการ${w.phrase}` : 'ดูข้อมูลยา',
                  actionStatus: 'pending',
                  escalatedAt: isEscalated ? now.toISOString() : null,
                  createdAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), Math.floor(schedMin / 60), schedMin % 60).toISOString(),
                  now,
                  members,
                  ownerId: owner?.id,
                  routing,
                  memberRecords: ctx.memberRecords,
                })
              );
            }
            // B2: ใกล้ถึงเวลารับประทานยารอบถัดไป (dose_upcoming) ภายใน 30 นาทีข้างหน้า
            else if (schedMin - nowMin <= 30 && schedMin - nowMin > 0) {
              const minutesUntil = schedMin - nowMin;
              const fp = `med:dose_upcoming:${today}:${targetMemberId}:${med.id}:${p}`;
              generated.push(
                buildOrMerge(existingMap, {
                  fingerprint: fp,
                  category: 'medication',
                  type: 'dose_upcoming',
                  priority: 'routine',
                  title: `ใกล้ถึงเวลา${w.phrase} ${med.name}` + (targetMemberId !== CURRENT_MEMBER_ID ? ` (${targetMemberName})` : ''),
                  body: `มื้อ${PERIOD_LABEL[p as DosePeriod]} ในอีก ${minutesUntil} นาที (${schedTime} น.)`,
                  memberId: targetMemberId,
                  memberName: targetMemberName,
                  medId: med.id,
                  medName: med.name,
                  period: p,
                  dateKey: today,
                  link: targetMemberId === CURRENT_MEMBER_ID ? '/meds' : `/members/${targetMemberId}`,
                  actionLabel: 'เตรียมยา',
                  actionStatus: 'pending',
                  createdAt: now.toISOString(),
                  now,
                  members,
                  ownerId: owner?.id,
                  routing,
                  memberRecords: ctx.memberRecords,
                })
              );
            }
          }
        }
      }

      // 1.1.b ตรวจสอบมื้อยาข้ามเที่ยงคืนของวันถัดไป (Midnight Wrap-around เช่น 00:15 น.)
      if (nowMin >= 1410) {
        const tomorrow = todayKey(addDays(now, 1));
        if (isScheduledOn(med, tomorrow)) {
          for (const p of med.periods as DosePeriod[]) {
            const schedTime = periodTime(med, p);
            const schedMin = minutesOf(schedTime);
            if (schedMin <= 60) {
              const minutesUntil = schedMin + 1440 - nowMin;
              if (minutesUntil <= 30 && minutesUntil > 0) {
                const log = findLog(logs, tomorrow, med.id, p);
                if (!log) {
                  const fp = `med:dose_upcoming:${tomorrow}:${targetMemberId}:${med.id}:${p}`;
                  generated.push(
                    buildOrMerge(existingMap, {
                      fingerprint: fp,
                      category: 'medication',
                      type: 'dose_upcoming',
                      priority: 'routine',
                      title: `ใกล้ถึงเวลา${w.phrase} ${med.name}` + (targetMemberId !== CURRENT_MEMBER_ID ? ` (${targetMemberName})` : ''),
                      body: `มื้อ${PERIOD_LABEL[p as DosePeriod]} ในอีก ${minutesUntil} นาที (${schedTime} น.)`,
                      memberId: targetMemberId,
                      memberName: targetMemberName,
                      medId: med.id,
                      medName: med.name,
                      period: p,
                      dateKey: tomorrow,
                      link: targetMemberId === CURRENT_MEMBER_ID ? '/meds' : `/members/${targetMemberId}`,
                      actionLabel: 'เตรียมยา',
                      actionStatus: 'pending',
                      createdAt: now.toISOString(),
                      now,
                      members,
                      ownerId: owner?.id,
                      routing,
                      memberRecords: ctx.memberRecords,
                    })
                  );
                }
              }
            }
          }
        }
      }

      // 1.2 สต็อกยา: ยาหมด หรือ ยาใกล้หมด
      const level = stockLevel(med);
      if (level !== 'good') {
        const out = med.remaining <= 0;
        const days = daysLeft(med);
        const fp = `med:stock:${targetMemberId}:${med.id}:${out ? 'out' : 'low'}`;
        generated.push(
          buildOrMerge(existingMap, {
            fingerprint: fp,
            category: 'medication',
            type: out ? 'stock_out' : 'stock_low',
            priority: out ? 'urgent' : 'important',
            title: out ? `ยาหมดแล้ว: ${med.name} (${targetMemberName})` : `ยาใกล้หมด: ${med.name} (${targetMemberName})`,
            body: out
              ? 'คงเหลือ 0 หน่วย กรุณาเติมยาหรือติดต่อเภสัชกร'
              : `พอ${w.use}อีกประมาณ ${days ?? 0} วัน (เหลือ ${med.remaining} ${med.unit})`,
            memberId: targetMemberId,
            memberName: targetMemberName,
            medId: med.id,
            medName: med.name,
            link: targetMemberId === CURRENT_MEMBER_ID ? '/meds' : `/members/${targetMemberId}`,
            actionLabel: 'ดูยา',
            actionStatus: 'pending',
            createdAt: now.toISOString(),
            now,
            members,
            ownerId: owner?.id,
            routing,
            memberRecords: ctx.memberRecords,
          })
        );
      }

      // 1.3 วันหมดอายุยา
      const daysExp = daysToExpiry(med, now);
      if (daysExp !== null && daysExp <= 30) {
        const expired = daysExp < 0;
        const fp = `med:expiry:${targetMemberId}:${med.id}:${expired ? 'exp' : 'near'}`;
        generated.push(
          buildOrMerge(existingMap, {
            fingerprint: fp,
            category: 'medication',
            type: 'med_expiring',
            priority: expired ? 'urgent' : 'important',
            title: expired ? `ยาหมดอายุแล้ว: ${med.name} (${targetMemberName})` : `ยาใกล้หมดอายุ: ${med.name} (${targetMemberName})`,
            body: expired
              ? `หมดอายุเมื่อ ${med.expiryDate} ไม่ควรนำมา${w.use}`
              : `จะหมดอายุในอีก ${daysExp} วัน (${med.expiryDate})`,
            memberId: targetMemberId,
            memberName: targetMemberName,
            medId: med.id,
            medName: med.name,
            link: targetMemberId === CURRENT_MEMBER_ID ? '/meds' : `/members/${targetMemberId}`,
            actionLabel: 'ตรวจสอบยา',
            actionStatus: 'pending',
            createdAt: now.toISOString(),
            now,
            members,
            ownerId: owner?.id,
            routing,
            memberRecords: ctx.memberRecords,
          })
        );
      }
    }
  };

  // ตรวจสอบยาของตนเอง
  const myName = members.find((m: HouseholdMember) => m.id === CURRENT_MEMBER_ID)?.name ?? 'ฉัน';
  inspectMedicationDoses(CURRENT_MEMBER_ID, myName, ctx.medsState.meds, ctx.medsState.logs);

  // ตรวจสอบยาของสมาชิกคนอื่นในครอบครัว (ถ้ามี)
  if (ctx.memberRecords) {
    for (const [mId, rec] of Object.entries(ctx.memberRecords)) {
      if (mId === CURRENT_MEMBER_ID) continue;
      const mem = members.find((m: HouseholdMember) => m.id === mId);
      if (rec.meds && rec.meds.length > 0) {
        const convertedMeds = rec.meds.map((rm) => medFromMember(rm, rec.doseLogs ?? []));
        inspectMedicationDoses(mId, mem?.name ?? 'สมาชิก', convertedMeds, rec.doseLogs ?? []);
      }
    }
  }

  // ----------------------------------------------------
  // หมวด 2: การแจ้งเตือนนัดหมาย (ในปฏิทิน)
  // กรองเฉพาะนัดหมายทางการแพทย์และการตรวจสุขภาพ และระบุสมาชิกให้ตรงตัว
  // ----------------------------------------------------
  if (ctx.events && ctx.events.length > 0) {
    const map = eventsByDay(ctx.events, now, addDays(now, 7));
    for (const [dayStr, occurrences] of map.entries()) {
      const daysDiff = Math.round((parseKey(dayStr).getTime() - parseKey(today).getTime()) / 86_400_000);
      if (daysDiff < 0 || daysDiff > 3) continue;

      for (const occ of occurrences) {
        const ev = occ.event;
        // กรองเฉพาะกิจกรรมทางการแพทย์ (ไม่รวมกิจกรรมทั่วไป เช่น ซื้อของ, วันเกิด)
        if (!isMedicalEvent(ev)) continue;

        const targetMember = members.find((m: HouseholdMember) =>
          isAppointmentFor(ev, m, members, m.id === CURRENT_MEMBER_ID)
        );
        const memberId = targetMember?.id;
        const memberName = targetMember?.name;

        const fp = `appt:upcoming:${ev.id}:${dayStr}`;
        const dayLabel = daysDiff === 0 ? 'วันนี้' : daysDiff === 1 ? 'พรุ่งนี้' : `ในอีก ${daysDiff} วัน (${dayStr})`;
        const title = `ใกล้ถึงวันนัดแพทย์: ${ev.title}${memberName ? ` (${memberName})` : ''}`;
        const body = `${dayLabel}${ev.allDay ? ' (ทั้งวัน)' : ` เวลา ${ev.startTime} น.`}${ev.location?.name ? ` ที่ ${ev.location.name}` : ''}`;

        generated.push(
          buildOrMerge(existingMap, {
            fingerprint: fp,
            category: 'appointment',
            type: 'appointment_upcoming',
            priority: daysDiff <= 1 ? 'urgent' : 'important',
            title,
            body,
            detail: ev.description || undefined,
            eventId: ev.id,
            memberId,
            memberName,
            link: '/calendar',
            actionLabel: 'ดูในปฏิทิน',
            actionStatus: 'pending',
            createdAt: now.toISOString(),
            now,
            members,
            ownerId: owner?.id,
            routing,
            memberRecords: ctx.memberRecords,
          })
        );
      }
    }
  }

  // ตรวจสอบ "ถึงกำหนดตรวจสุขภาพ" (checkup_due)
  if (ctx.memberRecords) {
    for (const [mId, rec] of Object.entries(ctx.memberRecords)) {
      const hasChronic = hasDiabetes(rec.health.conditions) || rec.health.conditions.some((c) => c.includes('ความดัน'));
      if (hasChronic) {
        // ตรวจสอบว่าในประวัติมีบันทึกตรวจสุขภาพในรอบ 6 เดือนหรือไม่
        const lastCheck = rec.health.history.slice().sort((a, b) => b.at.localeCompare(a.at))[0];
        const monthsSince = lastCheck
          ? (now.getTime() - parseKey(lastCheck.at).getTime()) / (30 * 86_400_000)
          : 99;
        if (monthsSince >= 6) {
          const mem = members.find((m: HouseholdMember) => m.id === mId);
          const fp = `appt:checkup_due:${mId}:${now.getFullYear()}-${now.getMonth() < 6 ? 'H1' : 'H2'}`;
          generated.push(
            buildOrMerge(existingMap, {
              fingerprint: fp,
              category: 'appointment',
              type: 'checkup_due',
              priority: 'important',
              title: `ถึงกำหนดตรวจติดตามสุขภาพของ ${mem?.name ?? 'สมาชิก'}`,
              body: `ผู้มีประวัติโรคเรื้อรังควรพบแพทย์หรือตรวจเลือดติดตามผลทุก 6 เดือน`,
              memberId: mId,
              memberName: mem?.name,
              link: `/members/${mId}`,
              actionLabel: 'ดูประวัติสุขภาพ',
              actionStatus: 'pending',
              createdAt: now.toISOString(),
              now,
              members,
              ownerId: owner?.id,
              routing,
              memberRecords: ctx.memberRecords,
            })
          );
        }
      }
    }
  }

  // ----------------------------------------------------
  // หมวด 3: การแจ้งเตือนในครอบครัว (Family Health & Activity)
  // ----------------------------------------------------
  if (ctx.memberRecords) {
    for (const [mId, rec] of Object.entries(ctx.memberRecords)) {
      const mem = members.find((m: HouseholdMember) => m.id === mId);
      const readings = rec.vitals ?? [];
      const freshSince = now.getTime() - 48 * 3_600_000; // ภายใน 48 ชม.
      const recentReadings = readings.filter((r) => new Date(r.at).getTime() >= freshSince);

      for (const r of recentReadings) {
        let abnormal = false;
        let changeText = '';

        if (r.systolic != null && r.diastolic != null) {
          const bp = classifyBp(r.systolic, r.diastolic);
          if (bp.severity !== 'ok') {
            abnormal = true;
            changeText = `ความดัน ${r.systolic}/${r.diastolic} mmHg (${bp.label})`;
          }
        }
        if (r.glucose != null) {
          const glu = classifyGlucose(r.glucose, r.glucoseTiming, hasDiabetes(rec.health.conditions));
          if (glu.severity !== 'ok') {
            abnormal = true;
            changeText = changeText ? `${changeText}, น้ำตาล ${r.glucose} มก./ดล. (${glu.label})` : `น้ำตาล ${r.glucose} มก./ดล. (${glu.label})`;
          }
        }

        if (abnormal) {
          const fp = `family:health_change:${mId}:${r.id}`;
          generated.push(
            buildOrMerge(existingMap, {
              fingerprint: fp,
              category: 'family',
              type: 'health_change',
              priority: 'urgent',
              title: `${mem?.name ?? 'สมาชิก'} มีการเปลี่ยนแปลงข้อมูลสุขภาพ`,
              body: changeText,
              detail: r.note ? `บันทึกเพิ่มเติม: ${r.note}` : undefined,
              memberId: mId,
              memberName: mem?.name,
              link: `/members/${mId}`,
              actionLabel: 'ดูข้อมูลสุขภาพ',
              actionStatus: 'pending',
              createdAt: r.at,
              now,
              members,
              ownerId: owner?.id,
              routing,
              memberRecords: ctx.memberRecords,
            })
          );
        }
      }
    }
  }

  // 3.4 สมาชิกในครอบครัวเพิ่มบันทึกสุขภาพ / สมาชิกโพสต์
  if (ctx.posts && ctx.posts.length > 0) {
    const freshSince = now.getTime() - 24 * 3_600_000; // ภายใน 24 ชม.
    const recentPosts = ctx.posts.filter((p) => new Date(p.createdAt).getTime() >= freshSince);
    for (const p of recentPosts) {
      if (p.authorId !== CURRENT_MEMBER_ID) {
        const fp = `family:journal_posted:${p.id}`;
        const hasSymptoms = p.symptoms.length > 0;
        generated.push(
          buildOrMerge(existingMap, {
            fingerprint: fp,
            category: 'family',
            type: 'journal_posted',
            priority: hasSymptoms ? 'important' : 'routine',
            title: `${p.authorName} เพิ่มบันทึกสุขภาพใหม่`,
            body: hasSymptoms ? `บันทึกอาการ: ${p.symptoms.join(', ')}` : (p.title || p.content || 'มีบันทึกใหม่ในบ้าน'),
            detail: p.content,
            actorId: p.authorId,
            actorName: p.authorName,
            link: '/journal',
            actionLabel: 'ดูบันทึกอาการ',
            actionStatus: 'pending',
            createdAt: p.createdAt,
            now,
            members,
            ownerId: owner?.id,
            routing,
            memberRecords: ctx.memberRecords,
          })
        );
      }
    }
  }

  // ----------------------------------------------------
  // หมวด 4: การแจ้งเตือนระบบ (System Notifications)
  // ----------------------------------------------------
  // (ยังไม่มีการแจ้งเตือนระบบที่สร้างอัตโนมัติ)

  // รวมรายการเดิมที่ยังไม่ถูกแทนที่ (เช่น การแจ้งเตือนเก่าที่ยังค้างอยู่)
  const finalMap = new Map<string, HealthNotification>();
  for (const item of existingList) {
    finalMap.set(item.id, item);
  }
  for (const item of generated) {
    finalMap.set(item.id, item);
  }

  return [...finalMap.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** ตัวช่วยสร้างหรืออัปเดตการแจ้งเตือนโดยไม่สูญเสียสถานะการอ่าน/การจัดการเดิม */
function buildOrMerge(
  existingMap: Map<string, HealthNotification>,
  params: {
    fingerprint: string;
    category: NotificationCategory;
    type: NotificationType;
    priority: NotificationPriority;
    title: string;
    body: string;
    detail?: string;
    memberId?: string;
    memberName?: string;
    actorId?: string;
    actorName?: string;
    medId?: string;
    medName?: string;
    period?: DosePeriod;
    dateKey?: string;
    eventId?: string;
    link?: string;
    actionLabel?: string;
    actionStatus?: NotificationActionStatus;
    resolveReason?: string;
    resolvedAt?: string;
    escalatedAt?: string | null;
    createdAt: string;
    now: Date;
    members: HouseholdMember[];
    ownerId?: string;
    routing: Record<string, MemberRoutingConfig>;
    memberRecords?: Record<string, MemberRecord>;
  }
): HealthNotification {
  const existing = existingMap.get(params.fingerprint);
  const id = existing?.id ?? `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // สร้างรายชื่อผู้รับเริ่มต้น
  const recipients: NotificationRecipientRecord[] = [];
  for (const m of params.members) {
    if (shouldDeliverToMember(params, m.id, params.routing, params.memberRecords)) {
      const isPatient = m.id === params.memberId;
      const isCaregiver = m.role === 'owner' || m.id === params.ownerId;
      recipients.push({
        memberId: m.id,
        memberName: m.name,
        role: isPatient ? 'patient' : isCaregiver ? 'caregiver' : 'family',
        deliveredAt: params.createdAt,
        readAt: existing?.recipients.find((r) => r.memberId === m.id)?.readAt ?? null,
      });
    }
  }

  const isRead = existing ? existing.isRead : false;
  const actionStatus = existing ? existing.actionStatus : (params.actionStatus ?? 'pending');
  const resolveReason = existing?.resolveReason ?? params.resolveReason;
  const resolvedAt = existing?.resolvedAt ?? params.resolvedAt;

  return {
    id,
    fingerprint: params.fingerprint,
    category: params.category,
    type: params.type,
    priority: params.priority,
    title: params.title,
    body: params.body,
    detail: params.detail,
    memberId: params.memberId,
    memberName: params.memberName,
    actorId: params.actorId,
    actorName: params.actorName,
    link: params.link,
    actionLabel: params.actionLabel,
    medId: params.medId,
    medName: params.medName,
    period: params.period,
    dateKey: params.dateKey,
    eventId: params.eventId,
    recipients: recipients.length > 0 ? recipients : (existing?.recipients ?? []),
    createdAt: existing?.createdAt ?? params.createdAt,
    escalatedAt: params.escalatedAt ?? existing?.escalatedAt ?? null,
    isRead,
    readAt: existing?.readAt ?? null,
    actionStatus,
    resolvedAt,
    resolveReason,
    resolvedBy: existing?.resolvedBy,
  };
}

// ==========================================
// 4. กฎการปรับสถานะอัตโนมัติ (Auto-Resolve Engine)
// ==========================================

/**
 * กฎ: "หากสมาชิกยืนยันการรับประทานยาแล้ว ต้องปรับสถานะการแจ้งเตือนให้สอดคล้องกัน"
 * ค้นหาแจ้งเตือนเรื่องยาที่ตรงกับ (medId, period, dateKey) และปรับสถานะเป็น resolved ทันที
 * หากมีการกดยกเลิกการกินยา (Uncheck) ให้คืนสถานะเป็น pending
 */
export function autoResolveMedNotifications(
  notifications: HealthNotification[],
  logs: DoseLog[],
  now = new Date(),
  allLogsByMember?: Record<string, DoseLog[]>
): { updated: HealthNotification[]; changedCount: number } {
  let changedCount = 0;
  const today = todayKey(now);
  const updated = notifications.map((n) => {
    if (n.category !== 'medication' || !n.medId || !n.period || !n.dateKey) {
      return n;
    }

    const memberLogPool: DoseLog[] = (n.memberId && allLogsByMember?.[n.memberId]) ? allLogsByMember[n.memberId]! : logs;
    const log = findLog(memberLogPool, n.dateKey, n.medId, n.period);

    if (log) {
      if (log.status === 'taken' && n.actionStatus === 'pending') {
        changedCount++;
        return {
          ...n,
          actionStatus: 'resolved' as const,
          resolveReason: 'สมาชิกรับประทานยาแล้ว',
          resolvedAt: log.at || now.toISOString(),
          resolvedBy: log.byName || 'ผู้ใช้',
          isRead: true,
          readAt: n.readAt ?? now.toISOString(),
        };
      }

      if ((log.status === 'skipped' || log.status === 'missed') && n.actionStatus === 'pending') {
        changedCount++;
        return {
          ...n,
          actionStatus: 'resolved' as const,
          resolveReason: log.status === 'skipped' ? 'บันทึกงดยาตามแพทย์สั่ง' : 'บันทึกว่าไม่ได้รับประทาน',
          resolvedAt: log.at || now.toISOString(),
          resolvedBy: log.byName || 'ผู้ใช้',
        };
      }
    } else {
      // หากผู้ใช้กดยกเลิกการกินยา (Uncheck dose) ในวันนี้ ให้คืนสถานะกลับมาเป็น pending
      if (n.dateKey === today && n.actionStatus === 'resolved' && n.resolveReason === 'สมาชิกรับประทานยาแล้ว') {
        changedCount++;
        return {
          ...n,
          actionStatus: 'pending' as const,
          resolveReason: null,
          resolvedAt: null,
          resolvedBy: null,
        };
      }
    }

    return n;
  });

  return { updated, changedCount };
}

// ==========================================
// 5. การจัดการหน่วยความจำและฟังก์ชันการกระทำ (Storage & Actions)
// ==========================================

export function loadStoredNotifications(): HealthNotification[] {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as HealthNotification[];
    }
  } catch {
    // ข้ามได้
  }
  return [];
}

export function saveStoredNotifications(list: HealthNotification[]): void {
  try {
    // เก็บสูงสุด 200 รายการล่าสุด
    const trimmed = list.slice(0, 200);
    const newRaw = JSON.stringify(trimmed);
    const existingRaw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (existingRaw === newRaw) {
      // ข้อมูลตรงกับที่มีอยู่แล้ว ไม่ต้องเขียนซ้ำ และไม่ต้องส่ง event ซ้ำเพื่อป้องกันลูป
      return;
    }
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, newRaw);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
    }
  } catch {
    // ข้ามได้
  }
}

export function markNotificationAsRead(id: string, memberId = CURRENT_MEMBER_ID): void {
  const list = loadStoredNotifications();
  const now = new Date().toISOString();
  const next = list.map((item) => {
    if (item.id !== id) return item;
    let found = false;
    const recipients = item.recipients.map((r) => {
      if (r.memberId === memberId) {
        found = true;
        return { ...r, readAt: now };
      }
      return r;
    });
    if (!found) {
      recipients.push({
        memberId,
        memberName: '',
        role: 'family',
        deliveredAt: item.createdAt,
        readAt: now,
      });
    }
    return {
      ...item,
      recipients,
      isRead: memberId === CURRENT_MEMBER_ID ? true : item.isRead,
      readAt: memberId === CURRENT_MEMBER_ID ? now : item.readAt,
    };
  });
  saveStoredNotifications(next);
}

export function markAllNotificationsAsRead(memberId = CURRENT_MEMBER_ID): void {
  const list = loadStoredNotifications();
  const now = new Date().toISOString();
  const next = list.map((item) => {
    let found = false;
    const recipients = item.recipients.map((r) => {
      if (r.memberId === memberId) {
        found = true;
        return { ...r, readAt: now };
      }
      return r;
    });
    if (!found) {
      recipients.push({
        memberId,
        memberName: '',
        role: 'family',
        deliveredAt: item.createdAt,
        readAt: now,
      });
    }
    return {
      ...item,
      recipients,
      isRead: memberId === CURRENT_MEMBER_ID ? true : item.isRead,
      readAt: memberId === CURRENT_MEMBER_ID ? now : item.readAt,
    };
  });
  saveStoredNotifications(next);
}

export function resolveNotification(
  id: string,
  reason = 'จัดการเรียบร้อยแล้ว',
  actorName = 'ฉัน'
): void {
  const list = loadStoredNotifications();
  const now = new Date().toISOString();
  const next = list.map((item) => {
    if (item.id !== id) return item;
    return {
      ...item,
      actionStatus: 'resolved' as const,
      resolveReason: reason,
      resolvedAt: now,
      resolvedBy: actorName,
      isRead: true,
      readAt: item.readAt ?? now,
    };
  });
  saveStoredNotifications(next);
}

export function deleteNotification(id: string): void {
  const list = loadStoredNotifications();
  const next = list.filter((item) => item.id !== id);
  saveStoredNotifications(next);
}

export function clearAllNotifications(): void {
  saveStoredNotifications([]);
}

// ==========================================
// 6. React Hook สำหรับติดตามการแจ้งเตือน (useHealthNotifications)
// ==========================================

export function useHealthNotifications(currentMemberId = CURRENT_MEMBER_ID) {
  const isRefreshingRef = useRef(false);

  const refresh = useCallback(() => {
    if (isRefreshingRef.current) return loadStoredNotifications();
    isRefreshingRef.current = true;
    try {
      const settings = loadSettings();
      const medsState = loadMeds();
      const events = loadEvents();
      const posts = loadPosts();
      const memberRecords: Record<string, MemberRecord> = {};
      for (const m of settings.members) {
        memberRecords[m.id] = loadMemberRecord(m.id);
      }
      const routingConfigs = loadRoutingConfigs(settings.members);

      const stored = loadStoredNotifications();
      const allLogsByMember: Record<string, DoseLog[]> = {
        [CURRENT_MEMBER_ID]: medsState.logs,
      };
      for (const [mId, rec] of Object.entries(memberRecords)) {
        if (mId !== CURRENT_MEMBER_ID) {
          allLogsByMember[mId] = rec.doseLogs ?? [];
        }
      }
      const autoResolved = autoResolveMedNotifications(stored, medsState.logs, new Date(), allLogsByMember);
      const baseList = autoResolved.changedCount > 0 ? autoResolved.updated : stored;

      const generated = generateHealthNotifications(
        {
          settings,
          medsState,
          events,
          posts,
          memberRecords,
          routingConfigs,
        },
        baseList
      );

      saveStoredNotifications(generated);
      return generated;
    } finally {
      isRefreshingRef.current = false;
    }
  }, []);

  const [list, setList] = useState<HealthNotification[]>(() => {
    return loadStoredNotifications();
  });

  useEffect(() => {
    // 1. รันครั้งแรกเมื่อโหลด
    const initial = refresh();
    setList(initial);

    // 2. ตรวจสอบตามกำหนดเวลาทุก 60 วินาที
    const timer = window.setInterval(() => {
      const next = refresh();
      setList(next);
    }, 60_000);

    // 3. เมื่อมีเหตุการณ์เปลี่ยนข้อมูลแจ้งเตือน (เช่น อ่านแล้ว, จัดการแล้ว, ลบ)
    // ให้อ่านจาก storage ลง state เท่านั้น — ห้ามเรียก refresh() เพื่อป้องกัน Event Loop ซ้ำซ้อน
    const onNotifsChanged = () => {
      setList(loadStoredNotifications());
    };
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onNotifsChanged);

    // 4. เมื่อข้อมูลสุขภาพหลักเปลี่ยน ให้คำนวณใหม่
    const onDataChanged = () => {
      const next = refresh();
      setList(next);
    };
    window.addEventListener(MEDS_CHANGED_EVENT, onDataChanged);
    window.addEventListener(CALENDAR_CHANGED_EVENT, onDataChanged);
    window.addEventListener(JOURNAL_CHANGED_EVENT, onDataChanged);
    window.addEventListener(MEMBERS_CHANGED_EVENT, onDataChanged);
    window.addEventListener(SETTINGS_CHANGED_EVENT, onDataChanged);
    window.addEventListener('storage', onDataChanged);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onNotifsChanged);
      window.removeEventListener(MEDS_CHANGED_EVENT, onDataChanged);
      window.removeEventListener(CALENDAR_CHANGED_EVENT, onDataChanged);
      window.removeEventListener(JOURNAL_CHANGED_EVENT, onDataChanged);
      window.removeEventListener(MEMBERS_CHANGED_EVENT, onDataChanged);
      window.removeEventListener(SETTINGS_CHANGED_EVENT, onDataChanged);
      window.removeEventListener('storage', onDataChanged);
    };
  }, [refresh]);

  // กรองเฉพาะรายการที่ส่งถึงสมาชิกคนนี้ และคำนวณสถานะ isRead ให้แยกอิสระเฉพาะสมาชิกคนนี้
  const userNotifications = list
    .filter((item) =>
      item.recipients.length === 0 || item.recipients.some((r) => r.memberId === currentMemberId)
    )
    .map((item) => {
      const myRecipient = item.recipients.find((r) => r.memberId === currentMemberId);
      const isReadForMe = myRecipient ? myRecipient.readAt != null : item.isRead;
      return {
        ...item,
        isRead: isReadForMe,
        readAt: myRecipient?.readAt ?? item.readAt,
      };
    });

  const unreadCount = userNotifications.filter((item) => !item.isRead).length;

  const pendingCount = userNotifications.filter((item) => item.actionStatus === 'pending').length;

  return {
    notifications: userNotifications,
    allNotifications: list,
    unreadCount,
    pendingCount,
    markAsRead: (id: string) => markNotificationAsRead(id, currentMemberId),
    markAllAsRead: () => markAllNotificationsAsRead(currentMemberId),
    resolve: (id: string, reason?: string) => resolveNotification(id, reason),
    deleteNotification,
    clearAll: clearAllNotifications,
    refresh,
  };
}
