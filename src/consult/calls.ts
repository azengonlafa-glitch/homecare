import type { Channel } from './types';

/** นัดหมายพักไว้ก่อน โค้ดยังอยู่ครบ เปลี่ยนเป็น true เมื่อต้องการเปิดกลับมา */
const appointmentsEnabled = false;

export const isChannelAvailable = (channel: Channel): boolean => {
  if (channel === 'chat') return true;
  if (channel === 'appointment') return appointmentsEnabled;
  return true; // โทรเสียงและวิดีโอคอลเป็น WebRTC จริง ดู rtc.ts
};

export const formatDuration = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
