import { queueSync } from '../cloud/queue';
import { useEffect, useState } from 'react';
import { JOURNAL_CHANGED_EVENT, loadPosts, savePosts, type JournalPost } from './journal';
import {
  DEFAULT_EXPIRY_WARN_DAYS,
  MEDS_CHANGED_EVENT,
  PERIOD_LABEL,
  daysLeft,
  daysToExpiry,
  doseWords,
  findLog,
  isOverdue,
  isScheduledOn,
  reminderDelayOf,
  reminderRepeatOf,
  thaiDate,
  loadMeds,
  periodTime,
  stockLevel,
  todayKey,
  type DosePeriod,
  type MedForm,
  type MedsState,
} from './meds';
import {
  CURRENT_MEMBER_ID,
  SETTINGS_CHANGED_EVENT,
  getCurrentMember,
  loadSettings,
  type ReminderSettings,
} from './settings';

/** แจ้งว่ารายการแจ้งเตือนถึงคนในบ้านเปลี่ยน (กระดิ่งของคนอื่นฟังเหตุการณ์นี้) */
export const NOTICES_CHANGED_EVENT = 'growa-notices-changed';

export type AlertKind = 'missed' | 'out' | 'low' | 'expiry';

export interface MedAlert {
  /** ไม่ซ้ำกัน ใช้กันการแจ้งเตือนบนเครื่องซ้ำ (รวมครั้งที่เตือนด้วย เพราะเตือนซ้ำได้หลายรอบ) */
  key: string;
  kind: AlertKind;
  medId: string;
  /** รูปแบบยา ใช้เลือกคำ กิน/ฉีด/หยอด ในข้อความ */
  form?: MedForm;
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
 * - "ลืมกินยา" เตือนซ้ำได้ตามจำนวนครั้งที่ตั้งไว้ (repeatCount) โดยเว้นระยะตามที่ตั้งไว้ในแต่ละยา
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

  const rounds = Math.max(1, Math.round(reminders.repeatCount || 1));

  if (reminders.doseWindow) {
    for (const med of active) {
      if (!isScheduledOn(med, today)) continue;
      for (const p of med.periods) {
        if (!isOverdue(med, p, now) || findLog(state.logs, today, med.id, p)) continue;

        const dueTime = periodTime(med, p);
        // เวลาแจ้งครั้งแรกและช่วงแจ้งซ้ำ ตั้งรายยาได้ (ค่าเริ่มต้น: ตรงเวลา และซ้ำทุก 10 นาที)
        const delay = reminderDelayOf(med);
        const interval = reminderRepeatOf(med);
        const minutesLate = Math.max(0, nowMinutes - minutesOf(dueTime));
        const elapsedAfterFirst = Math.max(0, minutesLate - delay);
        const round = Math.min(rounds, Math.floor(elapsedAfterFirst / interval) + 1);
        const remainingRounds = round < rounds;
        const sharedWithFamily = round >= 2 && reminders.escalateToFamily;

        alerts.push({
          key: `missed:${today}:${med.id}:${p}:r${round}`,
          kind: 'missed',
          medId: med.id,
          form: med.form,
          period: p,
          round,
          rounds,
          dueTime,
          nextTime: remainingRounds ? labelOf(minutesOf(dueTime) + delay + round * interval) : undefined,
          minutesLate,
          sharedWithFamily,
          familyNames: sharedWithFamily ? familyNames : [],
          title:
            round === 1
              ? `ถึงเวลา${doseWords(med.form).phrase}มื้อ${PERIOD_LABEL[p]}`
              : `ลืม${doseWords(med.form).phrase}มื้อ${PERIOD_LABEL[p]}หรือเปล่า?`,
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
      const out = med.remaining <= 0;
      alerts.push({
        key: `stock:${med.id}:${out ? 'out' : level}`,
        kind: out ? 'out' : 'low',
        medId: med.id,
        form: med.form,
        round: 1,
        rounds: 1,
        sharedWithFamily: false,
        familyNames: [],
        title: out ? `${med.name} หมดแล้ว` : `${med.name} ใกล้หมด`,
        body: out
          ? 'ยาหมดแล้ว'
          : days ? `พอ${doseWords(med.form).use}อีก ${days} วัน` : 'เหลือไม่ถึง 1 วัน',
        tone: out || level === 'critical' ? 'danger' : 'warn',
      });
    }
  }

  // ยาใกล้หมดอายุ/หมดอายุแล้ว (ตั้งจำนวนวันเตือนล่วงหน้าได้ต่อยา)
  for (const med of active) {
    const left = daysToExpiry(med, now);
    if (left === null || left > (med.expiryWarnDays ?? DEFAULT_EXPIRY_WARN_DAYS)) continue;
    const expired = left < 0;
    alerts.push({
      key: `expiry:${med.id}:${med.expiryDate}:${expired ? 'x' : left <= 7 ? 'w' : 'n'}`,
      kind: 'expiry',
      medId: med.id,
      form: med.form,
      round: 1,
      rounds: 1,
      sharedWithFamily: false,
      familyNames: [],
      title: expired ? `${med.name} หมดอายุแล้ว` : `${med.name} ใกล้หมดอายุ`,
      body: expired
        ? `หมดอายุเมื่อ ${thaiDate(med.expiryDate!, 'medium')} ไม่ควรใช้ต่อ ถามเภสัชกรเรื่องการทิ้งและเปลี่ยนใหม่`
        : `หมดอายุ ${thaiDate(med.expiryDate!, 'medium')} (อีก ${left} วัน)`,
      tone: expired || left <= 7 ? 'danger' : 'warn',
    });
  }

  const order: Record<AlertKind, number> = { missed: 0, out: 1, expiry: 2, low: 3 };
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

/** ข้อความแจ้งคนในบ้านว่าสมาชิกคนนี้ยังไม่ได้กิน/ฉีด/หยอดยา (ตามรูปแบบยา) หลังเตือนหลายรอบ */
function noticeText(who: string, a: MedAlert) {
  return {
    title: `${who} ยังไม่ได้${doseWords(a.form).phrase}${a.period ? `มื้อ${PERIOD_LABEL[a.period]}` : ''}`,
    body: `${a.body} · เตือนไปแล้ว ${a.round} ครั้ง ยังไม่ได้บันทึก ช่วยโทรถามหรือแวะดูหน่อย`,
  };
}

/**
 * ตั้งแต่เตือนครั้งที่ 2 ถ้ายังไม่กินยา: บันทึกแจ้งทุกคนในบ้าน (แสดงในกระดิ่งของคนอื่น)
 * และเพิ่มโพสต์อัตโนมัติในบันทึกอาการ
 */
function syncFamilyNotices(alerts: MedAlert[]) {
  const shared = alerts.filter((a) => a.sharedWithFamily);
  if (shared.length === 0) return;
  const me = getCurrentMember(loadSettings());
  const who = me?.name || 'สมาชิกในบ้าน';
  try {
    const raw = localStorage.getItem(FAMILY_NOTICE_KEY);
    const existing = raw ? (JSON.parse(raw) as FamilyNotice[]) : [];
    const known = new Set(existing.map((n) => n.key));
    const fresh = shared
      .filter((a) => !known.has(a.key))
      .map<FamilyNotice>((a) => ({
        key: a.key,
        memberId: CURRENT_MEMBER_ID,
        memberName: who,
        ...noticeText(who, a),
        round: a.round,
        sharedAt: new Date().toISOString(),
        memberNames: a.familyNames,
      }));
    if (fresh.length === 0) return;
    localStorage.setItem(FAMILY_NOTICE_KEY, JSON.stringify([...fresh, ...existing].slice(0, 50)));
    queueSync('notices');
    window.dispatchEvent(new Event(NOTICES_CHANGED_EVENT));
    addJournalPosts(fresh, who);
  } catch {
    // เก็บไม่ได้ (เช่นพื้นที่เต็ม): ข้ามได้ ไม่ให้กระทบการใช้งาน
  }
}

/** เพิ่มโพสต์ในบันทึกอาการ 1 โพสต์ต่อมื้อ (รหัสคงที่ ไม่ซ้ำแม้เตือนหลายรอบ) */
function addJournalPosts(notices: FamilyNotice[], who: string) {
  const posts = loadPosts();
  const have = new Set(posts.map((p) => p.id));
  const added: JournalPost[] = [];
  for (const n of notices) {
    // key = missed:วัน:รหัสยา:ช่วง:rรอบ ตัดรอบออกให้เหลือ 1 โพสต์ต่อมื้อ
    const id = `auto-missed-${n.key.replace(/:r\d+$/, '').replace(/[^A-Za-z0-9-]+/g, '-')}`;
    if (have.has(id) || added.some((p) => p.id === id)) continue;
    added.push({
      id,
      authorId: CURRENT_MEMBER_ID,
      authorName: who,
      about: who,
      title: n.title,
      content: `แจ้งอัตโนมัติจากระบบ: ${n.body}`,
      symptoms: [],
      moodMain: null,
      moodDetails: [],
      photo: null,
      createdAt: n.sharedAt,
      editedAt: null,
      likes: [],
      comments: [],
    });
  }
  if (added.length === 0) return;
  savePosts([...added, ...posts]);
  window.dispatchEvent(new Event(JOURNAL_CHANGED_EVENT));
}

export interface FamilyNotice {
  key: string;
  /** สมาชิกที่ยังไม่ได้กินยา (เจ้าของการแจ้งเตือน) */
  memberId?: string;
  memberName?: string;
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
    const list = raw ? (JSON.parse(raw) as FamilyNotice[]) : [];
    return [...list].sort((a, b) => b.sharedAt.localeCompare(a.sharedAt));
  } catch {
    return [];
  }
}

/** ติดตามการแจ้งเตือนที่คนอื่นในบ้านส่งมาถึงเรา (ไม่รวมของตัวเอง เฉพาะ 12 ชั่วโมงล่าสุด) */
export function useIncomingFamilyNotices(): FamilyNotice[] {
  const compute = () => {
    const since = Date.now() - 12 * 3_600_000;
    // เตือนหลายรอบในมื้อเดียวแสดงรายการเดียว (รายการใหม่สุดมาก่อน จึงเก็บรอบล่าสุดไว้)
    const seen = new Set<string>();
    return readFamilyNotices().filter((n) => {
      if (!n.memberId || n.memberId === CURRENT_MEMBER_ID) return false;
      if (new Date(n.sharedAt).getTime() < since) return false;
      const dose = n.key.replace(/:r\d+$/, '');
      if (seen.has(dose)) return false;
      seen.add(dose);
      return true;
    });
  };
  const [list, setList] = useState<FamilyNotice[]>(compute);

  useEffect(() => {
    const refresh = () => setList(compute());
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener(NOTICES_CHANGED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(NOTICES_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return list;
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
