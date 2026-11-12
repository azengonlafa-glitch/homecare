import React from 'react';
import { Activity, AlertTriangle, Bot, ClipboardCopy, FileText, HeartPulse, History, MessageCircleQuestion, NotebookPen, Pill, Stethoscope, UserRound } from 'lucide-react';
import { DIRECTION_LABEL, briefToText } from '../../consult/brief';
import { TREND_LABEL } from '../../consult/options';
import type { PatientBrief } from '../../consult/types';
import type { Attachment } from '../../lib/onboarding';
import { copyToClipboard } from '../../lib/clipboard';
import { cn } from '../../lib/cn';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { AttachmentLinks } from './ChatPanel';

const fmt = (iso: string) => new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('th-TH', { dateStyle: 'medium' });

const JUMPS = [
  { id: 'brief-allergy', label: 'แพ้ยา' },
  { id: 'brief-symptoms', label: 'อาการ' },
  { id: 'brief-meds', label: 'ยา' },
  { id: 'brief-patient', label: 'ผู้ป่วย' },
  { id: 'brief-history', label: 'ประวัติ' },
  { id: 'brief-previous', label: 'ครั้งก่อน' },
];

const Section: React.FC<{ id?: string; icon: React.ElementType; title: string; tone?: 'danger'; children: React.ReactNode }> = ({ id, icon: Icon, title, tone, children }) => (
  <section id={id} className={cn('scroll-mt-24 rounded-2xl border p-4 space-y-2', tone === 'danger' ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white')}>
    <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
      <Icon className={cn('w-5 h-5 shrink-0', tone === 'danger' ? 'text-red-700' : 'text-purple-700')} aria-hidden="true" />
      {title}
    </h3>
    <div className="text-base text-slate-800 space-y-1.5 break-words">{children}</div>
  </section>
);

/** แถวข้อมูล required = แสดง "ไม่ได้ระบุ" ให้เภสัชกรรู้ว่าไม่มีข้อมูล ไม่ใช่ระบบตัดออก */
const Line: React.FC<{ label: string; value?: React.ReactNode; required?: boolean }> = ({ label, value, required }) => {
  const empty = value === undefined || value === null || value === '';
  if (empty && !required) return null;
  return (
    <p className="whitespace-pre-wrap">
      <span className="font-semibold text-slate-600">{label}: </span>
      {empty ? <span className="text-slate-500">ไม่ได้ระบุ</span> : value}
    </p>
  );
};

const NoData: React.FC<{ text?: string }> = ({ text = 'ไม่มีข้อมูล' }) => <p className="text-slate-500">{text}</p>;

const Files: React.FC<{ sessionId?: string; items?: Attachment[] }> = ({ sessionId, items }) => {
  if (!items?.length) return null;
  if (sessionId) return <AttachmentLinks sessionId={sessionId} items={items} />;
  // หน้าตรวจสอบก่อนส่ง: ยังไม่มีการปรึกษา จึงแสดงชื่อไฟล์ที่จะส่ง
  return (
    <ul className="space-y-1">
      {items.map((a) => (
        <li key={a.id} className="flex items-center gap-2 font-medium">
          <FileText className="w-5 h-5 shrink-0 text-purple-700" aria-hidden="true" />
          <span className="min-w-0 break-all">{a.name}</span>
        </li>
      ))}
    </ul>
  );
};

/**
 * รายงานผู้ป่วยแบบเต็ม จัดลำดับตามสิ่งที่เภสัชกรต้องรู้ก่อน: แพ้ยา อาการล่าสุด ยาที่ใช้ แล้วจึงประวัติ
 * ข้อมูลที่ผู้ใช้รายงานแยกจากผลของระบบเสมอ
 */
export const BriefView: React.FC<{ brief: PatientBrief; sessionId?: string; audience: 'patient' | 'staff'; onAsk?: (question: string) => void }> = ({ brief, sessionId, audience, onAsk }) => {
  const toast = useToast();
  const { overview, lifestyle, history, allergies, medications, pastMedications, symptoms, recentLogs, previous, changes, medContext, assistant } = brief;

  const copy = async () => {
    const ok = await copyToClipboard(briefToText(brief));
    toast.show(ok ? 'คัดลอกรายงานแล้ว' : 'คัดลอกไม่สำเร็จ', { tone: ok ? 'success' : 'error' });
  };

  return (
    <div className="space-y-3">
      {audience === 'staff' && (
        <Button variant="neutral" size="sm" fullWidth onClick={() => void copy()}>
          <ClipboardCopy className="w-5 h-5" aria-hidden="true" />
          คัดลอกรายงานทั้งหมด
        </Button>
      )}
      {audience === 'staff' && (
        <nav aria-label="ไปยังหัวข้อในรายงาน" className="flex flex-wrap gap-1.5">
          {JUMPS.map((j) => (
            <button key={j.id} type="button" onClick={() => document.getElementById(j.id)?.scrollIntoView({ block: 'start' })} className="min-h-[44px] rounded-full border border-slate-300 bg-white px-3.5 text-sm font-bold text-slate-800 hover:bg-purple-50 cursor-pointer">
              {j.label}
            </button>
          ))}
        </nav>
      )}

      <Section id="brief-allergy" icon={AlertTriangle} title="ประวัติแพ้ยา" tone={allergies?.drugs.length ? 'danger' : undefined}>
        {!allergies ? (
          <NoData />
        ) : allergies.drugs.length === 0 && allergies.other.length === 0 ? (
          <NoData text={allergies.noAllergies ? 'ผู้ใช้ยืนยันว่าไม่เคยแพ้' : 'ไม่ได้ระบุ'} />
        ) : (
          <>
            {allergies.drugs.map((d, i) => (
              <div key={i}>
                <p>
                  <strong>{d.drug}</strong>
                  {d.symptoms && ` · ${d.symptoms}`}
                  {d.severity && ` · ${d.severity}`}
                </p>
                <Files sessionId={sessionId} items={d.attachments} />
              </div>
            ))}
            <Line label="แพ้อื่น ๆ" value={allergies.other.join(', ')} />
          </>
        )}
      </Section>

      <Section id="brief-symptoms" icon={Stethoscope} title="อาการล่าสุด (ผู้ใช้รายงาน)">
        {symptoms ? (
          <>
            <p className="text-sm text-slate-500">บันทึกเมื่อ {fmt(symptoms.recordedAt)}</p>
            <Line label="เรื่องที่ปรึกษา" value={symptoms.purpose} required />
            <Line label="อาการ" value={symptoms.symptoms.join(', ')} required />
            <Line label="คำอธิบาย" value={symptoms.description} required />
            <Line label="ความรุนแรง" value={symptoms.severity !== null ? `${symptoms.severity}/10` : ''} required />
            <Line label="ความรู้สึก" value={symptoms.feelings.join(', ')} />
            <Line label="ตำแหน่ง" value={symptoms.location} />
            <Line label="ลักษณะการเป็น" value={symptoms.pattern} />
            <Line label="ระยะเวลา" value={symptoms.duration} required />
            <Line label="เริ่มเมื่อ" value={symptoms.startedOn} required />
            <Line label="แนวโน้ม" value={symptoms.trend ? TREND_LABEL[symptoms.trend] : ''} required />
            <Line label="ทำให้แย่ลง" value={symptoms.worseWith} />
            <Line label="ทำให้ดีขึ้น" value={symptoms.betterWith} />
            <Line label="ยาที่ลองใช้แล้ว" value={symptoms.previousMeds} required />
            <Line label="อาการร่วม" value={symptoms.additionalSymptoms} />
            {symptoms.answers.map((a) => (
              <Line key={a.question} label={a.question} value={a.answer} />
            ))}
            <Files sessionId={sessionId} items={symptoms.attachments} />
          </>
        ) : (
          <NoData />
        )}
      </Section>

      {changes && (
        <Section icon={History} title="การเปลี่ยนแปลงจากครั้งก่อน">
          <Line label="ครั้งก่อน" value={fmtDate(changes.previousDate)} />
          <Line label="ความรุนแรงครั้งก่อน" value={changes.previousSeverity !== null ? `${changes.previousSeverity}/10` : 'ไม่ระบุ'} />
          <Line label="ความรุนแรงครั้งนี้" value={changes.currentSeverity !== null ? `${changes.currentSeverity}/10` : 'ไม่ระบุ'} />
          <p className="font-semibold">{DIRECTION_LABEL[changes.direction]}</p>
          <Line label="อาการครั้งก่อน" value={changes.previousSymptoms.join(', ')} />
          <Line label="อาการที่เพิ่งแจ้งครั้งนี้" value={changes.newSymptoms.join(', ')} />
        </Section>
      )}

      <Section id="brief-meds" icon={Pill} title={`ยาที่ใช้อยู่${medications?.length ? ` (${medications.length})` : ''}`}>
        {!medications?.length ? (
          <NoData text="ไม่มีรายการยา" />
        ) : (
          <ul className="space-y-3">
            {medications.map((m, i) => (
              <li key={i} className="space-y-0.5">
                <p>
                  <strong>{m.name}</strong>
                  {m.source === 'profile' && <span className="text-slate-500"> (แจ้งไว้ในข้อมูลสุขภาพ ไม่มีรายละเอียดขนาดยา)</span>}
                </p>
                <Line label="รูปแบบ" value={m.form} />
                <Line label="ขนาด" value={m.dose} />
                <Line label="ความถี่" value={m.schedule} />
                <Line label="เวลา" value={m.times} />
                <Line label="เริ่มใช้" value={m.startDate} />
                <Line label="ใช้สำหรับ" value={[m.condition, m.reason].filter(Boolean).join(' · ')} />
                <Line label="การกินยา 30 วัน" value={m.adherence} />
                <Line label="เหตุผลที่ไม่ได้กิน" value={m.missedReasons} />
                <Line label="คงเหลือ" value={m.remaining} />
                <Line label="หมดอายุ" value={m.expiryDate} />
                <Line label="หมายเหตุ" value={m.note} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {!!pastMedications?.length && (
        <Section icon={Pill} title="ยาที่หยุดใช้แล้ว">
          <ul className="space-y-2">
            {pastMedications.map((m, i) => (
              <li key={i}>
                <strong>{m.name}</strong>
                {m.dose && <span className="block">{m.dose}</span>}
                {m.period && <span className="block text-slate-700">{m.period}</span>}
                {m.note && <span className="block text-slate-700">{m.note}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {medContext && (
        <Section icon={Pill} title="ข้อมูลยาที่ควรตรวจสอบ">
          <ul className="list-disc pl-5">
            {medContext.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="text-sm text-slate-600">เป็นข้อเท็จจริงจากบันทึก ไม่ได้สรุปว่ายาเป็นสาเหตุของอาการ</p>
        </Section>
      )}

      <Section id="brief-patient" icon={UserRound} title="ข้อมูลผู้ป่วย">
        {overview ? (
          <>
            <Line label="ชื่อ" value={overview.name} required />
            <Line label="อายุ" value={overview.age !== null ? `${overview.age} ปี` : ''} required />
            <Line label="วันเกิด" value={overview.birthDate} />
            <Line label="เพศ" value={overview.gender} required />
            <Line label="น้ำหนัก" value={overview.weightKg ? `${overview.weightKg} กก.` : ''} required />
            <Line label="ส่วนสูง" value={overview.heightCm ? `${overview.heightCm} ซม.` : ''} />
            <Line label="กรุ๊ปเลือด" value={overview.bloodType} />
            <Line label="อาชีพ" value={overview.occupation} />
          </>
        ) : (
          <NoData />
        )}
      </Section>

      {lifestyle && (
        <Section icon={Activity} title="ค่าตรวจและการใช้ชีวิต">
          <Line label="ความดันล่าสุด" value={lifestyle.systolic || lifestyle.diastolic ? `${lifestyle.systolic || '-'}/${lifestyle.diastolic || '-'} mmHg` : ''} />
          <Line label="น้ำตาลตอนอดอาหาร" value={lifestyle.fastingGlucose ? `${lifestyle.fastingGlucose} mg/dL` : ''} />
          <Line label="บุหรี่" value={lifestyle.smoking} />
          <Line label="แอลกอฮอล์" value={lifestyle.alcohol} />
          <Line label="ออกกำลังกาย" value={lifestyle.exercise} />
        </Section>
      )}

      <Section id="brief-history" icon={HeartPulse} title="ประวัติสุขภาพ">
        {!history ? (
          <NoData />
        ) : (
          <>
            <Line label="โรคประจำตัว" value={history.conditions.join(', ') || (history.noConditions ? 'ไม่มี' : '')} required />
            <Line label="การผ่าตัด/การรักษา" value={history.surgeryHistory} />
            <Line label="ประวัติครอบครัว" value={history.familyHistory.join(', ')} />
            <Line label="อาหารเสริม" value={history.supplements} />
            <Line label="หมายเหตุถึงเภสัชกร" value={history.notes} />
            <Line label="บันทึกทางการแพทย์" value={history.medicalNotes} />
            <Files sessionId={sessionId} items={history.medicalDocs} />
          </>
        )}
      </Section>

      {!!recentLogs?.length && (
        <Section icon={NotebookPen} title="บันทึกอาการ 30 วันล่าสุด">
          <ul className="space-y-2">
            {recentLogs.map((log, i) => (
              <li key={i}>
                <strong>{fmtDate(log.date)}</strong>
                {log.title && ` · ${log.title}`}
                {log.symptoms.length > 0 && <span className="block">อาการ: {log.symptoms.join(', ')}</span>}
                {log.mood && <span className="block">ความรู้สึก: {log.mood}</span>}
                {log.content && <span className="block whitespace-pre-wrap text-slate-700">{log.content}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section id="brief-previous" icon={History} title="การปรึกษาครั้งก่อน">
        {!previous?.length ? (
          <NoData text="ยังไม่เคยปรึกษา" />
        ) : (
          <ul className="space-y-3">
            {previous.map((p, i) => (
              <li key={i}>
                <strong>{fmtDate(p.date)}</strong> · {p.providerName} · {p.topic}
                {p.severity !== null && ` · ${p.severity}/10`}
                {p.assessment && <span className="block text-slate-700">การประเมิน: {p.assessment}</span>}
                {p.advice && <span className="block text-slate-700">คำแนะนำ: {p.advice}</span>}
                {p.referral && <span className="block text-slate-700">การส่งต่อ: {p.referral}</span>}
                {p.followUpPlan && <span className="block text-slate-700">แผนติดตาม: {p.followUpPlan}</span>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* ผลจากระบบ แยกกรอบและบอกที่มาเสมอ */}
      <section className="rounded-2xl border border-dashed border-purple-300 bg-purple-50/60 p-4 space-y-2">
        <h3 className="flex items-center gap-2 text-lg font-bold text-purple-900">
          <Bot className="w-5 h-5 shrink-0" aria-hidden="true" />
          จัดโดยระบบ ไม่ใช่ข้อมูลที่ผู้ใช้รายงาน
        </h3>
        <p className="text-sm text-purple-900">สรุปจากข้อมูลที่กรอกไว้ ไม่ได้ใช้ AI และไม่ใช่การวินิจฉัย {audience === 'staff' ? 'กรุณาตรวจกับข้อมูลด้านบน' : 'ตรวจกับข้อมูลด้านบนได้'}</p>
        <p className="text-base text-slate-800 break-words">{assistant.summary}</p>
        {assistant.missing.length > 0 && (
          <div className="text-base text-slate-800 space-y-1.5">
            <p className="font-semibold">ข้อมูลที่ยังขาด{onAsk ? ' กดเพื่อถามผู้ป่วย' : ''}:</p>
            {onAsk ? (
              <div className="flex flex-col gap-2">
                {assistant.missing.map((m) => (
                  <button key={m} type="button" onClick={() => onAsk(`ขอทราบเพิ่มเติม: ${m}`)} className="flex min-h-[48px] items-center gap-2 rounded-xl border border-purple-200 bg-white px-3 py-2 text-left font-medium text-purple-950 hover:bg-purple-100 cursor-pointer">
                    <MessageCircleQuestion className="w-5 h-5 shrink-0" aria-hidden="true" />
                    {m}
                  </button>
                ))}
              </div>
            ) : (
              <ul className="list-disc pl-5">
                {assistant.missing.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
