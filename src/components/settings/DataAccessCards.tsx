import React, { useEffect, useState } from 'react';
import { History, KeyRound } from 'lucide-react';
import { Card } from '../ui/Card';
import { useToast } from '../ui/Toast';
import { cloudEnabled } from '../../cloud/client';
import { fetchMyDataLog, type DataLogEntry } from '../../cloud/engine';
import { CURRENT_MEMBER_ID } from '../../lib/settings';
import { SCOPE_LABEL, decideRequest, memberNameById, type AccessRequest } from '../../lib/access';

const when = (iso: string) => new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });

/** ชื่อหัวข้อข้อมูลที่แก้ (ตรงกับฟิลด์ใน supabase/health_privacy.sql) */
const KEY_LABEL: Record<string, string> = {
  health: 'ข้อมูลสุขภาพ (โรค การแพ้ ความดัน น้ำตาล บันทึก)',
  meds: 'รายการยา',
  vitals: 'ค่าสุขภาพที่วัด',
  doseLogs: 'บันทึกการกินยา',
  heightCm: 'ส่วนสูง',
  weightKg: 'น้ำหนักตั้งต้น',
};

/**
 * สิทธิ์ที่ฉันให้ไว้กับคนอื่น (อนุญาตตลอด / อนุญาตครั้งนี้ที่ยังไม่ได้ใช้) พร้อมปุ่มถอนสิทธิ์
 * ถอนสิทธิ์ = ตอบคำขอเดิมเป็น "ไม่อนุญาต" ผู้ขอต้องขอใหม่ถ้าจะใช้อีก
 */
export const GrantsCard: React.FC<{ requests: AccessRequest[] }> = ({ requests }) => {
  const toast = useToast();
  const grants = requests.filter(
    (r) => r.targetId === CURRENT_MEMBER_ID && r.requesterId !== CURRENT_MEMBER_ID && (r.decision === 'always' || (r.decision === 'once' && !r.usedAt))
  );

  const revoke = (r: AccessRequest) => {
    decideRequest(r.id, 'denied');
    toast.show(`ถอนสิทธิ์ของ ${memberNameById(r.requesterId)} แล้ว`);
  };

  return (
    <Card className="shadow-xs">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-bold text-slate-900">
        <KeyRound className="w-6 h-6 text-purple-700 shrink-0" aria-hidden="true" />
        <span>สิทธิ์ที่คุณให้ไว้</span>
      </h2>
      <p className="mb-3 text-base text-slate-600">คนเหล่านี้ได้รับอนุญาตจากคำขอที่คุณตอบไว้ ถอนสิทธิ์ได้ทุกเมื่อ</p>
      {grants.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-base text-slate-600">
          ตอนนี้ยังไม่มีใครถือสิทธิ์จากคำขอ (ยังไม่นับสิทธิ์ที่ตั้งไว้ในช่อง “อนุญาตหรือห้ามรายคน”)
        </p>
      ) : (
        <ul className="space-y-2">
          {grants.map((r) => (
            <li key={r.id} className="fit-row justify-between rounded-2xl border border-slate-200 bg-slate-50/50 p-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-slate-900 break-words">{memberNameById(r.requesterId)}</p>
                <p className="text-sm font-semibold text-slate-600">
                  {SCOPE_LABEL[r.scope]} · {r.decision === 'always' ? 'อนุญาตตลอด' : 'อนุญาตครั้งนี้ (ยังไม่ได้ใช้)'}
                  {r.decidedAt ? ` · ให้ไว้เมื่อ ${when(r.decidedAt)}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => revoke(r)}
                className="inline-flex min-h-[48px] shrink-0 items-center justify-center rounded-xl border border-red-200 bg-white px-4 text-base font-bold text-red-700 hover:bg-red-50 cursor-pointer"
              >
                ถอนสิทธิ์
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};

/** บันทึกว่าใครเข้าดูหรือแก้ข้อมูลสุขภาพของฉันล่าสุด (เห็นได้เฉพาะเจ้าของข้อมูล) */
export const AccessLogCard: React.FC = () => {
  const [entries, setEntries] = useState<DataLogEntry[] | null | undefined>(undefined);

  useEffect(() => {
    if (!cloudEnabled) return;
    let alive = true;
    void fetchMyDataLog()
      .then((rows) => alive && setEntries(rows))
      .catch(() => alive && setEntries(null));
    return () => {
      alive = false;
    };
  }, []);

  if (!cloudEnabled) return null;

  return (
    <Card className="shadow-xs">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-bold text-slate-900">
        <History className="w-6 h-6 text-purple-700 shrink-0" aria-hidden="true" />
        <span>ใครเข้าดูหรือแก้ข้อมูลของคุณ</span>
      </h2>
      <p className="mb-3 text-base text-slate-600">
        บันทึกเมื่อสมาชิกคนอื่นเปิดดูหรือแก้ข้อมูลสุขภาพของคุณ (ไม่รวมตัวคุณเอง) เก็บไว้ 1 ปี บันทึกการดูมาจากการเปิดหน้าข้อมูลในแอป
      </p>
      {entries === undefined ? (
        <p className="text-base text-slate-600" role="status">
          กำลังโหลด...
        </p>
      ) : entries === null ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-base text-slate-600">
          ยังดูบันทึกไม่ได้ในตอนนี้
        </p>
      ) : entries.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-base text-slate-600">
          ยังไม่มีใครเข้าดูหรือแก้ข้อมูลของคุณ
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {entries.map((e) => (
            <li key={e.id} className="py-3 first:pt-0 last:pb-0">
              <p className="text-base font-bold text-slate-900 break-words">
                {e.actorId ? memberNameById(e.actorId) : 'สมาชิกที่ออกจากระบบแล้ว'} · {e.action === 'edit' ? 'แก้ไขข้อมูล' : 'เปิดดูข้อมูล'}
              </p>
              {e.action === 'edit' && e.keys.length > 0 && (
                <p className="text-sm text-slate-700">แก้: {e.keys.map((k) => KEY_LABEL[k] ?? k).join(', ')}</p>
              )}
              <p className="text-sm font-medium text-slate-500">{when(e.at)}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};
