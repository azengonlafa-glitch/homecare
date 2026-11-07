import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, BellRing, Check, Clock, Users } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../lib/cn';
import type { MedAlert } from '../../lib/medAlerts';

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
              <span className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-white px-2 py-0.5 text-xs font-bold text-rose-700 shrink-0">
                <Clock className="w-3 h-3" aria-hidden="true" />
                {formatLateMinutes(alert.minutesLate)}
              </span>
            )}

            {missed && alert.rounds > 1 && (
              <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-600 shrink-0">
                เตือนครั้งที่ {alert.round} จาก {alert.rounds}
              </span>
            )}
          </div>

          {/* รายละเอียด */}
          <p className="text-xs sm:text-sm text-slate-600 break-words">
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
              ถ้ายังไม่กินยา จะเตือนซ้ำอีกครั้งเวลา {alert.nextTime} น.
            </p>
          )}

          {/* ปุ่มดำเนินการ */}
          <div className="pt-2 flex flex-wrap items-center gap-2">
            {missed && (
              <Button
                size="sm"
                onClick={() => onTake(alert)}
                className="h-9 px-4 text-xs font-bold bg-purple-700 hover:bg-purple-800 text-white rounded-xl shadow-xs"
              >
                <Check className="w-4 h-4 mr-1" aria-hidden="true" />
                <span>กินแล้ว</span>
              </Button>
            )}
            <Link
              to="/meds"
              className="inline-flex items-center h-9 px-3.5 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-colors"
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
 * แถบเตือนเรื่องยาบนหน้าบันทึกอาการ:
 * แสดงรายการแจ้งเตือนแบบ Flat Card ไม่ซ้อนกรอบการ์ดสองชั้น และไม่แสดงไอคอนกระดิ่งซ้ำซ้อน
 */
export const ReminderPanel: React.FC<ReminderPanelProps> = ({ alerts, onTake, className }) => {
  if (alerts.length === 0) return null;

  return (
    <div className={cn('space-y-3', className)}>
      {alerts.map((alert) => (
        <AlertCard key={alert.key} alert={alert} onTake={onTake} />
      ))}
    </div>
  );
};
