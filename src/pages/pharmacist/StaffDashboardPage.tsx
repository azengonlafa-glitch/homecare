import React, { useMemo, useState } from 'react';
import { Clock, MessageSquareText, Percent, Star, TimerReset, UserCheck, UserPlus, Users, XCircle, Inbox } from 'lucide-react';
import { BarList, HourBars, LineChart } from '../../components/consult/Charts';
import { ErrorCard, LoadingCard } from '../../components/consult/ConsultUI';
import { StarsDisplay } from '../../components/consult/Stars';
import { Card } from '../../components/ui/Card';
import { useConsultData } from '../../consult/hooks';
import { computeReviewStats, computeStats, durationText, type RangeDays } from '../../consult/dashboard';
import { CHANNEL_LABEL } from '../../consult/options';
import type { Channel } from '../../consult/types';
import { cn } from '../../lib/cn';

const RANGES: { days: RangeDays; label: string }[] = [
  { days: 7, label: '7 วัน' },
  { days: 30, label: '30 วัน' },
  { days: 90, label: '90 วัน' },
];

/** ตัวเลขหลายเคสในรายการคิวถูกจำกัดที่ 200 รายการล่าสุด ถ้าเต็มต้องบอกผู้ใช้ว่าสถิติย้อนหลังอาจไม่ครบ */
const QUEUE_LIMIT = 200;

const Kpi: React.FC<{ icon: React.ElementType; label: string; value: string; hint?: string; tone?: string }> = ({ icon: Icon, label, value, hint, tone = 'text-purple-800 bg-purple-50' }) => (
  <Card className="space-y-1 p-4 sm:p-4">
    <div className="flex items-center gap-2">
      <span className={cn('inline-flex h-9 w-9 items-center justify-center rounded-xl', tone)}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="text-sm font-semibold text-slate-700">{label}</p>
    </div>
    <p className="text-2xl font-extrabold text-slate-900 break-words">{value}</p>
    {hint && <p className="text-sm font-semibold text-slate-600">{hint}</p>}
  </Card>
);

const Panel: React.FC<{ title: string; hint?: string; className?: string; children: React.ReactNode }> = ({ title, hint, className, children }) => (
  <Card className={cn('space-y-3 p-4 sm:p-5', className)}>
    <div>
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      {hint && <p className="text-sm text-slate-600">{hint}</p>}
    </div>
    {children}
  </Card>
);

const dateText = (iso: string) => new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });

export const StaffDashboardPage: React.FC = () => {
  const { data, loading, error, reload } = useConsultData(
    async (b) => {
      const [queue, provider] = await Promise.all([b.listQueue(), b.getMyProvider()]);
      const reviews = provider ? await b.listReviews(provider.id) : [];
      return { queue, provider, reviews };
    },
    [],
    { sessionId: null }
  );
  const [range, setRange] = useState<RangeDays>(30);

  const stats = useMemo(() => computeStats(data?.queue ?? [], new Date(), range), [data, range]);
  const reviewStats = useMemo(() => computeReviewStats(data?.reviews ?? []), [data]);

  if (loading && !data) return <LoadingCard label="กำลังโหลดสถิติ..." />;
  if (error && !data) return <ErrorCard message={error} onRetry={reload} />;

  const truncated = (data?.queue.length ?? 0) >= QUEUE_LIMIT;
  const rate = stats.completionRate === null ? 'ยังไม่มีข้อมูล' : `${Math.round(stats.completionRate * 100)}%`;
  const channelItems = (Object.keys(CHANNEL_LABEL) as Channel[]).map((c) => ({ label: CHANNEL_LABEL[c], value: stats.byChannel[c], text: `${stats.byChannel[c]} เคส` }));
  const starItems = [5, 4, 3, 2, 1].map((n) => ({ label: `${n} ดาว`, value: reviewStats.distribution[n - 1], text: `${reviewStats.distribution[n - 1]} รีวิว` }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">สถิติและรีวิว</h1>
          {data?.provider && <p className="text-base text-slate-600 break-words">{data.provider.displayName} · {data.provider.orgName}</p>}
        </div>
        <div role="radiogroup" aria-label="ช่วงเวลา" className="inline-flex rounded-2xl border border-slate-300 bg-white p-1">
          {RANGES.map((r) => (
            <button
              key={r.days}
              type="button"
              role="radio"
              aria-checked={range === r.days}
              onClick={() => setRange(r.days)}
              className={cn(
                'min-h-[44px] cursor-pointer rounded-xl px-4 text-base font-bold transition-colors',
                range === r.days ? 'bg-purple-700 text-white' : 'text-slate-700 hover:bg-slate-100'
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {truncated && (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950">
          ระบบดึงรายการปรึกษาล่าสุด {QUEUE_LIMIT} เคสมาคำนวณ ถ้าช่วงที่เลือกยาวกว่านั้น ตัวเลขย้อนหลังอาจไม่ครบ
        </p>
      )}

      <section aria-label="ตัวเลขสรุป" className="tile-cycle grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Inbox} label="คำขอที่เข้ามา" value={`${stats.requests}`} hint={`ยังเปิดอยู่ ${stats.open} เคส`} />
        <Kpi icon={UserCheck} label="ปรึกษาจบ" value={`${stats.completed}`} hint="ปิดจบเรียบร้อยแล้ว" tone="text-emerald-800 bg-emerald-50" />
        <Kpi icon={XCircle} label="ยกเลิก" value={`${stats.cancelled}`} tone="text-slate-700 bg-slate-100" />
        <Kpi icon={Users} label="ผู้ใช้ที่เข้ามา" value={`${stats.patients} คน`} hint={`กลับมาปรึกษาซ้ำ ${stats.returningPatients} คน`} tone="text-sky-800 bg-sky-50" />
        <Kpi icon={TimerReset} label="รอรับเรื่องเฉลี่ย" value={durationText(stats.avgWaitMinutes)} hint="ตั้งแต่ส่งคำขอถึงมีคนรับ" tone="text-amber-900 bg-amber-50" />
        <Kpi icon={Clock} label="ใช้เวลาปรึกษาเฉลี่ย" value={durationText(stats.avgDurationMinutes)} hint="ตั้งแต่รับเรื่องถึงปิดจบ" tone="text-amber-900 bg-amber-50" />
        <Kpi icon={Percent} label="อัตราปรึกษาจบ" value={rate} hint="จากเคสที่ปิดแล้ว" tone="text-emerald-800 bg-emerald-50" />
        <Kpi
          icon={Star}
          label="คะแนนรีวิว"
          value={reviewStats.average === null ? 'ยังไม่มีรีวิว' : `${reviewStats.average.toFixed(1)} / 5`}
          hint={reviewStats.count > 0 ? `จาก ${reviewStats.count} รีวิว (ทั้งหมด)` : undefined}
          tone="text-amber-900 bg-amber-50"
        />
      </section>

      <Panel title="คำขอที่เข้ามาและเคสที่ปรึกษาจบ" hint={`รายวัน ย้อนหลัง ${range} วัน`}>
        {stats.requests === 0 && stats.completed === 0 ? (
          <p className="flex items-center gap-2 py-6 text-base text-slate-600">
            <Inbox className="h-5 w-5 text-slate-400" aria-hidden="true" />
            ช่วงนี้ยังไม่มีคำขอ ลองเลือกช่วงเวลาที่ยาวขึ้น
          </p>
        ) : (
          <LineChart days={stats.days} label="กราฟเส้นคำขอที่เข้ามาและเคสที่ปรึกษาจบรายวัน" />
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="ช่วงเวลาที่คนเข้ามามาก" hint={stats.peakHour === null ? 'ยังไม่มีข้อมูล' : `มากที่สุดช่วง ${String(stats.peakHour).padStart(2, '0')}:00 น. เหมาะกับการจัดคนเข้ากะ`}>
          <HourBars values={stats.byHour} />
        </Panel>
        <Panel title="ช่องทางที่ผู้ใช้เลือก" hint="นับจากคำขอในช่วงที่เลือก">
          <BarList items={channelItems} color="bg-sky-600" />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="ภาระงานของทีม" hint="เคสที่แต่ละคนรับ ในช่วงที่เลือก">
          {stats.staff.length === 0 ? (
            <p className="flex items-center gap-2 text-base text-slate-600">
              <UserPlus className="h-5 w-5 text-slate-400" aria-hidden="true" />
              ยังไม่มีเคสที่มีผู้รับ
            </p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {stats.staff.map((s) => (
                <li key={s.name} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                  <span className="text-base font-bold text-slate-900 break-words">{s.name}</span>
                  <span className="text-sm font-semibold text-slate-700">
                    จบแล้ว {s.completed} · กำลังดูแล {s.active}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="คะแนนรีวิว" hint="รีวิวทั้งหมดของร้าน ไม่ระบุตัวผู้รีวิว">
          {reviewStats.average === null ? (
            <p className="text-base text-slate-600">ยังไม่มีรีวิว คะแนนจะแสดงเมื่อผู้ใช้ให้ดาวหลังปรึกษาจบ</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <p className="text-4xl font-extrabold text-slate-900">{reviewStats.average.toFixed(1)}</p>
                <div>
                  <StarsDisplay value={reviewStats.average} />
                  <p className="text-sm font-semibold text-slate-600">จาก {reviewStats.count} รีวิว</p>
                </div>
              </div>
              <BarList items={starItems} color="bg-amber-400" />
            </>
          )}
        </Panel>
      </div>

      <Panel title="ความคิดเห็นล่าสุด" hint="เฉพาะรีวิวที่มีข้อความ">
        {reviewStats.withComment.length === 0 ? (
          <p className="flex items-center gap-2 text-base text-slate-600">
            <MessageSquareText className="h-5 w-5 text-slate-400" aria-hidden="true" />
            ยังไม่มีความคิดเห็น
          </p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {reviewStats.withComment.slice(0, 20).map((r) => (
              <li key={r.id} className="space-y-1 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StarsDisplay value={r.stars} size="sm" />
                  <span className="text-sm font-semibold text-slate-600">ผู้ใช้ Growa · {dateText(r.createdAt)}</span>
                </div>
                <p className="text-base text-slate-800 whitespace-pre-wrap break-words">{r.comment}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
};
