import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '../ui/Card';
import { AppleTree } from './AppleTree';
import type { DoseLog, Medication } from '../../lib/meds';
import { computeStreak, stageOf } from '../../lib/streak';

const CELEBRATED_KEY = 'streak-celebrated-from';
/** "1" = เห็นหน้าต่างเสียใจของการไฟดับครั้งนี้แล้ว (ล้างเมื่อกลับมามีไฟ) */
const LOST_SEEN_KEY = 'streak-lost-seen';
/** ฉลองตั้งแต่ระดับ "ต้นอ่อนงอกแล้ว" (3 วัน) ขึ้นไป */
const CELEBRATE_FROM = 3;

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* ไม่มี storage ก็ไม่เป็นไร */
  }
};

/** หน้าต่างกลางจอ (ใช้ทั้งแสดงความยินดีและแสดงความเสียใจ) */
const StreakDialog: React.FC<{
  label: string;
  art: React.ReactNode;
  artBg: string;
  title: string;
  button: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ label, art, artBg, title, button, onClose, children }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={onClose}
    >
      <div className="w-full max-w-sm rounded-[2rem] bg-white p-6 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto h-64 w-64 overflow-hidden rounded-[2rem]" style={{ background: artBg }}>
          {art}
        </div>
        <h2 className="mt-4 text-2xl font-extrabold text-slate-900">{title}</h2>
        <div className="mt-1 text-lg font-semibold text-slate-800">{children}</div>
        <button
          type="button"
          autoFocus
          onClick={onClose}
          className="mt-5 w-full rounded-full bg-purple-700 px-6 py-3 text-base font-extrabold text-white"
        >
          {button}
        </button>
      </div>
    </div>
  );
};

/** พื้นหลังของระดับที่มีไฟ: สว่างแบบภาพอ้างอิง */
const FIRE_BG = 'linear-gradient(#FFFFFF, #F5F3FF)';
const BURNT_BG = 'linear-gradient(#E7E4F0, #CFCADB)';

/**
 * การ์ด "ต้นแอปเปิ้ลแห่งความสม่ำเสมอ": โฟกัสแค่ภาพกับตัวเลขวันติดต่อกัน
 * เมื่อโตถึงระดับใหม่จะมีหน้าต่างแสดงความยินดีกลางจอพร้อมไฟลุกที่ลูกแอปเปิ้ล (แสดงครั้งเดียวต่อระดับ)
 * เมื่อไฟดับจะมีหน้าต่างแสดงความเสียใจพร้อมแอปเปิ้ลไหม้ (แสดงครั้งเดียวต่อการดับหนึ่งครั้ง)
 */
export const StreakTreeCard: React.FC<{ meds: Medication[]; logs: DoseLog[] }> = ({ meds, logs }) => {
  const result = useMemo(() => computeStreak(meds, logs), [meds, logs]);
  const { current, best, recovering, hasSchedule } = result;
  // ไฟดับ: เคยมีสตรีคแล้วหลุดไปและยังไม่อยู่ระหว่างกู้ → แสดงแอปเปิ้ลไหม้
  const burnt = current === 0 && best > 0 && !recovering;
  const stage = stageOf(current);
  const night = !!stage.aura;
  const [dialog, setDialog] = useState<'celebrate' | 'lost' | null>(null);

  useEffect(() => {
    if (!hasSchedule) return;
    if (burnt) {
      if (read(LOST_SEEN_KEY) !== '1') setDialog('lost');
      return;
    }
    if (current > 0) write(LOST_SEEN_KEY, null);
    if (stage.from >= CELEBRATE_FROM && stage.from > (Number(read(CELEBRATED_KEY)) || 0)) setDialog('celebrate');
  }, [hasSchedule, burnt, current, stage.from]);

  const close = useCallback(() => {
    if (dialog === 'celebrate') write(CELEBRATED_KEY, String(stage.from));
    if (dialog === 'lost') {
      write(LOST_SEEN_KEY, '1');
      // ไฟดับแล้ว เริ่มนับฉลองใหม่ตั้งแต่ระดับแรก
      write(CELEBRATED_KEY, null);
    }
    setDialog(null);
  }, [dialog, stage.from]);

  if (!hasSchedule) return null;

  return (
    <>
      <Card className="p-4 sm:p-6" aria-label="ต้นแอปเปิ้ลแห่งความสม่ำเสมอ">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-8">
          <div
            className="relative h-56 w-56 shrink-0 overflow-hidden rounded-[2rem]"
            style={{
              background: burnt ? BURNT_BG : night ? FIRE_BG : 'linear-gradient(#CFEFFF, #EAF9D9)',
            }}
          >
            <AppleTree stage={stage.id} burnt={burnt} className="h-full w-full" />
          </div>

          <div className="text-center sm:text-left">
            <p className="flex items-baseline justify-center gap-2 sm:justify-start">
              <span
                className="text-7xl font-extrabold tabular-nums"
                style={{ color: night ? (stage.aura?.mid ?? '#15703A') : '#2A221D' }}
              >
                {current}
              </span>
              <span className="text-2xl font-bold text-slate-900">วันติดต่อกัน</span>
            </p>
          </div>
        </div>
      </Card>

      {dialog === 'celebrate' && (
        <StreakDialog
          label="แสดงความยินดี"
          art={<AppleTree stage={stage.id} celebrate className="h-full w-full" />}
          artBg={FIRE_BG}
          title="ยินดีด้วย!"
          button="ขอบคุณ"
          onClose={close}
        >
          คุณกินยาตรงตามกำหนดมาแล้ว <b className="text-3xl font-extrabold text-purple-800">{current}</b> วัน
        </StreakDialog>
      )}

      {dialog === 'lost' && (
        <StreakDialog
          label="แสดงความเสียใจ"
          art={<AppleTree stage="empty" burnt className="h-full w-full" />}
          artBg={BURNT_BG}
          title="เสียใจด้วยนะ ไฟดับแล้ว"
          button="เริ่มใหม่"
          onClose={close}
        >
          <span className="block whitespace-nowrap text-base">ไม่เป็นไรนะ เริ่มใหม่ได้เสมอ</span>
          <span className="mt-2 block text-base font-medium text-slate-600">กินยาตรงเวลาตั้งแต่วันนี้</span>
          <span className="block text-base font-medium text-slate-600">แล้วไฟจะกลับมาลุกอีกครั้ง</span>
        </StreakDialog>
      )}
    </>
  );
};
