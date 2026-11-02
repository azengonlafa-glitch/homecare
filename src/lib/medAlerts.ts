import { useEffect, useState } from 'react';
import {
  MEDS_CHANGED_EVENT,
  MISSED_GRACE_MIN,
  PERIOD_LABEL,
  daysLeft,
  findLog,
  isDue,
  isScheduledOn,
  loadMeds,
  periodTime,
  stockLevel,
  todayKey,
  type DosePeriod,
  type MedsState,
} from './meds';
import {
  CURRENT_MEMBER_ID,
  SETTINGS_CHANGED_EVENT,
  loadSettings,
  type ReminderSettings,
} from './settings';

export type AlertKind = 'missed' | 'out' | 'low';

export interface MedAlert {
  /** ไม่ซ้ำกัน ใช้กันการแจ้งเตือนบนเครื่องซ้ำ (รวมครั้งที่เตือนด้วย เพราะเตือนซ้ำได้หลายรอบ) */
  key: string;
  kind: AlertKind;
  medId: string;
  period?: DosePeriod;
  title: string;
  body: string;
  /** danger = แดง, warn = เหลือง */
  tone: 'danger' | 'warn';
  /** เตือนครั้งที่เท่าไรของมื้อนี้ (เริ่มที่ 1) */
  round: number;
  /** ตั้งให้เตือนทั้งหมดกี่ครั้งต่อมื้อ */
  rounds: number;
  /** เวลาที่ควรกินตามตาราง (HH:MM) — เฉพาะการเตือนลืมกินยา */
  dueTime?: string;
  /** เวลาที่จะเตือนซ้ำอีกครั้ง (HH:MM) ถ้ายังไม่กินยาและยังมีรอบเหลือ */
  nextTime?: string;
  /** เลยเวลาที่ควรกินมาแล้วกี่นาที */
  minutesLate?: number;
  /** ตั้งแต่ครั้งที่ 2 ถ้ายังไม่กินยา จะแจ้งทุกคนในบ้านด้วย */
  sharedWithFamily: boolean;
  /** ชื่อสมาชิกในบ้านที่ได้รับการแจ้ง */
  familyNames: string[];
}

const minutesOf = (hhmm: string) => {
  const [h, mi] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (mi || 0);
};

const labelOf = (minutes: number) => {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mi = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
};

/**
 * คำนวณการแจ้งเตือน: ลืมกินยา (เลยเวลา + ผ่อนผัน แต่ยังไม่บันทึก) และยาใกล้หมด/หมดแล้ว
 * - "ลืมกินยา" เตือนซ้ำได้ตามจำนวนครั้งที่ตั้งไว้ (repeatCount) โดยเว้นระยะ repeatIntervalMinutes
 * - ตั้งแต่ครั้งที่ 2 ถ้ายังไม่กินยา และเปิด escalateToFamily ไว้ จะแจ้งทุกคนในบ้านด้วย
 */
export function buildAlerts(
  state: MedsState,
  reminders: ReminderSettings,
  now = new Date(),
  familyNames: string[] = []
): MedAlert[] {
  const today = todayKey(now);
  const alerts: MedAlert[] = [];
  const active = state.meds.filter((m) => m.active);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const interval = Math.max(1, Math.round(reminders.repeatIntervalMinutes || 15));
  const rounds = Math.max(1, Math.round(reminders.repeatCount || 1));

  if (reminders.doseWindow) {
    for (const med of active) {
      if (!isScheduledOn(med, today)) continue;
      for (const p of med.periods) {
        if (!isDue(med, p, now) || findLog(state.logs, today, med.id, p)) continue;

        const dueTime = periodTime(med, p);
        // เริ่มเตือนครั้งแรกเมื่อเลยเวลาที่ควรกิน + เวลาผ่อนผัน แล้วเตือนซ้ำทุก ๆ interval นาที
        const minutesLate = Math.max(0, nowMinutes - minutesOf(dueTime));
        const elapsedAfterGrace = Math.max(0, minutesLate - MISSED_GRACE_MIN);
        const round = Math.min(rounds, Math.floor(elapsedAfterGrace / interval) + 1);
        const remainingRounds = round < rounds;
        const sharedWithFamily = round >= 2 && reminders.escalateToFamily;

        alerts.push({
          key: `missed:${today}:${med.id}:${p}:r${round}`,
          kind: 'missed',
          medId: med.id,
          period: p,
          round,
          rounds,
          dueTime,
          nextTime: remainingRounds ? labelOf(minutesOf(dueTime) + MISSED_GRACE_MIN + round * interval) : undefined,
          minutesLate,
          sharedWithFamily,
          familyNames: sharedWithFamily ? familyNames : [],
          title: `ลืมกินยามื้อ${PERIOD_LABEL[p]}หรือเปล่า?`,
          body: `${med.name} (เวลา ${dueTime} น.) ยังไม่ได้บันทึก`,
          tone: 'danger',
        });
      }
    }
  }

  if (reminders.lowStock) {
    for (const med of active) {
      const level = stockLevel(med);
      if (level === 'good') continue;
      const days = daysLeft(med);
      const out = med.remaining <= 0 || days === 0;
      alerts.push({
        key: `stock:${med.id}:${out ? 'out' : level}`,
        kind: out ? 'out' : 'low',
        medId: med.id,
        round: 1,
        rounds: 1,
        sharedWithFamily: false,
        familyNames: [],
        title: out ? `${med.name} หมดแล้ว` : `${med.name} ใกล้หมด`,
        body: out
          ? 'กด “ขอเติมยา” เพื่อส่งข้อความถึงร้านยา'
          : `พอกินอีก ${days} วัน${med.refillRequestedAt ? ' · ขอเติมยาไปแล้ว' : ''}`,
        tone: out || level === 'critical' ? 'danger' : 'warn',
      });
    }
  }

  const order: Record<AlertKind, number> = { missed: 0, out: 1, low: 2 };
  return alerts.sort((a, b) => order[a.kind] - order[b.kind]);
}

// ---------- การแจ้งเตือนเครื่อง + การแจ้งคนในบ้าน ----------

const NOTIFIED_KEY = 'growa_notified_v1';
const FAMILY_NOTICE_KEY = 'growa_family_notices_v1';

const readNotified = (): Set<string> => {
  try {
    const raw = localStorage.getItem(NOTIFIED_KEY);
    const parsed = raw ? (JSON.parse(raw) as { day: string; keys: string[] }) : null;
    return new Set(parsed?.day === todayKey() ? parsed.keys : []);
  } catch {
    return new Set();
  }
};

/** บันทึกว่าการเตือนครั้งนี้ถูกส่งถึงทุกคนในบ้านแล้ว (ต้นแบบ: เก็บในเครื่อง ยังไม่มีเซิร์ฟเวอร์ส่งจริง) */
function syncFamilyNotices(alerts: MedAlert[]) {
  const shared = alerts.filter((a) => a.sharedWithFamily);
  if (shared.length === 0) return;
  try {
    const raw = localStorage.getItem(FAMILY_NOTICE_KEY);
    const existing = raw ? (JSON.parse(raw) as FamilyNotice[]) : [];
    const known = new Set(existing.map((n) => n.key));
    const fresh = shared
      .filter((a) => !known.has(a.key))
      .map<FamilyNotice>((a) => ({
        key: a.key,
        title: a.title,
        body: a.body,
        round: a.round,
        sharedAt: new Date().toISOString(),
        memberNames: a.familyNames,
      }));
    if (fresh.length === 0) return;
    localStorage.setItem(FAMILY_NOTICE_KEY, JSON.stringify([...fresh, ...existing].slice(0, 50)));
  } catch {
    // เก็บไม่ได้ (เช่นพื้นที่เต็ม): ข้ามได้ ไม่ให้กระทบการใช้งาน
  }
}

export interface FamilyNotice {
  key: string;
  title: string;
  body: string;
  round: number;
  sharedAt: string;
  memberNames: string[];
}

/** รายการแจ้งเตือนที่ส่งถึงทุกคนในบ้านแล้ว (ใหม่สุดก่อน) */
export function readFamilyNotices(): FamilyNotice[] {
  try {
    const raw = localStorage.getItem(FAMILY_NOTICE_KEY);
    return raw ? (JSON.parse(raw) as FamilyNotice[]) : [];
  } catch {
    return [];
  }
}

/** แสดงการแจ้งเตือนบนเครื่อง (ถ้าอนุญาตแล้ว) เฉพาะรายการที่ยังไม่เคยแจ้งในรอบนี้ */
function notifyNew(alerts: MedAlert[]) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const sent = readNotified();
  let changed = false;
  for (const a of alerts) {
    if (sent.has(a.key)) continue;
    const body = a.sharedWithFamily
      ? `แจ้งคนในบ้านแล้ว (${a.familyNames.join(', ')}) · ${a.body}`
      : a.body;
    try {
      new Notification(a.title, { body, tag: a.key });
    } catch {
      // บางเบราว์เซอร์ (เช่นบนมือถือ) ต้องใช้ service worker: ข้ามได้
    }
    sent.add(a.key);
    changed = true;
  }
  if (changed) {
    try {
      localStorage.setItem(NOTIFIED_KEY, JSON.stringify({ day: todayKey(), keys: [...sent] }));
    } catch {
      // ข้ามได้
    }
  }
}

/** ชื่อสมาชิกคนอื่นในบ้าน (ทุกคนที่จะได้รับการแจ้งเมื่อเลยครั้งที่ 2) */
export function familyMemberNames(): string[] {
  const settings = loadSettings();
  return settings.members.filter((m) => m.id !== CURRENT_MEMBER_ID).map((m) => m.name);
}

/**
 * การแจ้งเตือนเรื่องยาล่าสุด คำนวณใหม่ทุกนาทีและทุกครั้งที่ข้อมูลยา/การตั้งค่าเปลี่ยน
 * notify = true ให้ส่งการแจ้งเตือนบนเครื่องด้วย (ใช้ที่เดียวในแอป คือกระดิ่งบนแถบบน)
 */
export function useMedAlerts({ notify = false } = {}): MedAlert[] {
  const compute = () => buildAlerts(loadMeds(), loadSettings().reminders, new Date(), familyMemberNames());
  const [alerts, setAlerts] = useState<MedAlert[]>(compute);

  useEffect(() => {
    const refresh = () => {
      const next = compute();
      setAlerts(next);
      syncFamilyNotices(next);
      if (notify) notifyNew(next);
    };
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener(MEDS_CHANGED_EVENT, refresh);
    window.addEventListener(SETTINGS_CHANGED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(MEDS_CHANGED_EVENT, refresh);
      window.removeEventListener(SETTINGS_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notify]);

  return alerts;
}
