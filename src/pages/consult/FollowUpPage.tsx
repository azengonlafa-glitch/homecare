import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, Send } from 'lucide-react';
import { ErrorCard, LoadingCard, SeverityScale } from '../../components/consult/ConsultUI';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Chip, FieldGroup } from '../../components/ui/ChoiceChips';
import { PageHeader } from '../../components/ui/PageHeader';
import { TextAreaField } from '../../components/ui/TextAreaField';
import { useToast } from '../../components/ui/Toast';
import { consultErrorText, getBackend } from '../../consult/backend';
import { DIRECTION_LABEL, severityDirection } from '../../consult/brief';
import { useConsultData } from '../../consult/hooks';
import { FEELINGS, TREND_LABEL } from '../../consult/options';
import type { Trend } from '../../consult/types';

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/** Module 5: ผู้ใช้อัปเดตอาการตามนัด เทียบกับครั้งก่อน แล้วส่งให้ผู้ให้บริการ */
export const FollowUpPage: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: bundles, loading, error, reload } = useConsultData((b) => b.listMyBundles(), []);
  const [severity, setSeverity] = useState<number | null>(null);
  const [feelings, setFeelings] = useState<string[]>([]);
  const [trend, setTrend] = useState<Trend>('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  if (loading && !bundles) return <LoadingCard />;
  if (error && !bundles) return <ErrorCard message={error} onRetry={reload} />;
  const bundle = bundles?.find((b) => b.followUps.some((f) => f.id === id));
  const followUp = bundle?.followUps.find((f) => f.id === id);
  if (!bundle || !followUp) return <ErrorCard message="ไม่พบนัดติดตามนี้" />;
  if (followUp.status !== 'pending') return <ErrorCard message="อัปเดตอาการของนัดนี้ไปแล้ว ดูได้ที่หน้าประวัติ" />;

  const previous = bundle.checkin?.severity ?? null;

  const submit = async () => {
    const found: Record<string, string> = {};
    if (severity === null) found['severity'] = 'กรุณาเลือกระดับความรุนแรง';
    if (!trend) found['fu-trend'] = 'กรุณาเลือกว่าอาการเป็นอย่างไร';
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      document.getElementById(first)?.focus();
      return;
    }
    setBusy(true);
    try {
      const backend = await getBackend();
      await backend.respondFollowUp(id, { severity, feelings, trend, note: note.trim() });
      toast.show('ส่งข้อมูลให้ผู้ให้บริการแล้ว');
      navigate('/consult/history', { replace: true });
    } catch (err) {
      toast.show(consultErrorText(err), { tone: 'error' });
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <PageHeader title="อัปเดตอาการ" description={`ติดตามผลจากการปรึกษา ${bundle.provider?.displayName ?? ''} เรื่อง ${bundle.session.topic}`} />
      {followUp.plan && (
        <Card className="p-5">
          <p className="text-base text-slate-900 break-words">
            <span className="font-bold">แผนติดตาม: </span>
            {followUp.plan}
          </p>
        </Card>
      )}

      <Card className="space-y-6 p-5 sm:p-7">
          <div>
            <SeverityScale value={severity} error={errors['severity']} onChange={setSeverity} />
            {severity !== null && (
              <p role="status" className="mt-3 rounded-2xl bg-slate-100 p-3 text-base font-semibold text-slate-900">
                ครั้งก่อน {previous !== null ? `${previous}/10` : 'ไม่ระบุ'} · ครั้งนี้ {severity}/10 · {DIRECTION_LABEL[severityDirection(previous, severity)]}
              </p>
            )}
          </div>
          <FieldGroup id="fu-trend" label="อาการเป็นอย่างไรเทียบกับครั้งก่อน" required error={errors['fu-trend']}>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(TREND_LABEL) as Exclude<Trend, ''>[]).map((t) => (
                <Chip key={t} selected={trend === t} onClick={() => setTrend(t)}>
                  {TREND_LABEL[t]}
                </Chip>
              ))}
            </div>
          </FieldGroup>
          <FieldGroup label="ตอนนี้รู้สึกอย่างไร">
            <div className="flex flex-wrap gap-2">
              {FEELINGS.map((f) => (
                <Chip key={f.value} selected={feelings.includes(f.value)} onClick={() => setFeelings((l) => toggle(l, f.value))}>
                  {f.label}
                </Chip>
              ))}
            </div>
          </FieldGroup>
          <TextAreaField id="fu-note" label="เล่าเพิ่มเติม" labelSuffix="(ไม่บังคับ)" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
          <Button fullWidth disabled={busy} onClick={() => void submit()}>
            {busy ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> : <Send className="w-5 h-5" aria-hidden="true" />}
            ส่งให้ผู้ให้บริการ
          </Button>
      </Card>
    </div>
  );
};
