import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, BellRing, Check, Clock, Users } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { cn } from '../../lib/cn';
import type { MedAlert } from '../../lib/medAlerts';

interface ReminderPanelProps {
  alerts: MedAlert[];
  /** บันทึกว่ากินยาแล้ว (เฉพาะการเตือนลืมกินยา) */
  onTake: (alert: MedAlert) => void;
  className?: string;
}

const metaChip = 'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm font-semibold';

/** แถวการเตือน 1 รายการ: บอกว่าเลยเวลามาเท่าไร เตือนครั้งที่เท่าไร และแจ้งคนในบ้านแล้วหรือยัง */
const AlertRow: React.FC<{ alert: MedAlert; onTake: (alert: MedAlert) => void }> = ({ alert, onTake }) => {
  const missed = alert.kind === 'missed';
  return (
    <li
      className={cn(
        'rounded-2xl border p-4',
        alert.tone === 'danger' ? 'border-red-200 bg-red-50/60' : 'border-amber-200 bg-amber-50/60'
      )}
    >
      <div className="flex items-start gap-3">
        {missed ? (
          <BellRing className="w-6 h-6 mt-0.5 shrink-0 text-red-700" aria-hidden="true" />
        ) : (
          <AlertTriangle
            className={cn('w-6 h-6 mt-0.5 shrink-0', alert.tone === 'danger' ? 'text-red-700' : 'text-amber-700')}
            aria-hidden="true"
          />
        )}

        <div className="min-w-0 flex-1">
          <p className="text-base sm:text-lg font-bold text-slate-900 break-words">{alert.title}</p>
          <p className="mt-0.5 text-base text-slate-700 break-words">{alert.body}</p>

          {/* เวลาและจำนวนครั้งที่เตือนแล้ว */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {missed && alert.minutesLate !== undefined && (
              <span className={cn(metaChip, 'border-red-300 bg-white text-red-800')}>
                <Clock className="w-4 h-4" aria-hidden="true" />
                เลยเวลา {alert.minutesLate} นาที
              </span>
            )}
            {missed && alert.rounds > 1 && (
              <span className={cn(metaChip, 'border-slate-300 bg-white text-slate-700')}>
                เตือนครั้งที่ {alert.round} จาก {alert.rounds}
              </span>
            )}
          </div>

          {alert.sharedWithFamily && (
            <p className="mt-2 flex items-start gap-2 text-base font-semibold text-purple-900">
              <Users className="w-5 h-5 mt-0.5 shrink-0" aria-hidden="true" />
              <span className="break-words">
                แจ้งทุกคนในบ้านแล้ว
                {alert.familyNames.length > 0 && ` · ${alert.familyNames.join(', ')}`}
              </span>
            </p>
          )}

          {alert.nextTime && (
            <p className="mt-2 text-base text-slate-700">
              ถ้ายังไม่กินยา จะเตือนซ้ำอีกครั้งเวลา {alert.nextTime} น.
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {missed && (
              <Button size="sm" onClick={() => onTake(alert)}>
                <Check className="w-5 h-5" aria-hidden="true" />
                <span>กินแล้ว</span>
              </Button>
            )}
            <Link
              to="/meds"
              className="inline-flex items-center min-h-[48px] px-5 rounded-xl sm:rounded-2xl text-base font-semibold text-purple-900 bg-white border border-purple-200 hover:bg-purple-50"
            >
              ไปที่ตู้ยา
            </Link>
          </div>
        </div>
      </div>
    </li>
  );
};

/**
 * กล่องแจ้งเตือนบนหน้าบันทึกอาการ: แสดงการเตือนที่ยังค้างอยู่ (ลืมกินยา, ยาใกล้หมด/หมดแล้ว)
 * พร้อมบอกเวลา จำนวนครั้งที่เตือน และแจ้งคนในบ้านแล้วหรือยัง — ไม่มีการเตือนก็ไม่ต้องแสดงกล่องนี้
 */
export const ReminderPanel: React.FC<ReminderPanelProps> = ({ alerts, onTake, className }) => {
  if (alerts.length === 0) return null;

  const missedCount = alerts.filter((a) => a.kind === 'missed').length;

  return (
    <Card className={cn('border-red-200 bg-red-50/40', className)}>
      <div className="flex items-start gap-3">
        <BellRing className="w-7 h-7 mt-0.5 shrink-0 text-red-700" aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-slate-900">
            การแจ้งเตือน ({alerts.length})
          </h2>
          <p className="mt-0.5 text-base text-slate-700">
            {missedCount > 0
              ? `ยังไม่ได้บันทึกการกินยา ${missedCount} มื้อ · กด “กินแล้ว” เพื่อหยุดการเตือน`
              : 'มีเรื่องที่ควรจัดการเกี่ยวกับยา'}
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-3">
        {alerts.map((alert) => (
          <AlertRow key={alert.key} alert={alert} onTake={onTake} />
        ))}
      </ul>
    </Card>
  );
};
