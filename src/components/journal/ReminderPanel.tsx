import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, BellRing, Check, Clock, Users } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../lib/cn';
import type { MedAlert } from '../../lib/medAlerts';
import { doseWords } from '../../lib/meds';

interface ReminderPanelProps {
  alerts: MedAlert[];
  /** บันทึกว่ากินยาแล้ว (เฉพาะการเตือนลืมกินยา) */
  onTake: (alert: MedAlert) => void;
  className?: string;
}

const formatLateMinutes = (mins: number) => {
  if (mins < 60) return `เลยเวลา ${mins} นาที`;
  const hours = Math.floor(mins / 60);
  const remaining = mins % 60;
  return remaining > 0 ? `เลยเวลา ${hours} ชั่วโมง ${remaining} นาที` : `เลยเวลา ${hours} ชั่วโมง`;
};

/**
 * แถบการแจ้งเตือนเรื่องยา (แบบใบเดี่ยว ไม่ซ้อนกล่อง ไม่ซ้ำไอคอนกระดิ่ง)
 * สบายตา ตรงประเด็น เหมาะสำหรับวัยทำงานและผู้ดูแลในบ้าน
 */
const AlertCard: React.FC<{ alert: MedAlert; onTake: (alert: MedAlert) => void }> = ({
  alert,
  onTake,
}) => {
  const missed = alert.kind === 'missed';
  const w = doseWords(alert.form);
  const isDanger = alert.tone === 'danger' || missed;

  return (
    <div
      className={cn(
        'rounded-[1.75rem] border p-4 sm:p-5 transition-colors',
        isDanger
          ? 'border-rose-200 bg-rose-50 hover:bg-rose-100'
          : 'border-amber-200 bg-amber-50 hover:bg-amber-100'
      )}
    >
      <div className="flex items-start gap-3.5">
        {/* ไอคอนกระดิ่งเดี่ยว ชัดเจน ไม่ซ้อนซ้ำ */}
        <div
          className={cn(
            'h-10 w-10 sm:h-11 sm:w-11 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-2xs',
            isDanger ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
          )}
        >
          {missed ? (
            <BellRing className="w-5 h-5" aria-hidden="true" />
          ) : (
            <AlertTriangle className="w-5 h-5" aria-hidden="true" />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          {/* หัวข้อ + ชิปบอกเวลาและรอบการเตือน */}
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base sm:text-lg font-extrabold text-slate-900 break-words">
              {alert.title}
            </h3>

            {missed && alert.minutesLate !== undefined && (
              <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-rose-200 bg-white px-2 py-0.5 text-xs font-bold text-rose-700">
                <Clock className="w-3 h-3" aria-hidden="true" />
                {formatLateMinutes(alert.minutesLate)}
              </span>
            )}

            {missed && alert.rounds > 1 && (
              <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 max-w-full">
                เตือนครั้งที่ {alert.round} จาก {alert.rounds}
              </span>
            )}
          </div>

          {/* รายละเอียด */}
          <p className="text-sm text-slate-700 break-words">
            {alert.body}
          </p>

          {/* ประวัติการแจ้งเตือนคนในบ้าน */}
          {alert.sharedWithFamily && (
            <p className="pt-0.5 flex items-center gap-1.5 text-xs font-semibold text-purple-900">
              <Users className="w-3.5 h-3.5 shrink-0 text-purple-700" aria-hidden="true" />
              <span className="break-words">
                แจ้งทุกคนในบ้านแล้ว
                {alert.familyNames.length > 0 && ` · ${alert.familyNames.join(', ')}`}
              </span>
            </p>
          )}

          {alert.nextTime && (
            <p className="text-xs text-slate-500">
              ถ้ายังไม่{w.phrase} จะเตือนซ้ำอีกครั้งเวลา {alert.nextTime} น.
            </p>
          )}

          {/* ปุ่มดำเนินการ */}
          <div className="pt-2 flex flex-wrap items-center gap-2">
            {missed && (
              <Button
                size="sm"
                onClick={() => onTake(alert)}
                className="min-h-[48px] px-5 text-sm font-bold bg-purple-700 hover:bg-purple-800 text-white rounded-xl shadow-xs"
              >
                <Check className="w-4 h-4 mr-1" aria-hidden="true" />
                <span>{w.done}</span>
              </Button>
            )}
            <Link
              to="/meds"
              className="inline-flex items-center min-h-[48px] px-4 rounded-xl text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              <span>ไปที่ตู้ยา</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * ลืมกินยาหลายรายการพร้อมกัน: รวมเป็นการ์ดใบเดียว (เดิมเป็นการ์ดใหญ่ซ้ำกันใบละเกือบครึ่งจอมือถือ)
 * แต่ละรายการยังมีปุ่ม "กินแล้ว" ของตัวเอง เพราะบันทึกทีละมื้อทีละยา
 */
const MissedGroupCard: React.FC<{ alerts: MedAlert[]; onTake: (alert: MedAlert) => void }> = ({
  alerts,
  onTake,
}) => {
  const lateMost = Math.max(...alerts.map((a) => a.minutesLate ?? 0));
  const shared = alerts.find((a) => a.sharedWithFamily);

  return (
    <div className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-4 sm:p-5">
      <div className="flex items-start gap-3.5">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700 sm:h-11 sm:w-11">
          <BellRing className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words text-base font-extrabold text-slate-900 sm:text-lg">
              ลืมกินยา {alerts.length} รายการหรือเปล่า?
            </h3>
            {lateMost > 0 && (
              <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-rose-200 bg-white px-2 py-0.5 text-xs font-bold text-rose-700">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {formatLateMinutes(lateMost)}
              </span>
            )}
          </div>
          {shared && (
            <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-purple-900">
              <Users className="h-3.5 w-3.5 shrink-0 text-purple-700" aria-hidden="true" />
              <span className="break-words">
                แจ้งทุกคนในบ้านแล้ว
                {shared.familyNames.length > 0 && ` · ${shared.familyNames.join(', ')}`}
              </span>
            </p>
          )}

          <ul className="mt-3 divide-y divide-rose-200/80">
            {alerts.map((alert) => (
              <li key={alert.key} className="fit-row py-3 first:pt-0">
                <p className="flex-1 break-words text-sm text-slate-800">{alert.body}</p>
                <Button
                  size="sm"
                  onClick={() => onTake(alert)}
                  className="min-h-[48px] shrink-0 rounded-xl px-5 text-sm font-bold"
                >
                  <Check className="mr-1 h-4 w-4" aria-hidden="true" />
                  <span>{doseWords(alert.form).done}</span>
                </Button>
              </li>
            ))}
          </ul>

          <Link
            to="/meds"
            className="mt-1 inline-flex min-h-[48px] items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900"
          >
            ไปที่ตู้ยา
          </Link>
        </div>
      </div>
    </div>
  );
};

/**
 * แถบเตือนเรื่องยาบนหน้าบันทึกอาการ:
 * แสดงรายการแจ้งเตือนแบบ Flat Card ไม่ซ้อนกรอบการ์ดสองชั้น และไม่แสดงไอคอนกระดิ่งซ้ำซ้อน
 * ลืมกินยาตั้งแต่ 2 รายการขึ้นไปจะรวมเป็นการ์ดเดียว
 */
export const ReminderPanel: React.FC<ReminderPanelProps> = ({ alerts, onTake, className }) => {
  if (alerts.length === 0) return null;

  const missed = alerts.filter((a) => a.kind === 'missed');
  const others = alerts.filter((a) => a.kind !== 'missed');
  const group = missed.length >= 2;

  return (
    <div className={cn('space-y-3', className)}>
      {group && <MissedGroupCard alerts={missed} onTake={onTake} />}
      {(group ? others : alerts).map((alert) => (
        <AlertCard key={alert.key} alert={alert} onTake={onTake} />
      ))}
    </div>
  );
};
