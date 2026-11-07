import React, { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Loader2, Pencil, Send } from 'lucide-react';
import { BriefView } from '../../components/consult/BriefView';
import { ConsentDocumentModal } from '../../components/onboarding/ConsentDocumentModal';
import { ErrorCard, LoadingCard } from '../../components/consult/ConsultUI';
import { Button, buttonClass } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CheckboxField } from '../../components/ui/CheckboxField';
import { PageHeader } from '../../components/ui/PageHeader';
import { useToast } from '../../components/ui/Toast';
import { consultErrorText, CONSULT_MODE, getBackend } from '../../consult/backend';
import { buildBrief, profileAttachments, recentLogs } from '../../consult/brief';
import { deleteLocalFile, getLocalFile, newUuid, putLocalFile } from '../../consult/files';
import { clearDraft, loadDraft, useConsultData } from '../../consult/hooks';
import { ALL_SCOPES, CONSENT_VERSION, purposeLabel } from '../../consult/options';
import type { SymptomCheckin } from '../../consult/types';
import { CONSENT_VERSION as CONSENT_DOCUMENT_VERSION } from '../../data/consentDocument';
import { getFile } from '../../lib/fileStore';
import { SELF_LABEL, currentJournalUser, loadPosts } from '../../lib/journal';
import { loadMeds } from '../../lib/meds';
import { loadOnboarding, saveOnboarding } from '../../lib/onboarding';

/** Module 3: รวม Patient Brief จากข้อมูลเดิม ให้ผู้ใช้ตรวจ และยินยอมก่อนส่ง */
export const ReviewConsentPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [draft] = useState(() => loadDraft());
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [docOpen, setDocOpen] = useState(false);
  const [docVersion, setDocVersion] = useState(() => loadOnboarding().profile.consentVersion);

  const providerId = draft?.providerId ?? '';
  const { data, loading, error, reload } = useConsultData(
    async (b) => {
      const [provider, prior] = await Promise.all([b.getProvider(providerId), b.listMyBundles()]);
      return { provider, prior };
    },
    [providerId]
  );

  const profile = useMemo(() => loadOnboarding().profile, []);
  const meds = useMemo(() => loadMeds(), []);
  const user = useMemo(() => currentJournalUser(), []);
  const logs = useMemo(() => recentLogs(loadPosts(), user.id, SELF_LABEL), [user.id]);

  const brief = useMemo(() => {
    if (!draft || !data) return null;
    // ส่งครบทุกหมวดเสมอ เภสัชกรต้องเห็นข้อมูลทั้งหมดเพื่อให้คำแนะนำได้แม่นยำ
    return buildBrief({ profile, meds, answers: draft.answers, prior: data.prior, scopes: ALL_SCOPES, logs, fallbackName: user.name });
  }, [draft, data, profile, meds, logs, user.name]);

  if (!draft) return <Navigate to="/consult" replace />;

  if (loading && !data) return <LoadingCard label="กำลังรวมข้อมูลสุขภาพของคุณ..." />;
  if (error) return <ErrorCard message={error} onRetry={reload} />;
  if (!data?.provider) return <ErrorCard message="ไม่พบผู้ให้บริการที่เลือก กรุณากลับไปเลือกใหม่" />;

  const provider = data.provider;
  const docOutdated = docVersion !== CONSENT_DOCUMENT_VERSION;

  const acceptDocument = () => {
    const state = loadOnboarding();
    saveOnboarding({ ...state, profile: { ...state.profile, consent: true, consentAt: new Date().toISOString(), consentVersion: CONSENT_DOCUMENT_VERSION } });
    setDocVersion(CONSENT_DOCUMENT_VERSION);
    setDocOpen(false);
    setErrors((e) => {
      const { 'rv-doc': _removed, ...rest } = e;
      return rest;
    });
  };

  const submit = async () => {
    const found: Record<string, string> = {};
    if (docOutdated) found['rv-doc'] = 'กรุณาอ่านเอกสารฉบับใหม่ให้จบและกดยอมรับก่อน';
    if (!agree) found['rv-agree'] = 'กรุณายืนยันความยินยอมก่อนส่ง';
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      document.getElementById(first)?.focus();
      return;
    }
    if (!brief) return;

    setBusy(true);
    setSubmitError('');
    try {
      const backend = await getBackend();
      const now = new Date().toISOString();
      const checkin: SymptomCheckin = { ...draft.answers, id: newUuid(), createdAt: now };
      await backend.startConsultation({
        sessionId: draft.sessionId,
        provider,
        // เริ่มเป็นบทสนทนาเสมอ แล้วเลือกโทรหรือวิดีโอได้ในห้อง
        channel: 'chat',
        scheduledAt: null,
        topic: purposeLabel(draft.answers),
        patientLabel: brief.overview?.name || 'ผู้รับบริการ',
        checkin,
        brief,
        scopes: ALL_SCOPES,
        consentVersion: CONSENT_VERSION,
      });

      // ส่งไฟล์หลังสร้างการปรึกษาแล้ว เพราะสิทธิ์ของไฟล์ผูกกับการปรึกษานี้
      let failedFiles = 0;
      // เอกสารจากข้อมูลสุขภาพอยู่ในที่เก็บของบ้าน เภสัชกรเปิดไม่ได้ จึงคัดลอกมาไว้ใต้การปรึกษานี้
      for (const a of profileAttachments(brief)) {
        try {
          const blob = await getFile(a.id);
          if (!blob) throw new Error('missing');
          await putLocalFile(a.id, blob);
        } catch {
          failedFiles += 1;
        }
      }
      for (const a of [...draft.answers.attachments, ...profileAttachments(brief)]) {
        try {
          const blob = await getLocalFile(a.id);
          if (blob) await backend.uploadFile(draft.sessionId, a, blob);
          if (backend.mode === 'live') void deleteLocalFile(a.id);
        } catch {
          failedFiles += 1;
        }
      }
      clearDraft();
      if (failedFiles > 0) toast.show(`ส่งไฟล์ไม่สำเร็จ ${failedFiles} ไฟล์ กรุณาแนบใหม่ในห้องสนทนา`, { tone: 'error' });
      navigate(`/consult/room/${draft.sessionId}`, { replace: true });
    } catch (err) {
      console.error('Start consultation failed', err);
      setSubmitError(consultErrorText(err));
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <PageHeader title="ตรวจสอบและยินยอม" description={`ข้อมูลสุขภาพและอาการล่าสุดด้านล่างจะส่งให้ ${provider.displayName} ไม่ส่งเบอร์โทร ที่อยู่ และผู้ติดต่อฉุกเฉิน`} />

      <Card className="space-y-4 p-5 sm:p-6">
        <p className="text-base text-slate-800">ข้อมูลครบช่วยให้เภสัชกรแนะนำได้แม่นยำและปลอดภัย กรุณาตรวจว่าถูกต้อง</p>
        <div className="space-y-2">
          <p className="text-base text-slate-700">ข้อมูลไม่ถูกต้อง? แก้ไขแล้วกลับมาที่หน้านี้ได้ คำตอบที่กรอกไว้ยังอยู่</p>
          <div className="flex flex-wrap gap-2">
            <Link to="/health" className={buttonClass('soft', 'sm')}>
              <Pencil className="w-4 h-4" aria-hidden="true" />
              แก้ไขข้อมูลสุขภาพ
            </Link>
            <Link to="/meds" className={buttonClass('soft', 'sm')}>
              แก้ไขตู้ยา
            </Link>
          </div>
        </div>
      </Card>

      <section aria-label="ตัวอย่างข้อมูลที่จะส่ง" className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">ข้อมูลที่จะส่ง</h2>
        {brief && <BriefView brief={brief} audience="patient" />}
      </section>

      <Card className="space-y-4 p-5 sm:p-6">
        {docOutdated && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 space-y-3">
            <p className="text-base font-semibold text-amber-950">เอกสารให้ความยินยอมมีการปรับปรุงเรื่องการส่งข้อมูลให้เภสัชกร กรุณาอ่านให้จบก่อนเริ่มปรึกษา</p>
            <Button id="rv-doc" variant="soft" size="sm" onClick={() => setDocOpen(true)}>
              <FileText className="w-5 h-5" aria-hidden="true" />
              เปิดอ่านเอกสาร
            </Button>
            {errors['rv-doc'] && (
              <p role="alert" className="text-base font-semibold text-red-700">
                {errors['rv-doc']}
              </p>
            )}
          </div>
        )}
        <CheckboxField id="rv-agree" boxed checked={agree} error={errors['rv-agree']} onChange={setAgree}>
          {CONSULT_MODE === 'mock'
            ? 'เข้าใจว่านี่เป็นโหมดทดสอบ ข้อมูลอยู่ในเครื่องนี้เท่านั้นและไม่ได้ส่งให้ใคร'
            : `ฉันยินยอมให้เปิดเผยข้อมูลทั้งหมดด้านบน รวมถึงเอกสารแนบ แก่ ${provider.displayName} (${provider.orgName}) เพื่อการปรึกษาครั้งนี้ ผู้ให้บริการอาจคัดลอกรายงานไปบันทึกในระบบของตน ถอนความยินยอมได้ที่หน้าประวัติ หลังถอนผู้ให้บริการจะเปิดข้อมูลสุขภาพชุดนี้ไม่ได้อีก แต่ข้อความสนทนาและบันทึกการปรึกษาจะยังอยู่จนกว่าคุณจะกดลบข้อมูลการปรึกษานั้น`}
        </CheckboxField>
        {submitError && (
          <p role="alert" className="text-base font-semibold text-red-700">
            {submitError} ข้อมูลที่กรอกยังอยู่ ลองส่งใหม่ได้
          </p>
        )}
        <div className="flex flex-col-reverse sm:flex-row gap-3">
          <Button variant="neutral" className="flex-1" disabled={busy} onClick={() => navigate('/consult/checkin')}>
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            แก้ไขคำตอบ
          </Button>
          <Button className="flex-1" disabled={busy} onClick={() => void submit()}>
            {busy ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> : <Send className="w-5 h-5" aria-hidden="true" />}
            {busy ? 'กำลังส่ง...' : 'ยืนยันและเริ่มปรึกษา'}
          </Button>
        </div>
      </Card>
      <ConsentDocumentModal open={docOpen} onClose={() => setDocOpen(false)} onAccept={acceptDocument} />
    </div>
  );
};
