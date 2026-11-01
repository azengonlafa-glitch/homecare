import { useEffect, useState } from 'react';
import {
  MEDS_CHANGED_EVENT,
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
import { SETTINGS_CHANGED_EVENT, loadSettings, type ReminderSettings } from './settings';

export type AlertKind = 'missed' | 'out' | 'low';

export interface MedAlert {
  /** ไม่ซ้ำกัน ใช้กันการแจ้งเตือนบนเครื่องซ้ำ */
  key: string;
  kind: AlertKind;
  medId: string;
  period?: DosePeriod;
  title: string;
  body: string;
  /** danger = แดง, warn = เหลือง */
  tone: 'danger' | 'warn';
}

/** คำนวณการแจ้งเตือน: ลืมกินยา (เลยเวลา + ผ่อนผัน แต่ยังไม่บันทึก) และยาใกล้หมด/หมดแล้ว */
export function buildAlerts(state: MedsState, reminders: ReminderSettings, now = new Date()): MedAlert[] {
  const today = todayKey(now);
  const alerts: MedAlert[] = [];
  const active = state.meds.filter((m) => m.active);

  if (reminders.doseWindow) {
    for (const med of active) {
      if (!isScheduledOn(med, today)) continue;
      for (const p of med.periods) {
        if (!isDue(med, p, now) || findLog(state.logs, today, med.id, p)) continue;
        alerts.push({
          key: `missed:${today}:${med.id}:${p}`,
          kind: 'missed',
          medId: med.id,
          period: p,
          title: `ลืมกินยามื้อ${PERIOD_LABEL[p]}หรือเปล่า?`,
          body: `${med.name} (เวลา ${periodTime(med, p)} น.) ยังไม่ได้บันทึก`,
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

const NOTIFIED_KEY = 'growa_notified_v1';

const readNotified = (): Set<string> => {
  try {
    const raw = localStorage.getItem(NOTIFIED_KEY);
    const parsed = raw ? (JSON.parse(raw) as { day: string; keys: string[] }) : null;
    return new Set(parsed?.day === todayKey() ? parsed.keys : []);
  } catch {
    return new Set();
  }
};

/** แสดงการแจ้งเตือนบนเครื่อง (ถ้าอนุญาตแล้ว) เฉพาะรายการที่ยังไม่เคยแจ้งในวันนี้ */
function notifyNew(alerts: MedAlert[]) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const sent = readNotified();
  let changed = false;
  for (const a of alerts) {
    if (sent.has(a.key)) continue;
    try {
      new Notification(a.title, { body: a.body, tag: a.key });
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

/**
 * การแจ้งเตือนเรื่องยาล่าสุด คำนวณใหม่ทุกนาทีและทุกครั้งที่ข้อมูลยา/การตั้งค่าเปลี่ยน
 * notify = true ให้ส่งการแจ้งเตือนบนเครื่องด้วย (ใช้ที่เดียวในแอป คือกระดิ่งบนแถบบน)
 */
export function useMedAlerts({ notify = false } = {}): MedAlert[] {
  const compute = () => buildAlerts(loadMeds(), loadSettings().reminders);
  const [alerts, setAlerts] = useState<MedAlert[]>(compute);

  useEffect(() => {
    const refresh = () => {
      const next = compute();
      setAlerts(next);
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
