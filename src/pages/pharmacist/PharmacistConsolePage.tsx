import React, { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useMatch, useNavigate } from 'react-router-dom';
import { ClipboardCheck, Inbox, MessageCircleWarning, Power, UserCheck, Users } from 'lucide-react';
import { ErrorCard, LoadingCard } from '../../components/consult/ConsultUI';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { TextField } from '../../components/ui/TextField';
import { useToast } from '../../components/ui/Toast';
import { consultErrorText, getBackend } from '../../consult/backend';
import { useConsultData } from '../../consult/hooks';
import { TREND_LABEL } from '../../consult/options';
import type { ConsultSession } from '../../consult/types';
import { cn } from '../../lib/cn';

export function waitingText(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return 'เมื่อสักครู่';
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} ชั่วโมงที่แล้ว`;
  return `${Math.floor(minutes / 1440)} วันที่แล้ว`;
}

const SectionTitle: React.FC<{ children: React.ReactNode; count: number; icon?: React.ElementType }> = ({ children, count, icon: Icon }) => (
  <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
    {Icon && <Icon className="w-5 h-5 text-purple-700" aria-hidden="true" />}
    {children} <span className="font-semibold text-slate-500">({count})</span>
  </h2>
);

interface RowProps {
  s: ConsultSession;
  selected: boolean;
  /** ผู้ป่วยส่งข้อความล่าสุด รอเราตอบ */
  needsReply?: boolean;
  /** กดรับเรื่องจากรายการได้เลย */
  onClaim?: (s: ConsultSession) => void;
  claiming?: boolean;
  muted?: boolean;
}

const Row: React.FC<RowProps> = ({ s, selected, needsReply, onClaim, claiming, muted }) => (
  <li className="space-y-1.5">
    <Link
      to={`/pharmacist/${s.id}`}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'block rounded-2xl border p-3 transition-colors hover:border-purple-300 hover:bg-purple-50/40',
        selected ? 'border-purple-600 bg-purple-50 ring-1 ring-purple-600' : needsReply ? 'border-purple-400 bg-white' : 'border-slate-200 bg-white',
        muted && !selected && 'bg-slate-50'
      )}
    >
      <p className="text-lg font-bold text-slate-900 break-words">{s.patientLabel || 'ผู้รับบริการ'}</p>
      <p className="text-base text-slate-700 break-words line-clamp-2">{s.topic}</p>
      <p className="text-sm font-semibold text-slate-600">ส่งเมื่อ {waitingText(s.createdAt)}</p>
      {needsReply && (
        <p className="mt-1 flex items-center gap-1.5 text-base font-bold text-purple-900">
          <MessageCircleWarning className="w-4 h-4 shrink-0" aria-hidden="true" />
          ผู้ป่วยส่งข้อความ รอตอบ
        </p>
      )}
      {muted && s.assignedName && (
        <p className="mt-1 flex items-center gap-1.5 text-base font-semibold text-slate-700">
          <UserCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
          {s.assignedName} กำลังดูแล
        </p>
      )}
      {s.scheduledAt && <p className="text-base font-semibold text-purple-900">นัด {new Date(s.scheduledAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}</p>}
    </Link>
    {onClaim && (
      <Button size="sm" fullWidth disabled={claiming} onClick={() => onClaim(s)}>
        {claiming ? 'กำลังรับเรื่อง...' : 'รับเรื่อง'}
      </Button>
    )}
  </li>
);

const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="flex items-center gap-2 py-2 text-base text-slate-600">
    <Inbox className="w-4 h-4 text-slate-400" aria-hidden="true" />
    {children}
  </p>
);

/** รายการคิวของร้าน ทุกคนในทีมเห็นคิวเดียวกัน แยกเคสของฉัน กับเคสที่เพื่อนร่วมงานดูแล */
export const QueuePanel: React.FC<{ selectedId?: string; onPick?: () => void }> = ({ selectedId, onPick }) => {
  const toast = useToast();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useConsultData(
    async (b) => {
      const [queue, provider, me] = await Promise.all([b.listQueue(), b.getMyProvider(), b.getStaffContext()]);
      const info = await b.listQueueInfo(queue.filter((s) => s.status === 'active').map((s) => s.id));
      return { queue, provider, info, me: me?.userId ?? '' };
    },
    [],
    { sessionId: null }
  );
  const [busy, setBusy] = useState(false);
  const [claiming, setClaiming] = useState('');
  const [search, setSearch] = useState('');

  const { waiting, mine, others, done } = useMemo(() => {
    const term = search.trim().toLowerCase();
    const queue = [...(data?.queue ?? [])]
      .filter((s) => !term || `${s.patientLabel} ${s.topic}`.toLowerCase().includes(term))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const sender = data?.info.lastSender ?? {};
    const me = data?.me ?? '';
    const active = queue.filter((s) => s.status === 'active');
    return {
      waiting: queue.filter((s) => s.status === 'requested'),
      // เรื่องที่ผู้ป่วยรอเราตอบขึ้นก่อน เคสเก่าที่ยังไม่มีผู้ดูแลถือว่าเป็นของเรา เพราะรับต่อได้ทันที
      mine: active
        .filter((s) => s.assignedTo === me || s.assignedTo === null)
        .sort((a, b) => Number(sender[b.id] === 'patient') - Number(sender[a.id] === 'patient')),
      others: active.filter((s) => s.assignedTo !== null && s.assignedTo !== me),
      done: queue.filter((s) => s.status === 'completed' || s.status === 'cancelled').reverse().slice(0, 30),
    };
  }, [data, search]);

  // เห็นจำนวนคำขอใหม่บนแท็บเบราว์เซอร์ แม้ทำงานอยู่หน้าอื่น
  const waitingCount = waiting.length;
  useEffect(() => {
    const previous = document.title;
    document.title = waitingCount > 0 ? `(${waitingCount}) คิวปรึกษา` : 'คิวปรึกษา';
    return () => {
      document.title = previous;
    };
  }, [waitingCount]);

  if (loading && !data) return <LoadingCard label="กำลังโหลดคิว..." />;
  if (error && !data) return <ErrorCard message={error} onRetry={reload} />;

  const provider = data?.provider;
  const toggleOnline = async () => {
    setBusy(true);
    try {
      const backend = await getBackend();
      await backend.setOnline(!provider?.online);
      reload();
    } catch (err) {
      toast.show(consultErrorText(err), { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  // รับเรื่อง = จองเคส ถ้าเพื่อนร่วมงานกดก่อนจะแจ้งและโหลดคิวใหม่ ไม่ทับกัน
  const claim = async (s: ConsultSession) => {
    setClaiming(s.id);
    try {
      const backend = await getBackend();
      await backend.acceptSession(s.id);
      toast.show('รับเรื่องแล้ว');
      onPick?.();
      navigate(`/pharmacist/${s.id}`);
    } catch (err) {
      toast.show(consultErrorText(err), { tone: 'error' });
    } finally {
      setClaiming('');
      reload();
    }
  };

  const unreplied = mine.filter((s) => data?.info.lastSender[s.id] === 'patient').length;

  return (
    <div className="space-y-4" onClick={(e) => (e.target as HTMLElement).closest('a') && onPick?.()}>
      <Card className="space-y-3 p-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">คิวปรึกษา</h1>
          {provider && <p className="text-base text-slate-600 break-words">{provider.displayName} · {provider.orgName}</p>}
        </div>
        {provider && (
          <Button variant={provider.online ? 'soft' : 'neutral'} size="sm" fullWidth disabled={busy} onClick={() => void toggleOnline()}>
            <Power className={cn('w-5 h-5', provider.online && 'text-emerald-700')} aria-hidden="true" />
            {provider.online ? 'ร้านออนไลน์อยู่ กดเพื่อปิด' : 'ร้านออฟไลน์ กดเพื่อเปิด'}
          </Button>
        )}
        <div className="grid grid-cols-3 gap-2 text-center" aria-label="สรุปคิว">
          <div className="rounded-[1.25rem] bg-sun-soft p-2">
            <p className="text-3xl font-extrabold text-amber-950">{waiting.length}</p>
            <p className="text-sm font-semibold text-amber-900">รอรับเรื่อง</p>
          </div>
          <div className="rounded-[1.25rem] bg-purple-100 p-2">
            <p className="text-3xl font-extrabold text-purple-950">{mine.length}</p>
            <p className="text-sm font-semibold text-purple-900">ของฉัน{unreplied > 0 && ` · รอตอบ ${unreplied}`}</p>
          </div>
          <div className="rounded-[1.25rem] bg-peach-soft p-2">
            <p className="text-3xl font-extrabold text-slate-900">{others.length}</p>
            <p className="text-sm font-semibold text-slate-700">เพื่อนร่วมงาน</p>
          </div>
        </div>
        <TextField id="queue-search" label="ค้นหาชื่อหรือเรื่องที่ปรึกษา" hideLabel placeholder="ค้นหาชื่อหรือเรื่องที่ปรึกษา" value={search} onChange={(e) => setSearch(e.target.value)} />
      </Card>

      {!!data?.info.followUps.length && (
        <Card className="space-y-2 border-purple-300 p-4">
          <SectionTitle count={data.info.followUps.length} icon={ClipboardCheck}>
            ผลติดตามรอตรวจ
          </SectionTitle>
          <ul className="space-y-2">
            {data.info.followUps.map((f) => {
              const s = data.queue.find((x) => x.id === f.sessionId);
              return (
                <li key={f.id}>
                  <Link to={`/pharmacist/${f.sessionId}`} className="block rounded-2xl border border-slate-200 bg-white p-3 hover:border-purple-300 hover:bg-purple-50/40">
                    <p className="text-base font-bold text-slate-900 break-words">{s?.patientLabel || 'ผู้รับบริการ'}</p>
                    <p className="text-base text-slate-700 break-words">
                      อาการล่าสุด {f.response?.severity !== null && f.response?.severity !== undefined ? `${f.response.severity}/10` : 'ไม่ระบุ'}
                      {f.response?.trend && ` · ${TREND_LABEL[f.response.trend]}`}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card className="space-y-2 p-4">
        <SectionTitle count={waiting.length}>รอรับเรื่อง</SectionTitle>
        {waiting.length === 0 ? (
          <Empty>ไม่มีคำขอใหม่</Empty>
        ) : (
          <ul className="space-y-3">
            {waiting.map((s) => (
              <Row key={s.id} s={s} selected={s.id === selectedId} onClaim={(x) => void claim(x)} claiming={claiming === s.id} />
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-2 p-4">
        <SectionTitle count={mine.length}>ของฉัน กำลังปรึกษา</SectionTitle>
        {mine.length === 0 ? (
          <Empty>ยังไม่มีเคสที่คุณดูแลอยู่</Empty>
        ) : (
          <ul className="space-y-2">
            {mine.map((s) => (
              <Row key={s.id} s={s} selected={s.id === selectedId} needsReply={data?.info.lastSender[s.id] === 'patient'} />
            ))}
          </ul>
        )}
      </Card>

      {others.length > 0 && (
        <Card className="space-y-2 p-4">
          <SectionTitle count={others.length} icon={Users}>
            เพื่อนร่วมงานกำลังดูแล
          </SectionTitle>
          <ul className="space-y-2">
            {others.map((s) => (
              <Row key={s.id} s={s} selected={s.id === selectedId} muted />
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-4">
        <details>
          <summary className="cursor-pointer text-base font-bold text-slate-900">
            ปิดแล้วล่าสุด <span className="font-semibold text-slate-500">({done.length})</span>
          </summary>
          <div className="mt-2">
            {done.length === 0 ? (
              <Empty>ยังไม่มีประวัติ</Empty>
            ) : (
              <ul className="space-y-2">
                {done.map((s) => (
                  <Row key={s.id} s={s} selected={s.id === selectedId} />
                ))}
              </ul>
            )}
          </div>
        </details>
      </Card>
    </div>
  );
};

/** หน้าจอเดียวสำหรับทีมงาน: รายการคิวทางซ้าย พื้นที่ทำงานของเคสที่เลือกทางขวา สลับเคสได้ทันทีโดยไม่ต้องกลับไปหน้าคิว (มือถือแสดงทีละส่วน) */
export const PharmacistConsolePage: React.FC = () => {
  const match = useMatch('/pharmacist/:id');
  const selectedId = match?.params.id;
  // เปิดเคสแล้วเห็นหน้าเดียวเต็มจอ (แชท → ข้อมูลผู้ป่วย → บันทึก) ไม่มีคิวข้างๆ ให้ลายตา กลับไปคิวด้วยปุ่มด้านบน
  if (selectedId) {
    return (
      <section aria-label="พื้นที่ทำงาน" className="min-w-0">
        <Outlet />
      </section>
    );
  }
  return (
    <div className="mx-auto max-w-2xl">
      <aside aria-label="คิวปรึกษา" className="min-w-0">
        <QueuePanel />
      </aside>
    </div>
  );
};

export const ConsolePlaceholder: React.FC = () => (
  <Card className="flex flex-col items-center gap-2 py-20 text-center">
    <Inbox className="w-12 h-12 text-slate-300" aria-hidden="true" />
    <p className="text-lg font-bold text-slate-900">เลือกเรื่องจากคิวทางซ้าย</p>
    <p className="max-w-sm text-base text-slate-600">กด “รับเรื่อง” เพื่อจองเคสให้เป็นของคุณ เพื่อนร่วมงานจะรับซ้ำไม่ได้ และเปิดสลับดูหลายเคสพร้อมกันได้</p>
  </Card>
);
