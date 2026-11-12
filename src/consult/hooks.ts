import { useCallback, useEffect, useRef, useState } from 'react';
import { CONSULT_CHANGED_EVENT, consultErrorText, getBackend, type ConsultBackend } from './backend';
import { newUuid } from './files';
import { emptyAnswers } from './options';
import { todayKey } from '../lib/meds';
import type { CheckinAnswers, FollowUp } from './types';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string;
  reload: () => void;
}

/** โหลดข้อมูลจาก backend พร้อมสถานะกำลังโหลดและข้อผิดพลาด โหลดซ้ำแบบเงียบเมื่อมีการเปลี่ยนแปลง */
export function useConsultData<T>(load: (b: ConsultBackend) => Promise<T>, deps: unknown[], watch?: { sessionId: string | null }): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const loadRef = useRef(load);
  loadRef.current = load;
  const requestRef = useRef(0);

  const run = useCallback(async () => {
    const request = ++requestRef.current;
    try {
      const backend = await getBackend();
      const value = await loadRef.current(backend);
      if (request !== requestRef.current) return;
      setData(value);
      setError('');
    } catch (err) {
      if (request !== requestRef.current) return;
      console.error('Consult load failed', err);
      setError(consultErrorText(err));
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const watchId = watch ? watch.sessionId ?? '*' : null;
  useEffect(() => {
    if (watchId === null) return;
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    void getBackend().then((b) => {
      if (!cancelled) unsubscribe = b.subscribe(watchId === '*' ? null : watchId, () => void run());
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [watchId, run]);

  return { data, loading, error, reload: () => void run() };
}

// ---------- ฉบับร่างแบบสอบถาม ----------
// เก็บใน sessionStorage: อยู่ได้เมื่อโหลดหน้าใหม่หรือไปแก้ข้อมูลสุขภาพ แต่หายเมื่อปิดแท็บ จึงไม่ค้างในเครื่องที่ใช้ร่วมกัน

const DRAFT_KEY = 'growa_consult_draft_v1';

export interface ConsultDraft {
  sessionId: string;
  providerId: string;
  answers: CheckinAnswers;
}

export function loadDraft(): ConsultDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsultDraft;
    return { ...parsed, answers: { ...emptyAnswers(), ...parsed.answers } };
  } catch {
    return null;
  }
}

export function saveDraft(draft: ConsultDraft): void {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // เก็บไม่ได้: กรอกต่อได้แต่จะหายเมื่อโหลดหน้าใหม่
  }
}

export function clearDraft(): void {
  sessionStorage.removeItem(DRAFT_KEY);
}

export const startDraft = (providerId: string): ConsultDraft => {
  const draft: ConsultDraft = { sessionId: newUuid(), providerId, answers: emptyAnswers() };
  saveDraft(draft);
  return draft;
};

// ---------- การแจ้งเตือนติดตามผล ----------

export interface DueFollowUp {
  followUp: FollowUp;
  providerName: string;
}

const isDue = (f: FollowUp, today: string) => f.status === 'pending' && f.dueDate <= today;

/**
 * นัดติดตามที่ถึงกำหนด แสดงในกระดิ่งแจ้งเตือน
 * เตือนเฉพาะตอนเปิดแอป เพราะยังไม่มีระบบส่งแจ้งเตือนจากเซิร์ฟเวอร์
 */
export function useDueFollowUps(enabled = true): DueFollowUp[] {
  const [items, setItems] = useState<DueFollowUp[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const refresh = async () => {
      try {
        const backend = await getBackend();
        const bundles = await backend.listMyBundles();
        const today = todayKey();
        const next = bundles.flatMap((b) =>
          b.followUps.filter((f) => isDue(f, today)).map((followUp) => ({ followUp, providerName: b.provider?.displayName ?? 'ร้านยาหรือคลินิก' }))
        );
        if (alive) setItems(next);
      } catch {
        // กระดิ่งต้องไม่พังเพราะระบบปรึกษาเชื่อมต่อไม่ได้
        if (alive) setItems([]);
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener(CONSULT_CHANGED_EVENT, refresh);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener(CONSULT_CHANGED_EVENT, refresh);
    };
  }, [enabled]);

  return items;
}
