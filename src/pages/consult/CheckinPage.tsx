import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Bot, FileText, FolderOpen, Mic, MicOff, Paperclip, Pencil, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CheckboxField } from '../../components/ui/CheckboxField';
import { Chip, FieldGroup, SingleChoiceChips } from '../../components/ui/ChoiceChips';
import { PageHeader } from '../../components/ui/PageHeader';
import { TextAreaField } from '../../components/ui/TextAreaField';
import { TextField } from '../../components/ui/TextField';
import { DateField } from '../../components/ui/DatePicker';
import { useToast } from '../../components/ui/Toast';
import { SeverityScale, Stepper } from '../../components/consult/ConsultUI';
import { findMissing, structureText } from '../../consult/assistant';
import { CONSULT_FILE_ACCEPT, deleteLocalFile, saveLocalFile } from '../../consult/files';
import { copyManyToConsult } from '../../consult/folderFiles';
import { FolderPickerModal } from '../../components/folders/FolderPickerModal';
import type { FolderDoc } from '../../lib/folders';
import { clearDraft, loadDraft, saveDraft } from '../../consult/hooks';
import {
  DESCRIBE_STARTERS,
  DURATIONS,
  FEELINGS,
  FEELING_LABEL,
  PATTERNS,
  PURPOSES,
  SYMPTOM_GROUPS,
  SYMPTOM_REQUIRED_PURPOSES,
  TREND_LABEL,
  purposeLabel,
  questionsFor,
  symptomLabels,
  type Question,
} from '../../consult/options';
import type { CheckinAnswers, Trend } from '../../consult/types';
import { loadMeds, todayKey } from '../../lib/meds';

type StepId = 'purpose' | 'symptoms' | 'severity' | 'details' | 'questions' | 'summary';
const STEP_TITLE: Record<StepId, string> = {
  purpose: 'เรื่องที่ต้องการปรึกษา',
  symptoms: 'อาการที่เป็นอยู่',
  severity: 'ความรุนแรงและความรู้สึก',
  details: 'รายละเอียดอาการ',
  questions: 'คำถามเพิ่มเติม',
  summary: 'ตรวจสอบก่อนยืนยัน',
};

type Errors = Record<string, string>;

function validate(step: StepId, a: CheckinAnswers, questions: Question[]): Errors {
  const e: Errors = {};
  if (step === 'purpose') {
    if (!a.purpose) e['ci-purpose'] = 'กรุณาเลือกเรื่องที่ต้องการปรึกษา';
    if (a.purpose === 'other' && !a.otherPurpose.trim()) e['ci-other-purpose'] = 'กรุณาระบุเรื่องที่ต้องการปรึกษา';
  }
  if (step === 'symptoms') {
    if (SYMPTOM_REQUIRED_PURPOSES.includes(a.purpose) && a.symptoms.length === 0) e['ci-symptoms'] = 'กรุณาเลือกอาการอย่างน้อย 1 อย่าง';
    if (a.symptoms.includes('other') && !a.otherSymptom.trim()) e['ci-other-symptom'] = 'กรุณาระบุอาการ';
  }
  if (step === 'severity' && a.symptoms.length > 0) {
    if (a.severity === null) e['severity'] = 'กรุณาเลือกระดับความรุนแรง';
    if (a.feelings.length === 0) e['ci-feelings'] = 'กรุณาเลือกความรู้สึกอย่างน้อย 1 อย่าง';
  }
  if (step === 'details') {
    if (!a.description.trim()) e['ci-description'] = 'กรุณาอธิบายอาการหรือคำถามของคุณ';
    if (a.startedOn && a.startedOn > todayKey()) e['ci-started'] = 'วันที่เริ่มเป็นต้องไม่อยู่ในอนาคต';
  }
  if (step === 'questions') {
    for (const q of questions) {
      const v = a.answers[q.id];
      if (q.required && (!v || v.length === 0)) e[`q-${q.id}`] = 'กรุณาตอบข้อนี้';
      if (q.kind === 'date' && typeof v === 'string' && v > todayKey()) e[`q-${q.id}`] = 'วันที่ต้องไม่อยู่ในอนาคต';
    }
  }
  return e;
}

const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

type SpeechCtor = new () => {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

/** พูดแทนพิมพ์ (ไม่บังคับ) แสดงเฉพาะเบราว์เซอร์ที่รองรับ */
const VoiceInput: React.FC<{ onText: (text: string) => void }> = ({ onText }) => {
  const toast = useToast();
  const [listening, setListening] = useState(false);
  const recRef = useRef<InstanceType<SpeechCtor> | null>(null);
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  useEffect(() => () => recRef.current?.stop(), []);
  if (!Ctor) return null;
  const start = () => {
    const rec = new Ctor();
    rec.lang = 'th-TH';
    rec.interimResults = false;
    rec.onresult = (e) => onText(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    rec.onerror = () => {
      setListening(false);
      toast.show('ใช้เสียงไม่สำเร็จ กรุณาพิมพ์แทน', { tone: 'error' });
    };
    recRef.current = rec;
    setListening(true);
    rec.start();
  };
  return (
    <div>
      <Button variant="soft" size="sm" onClick={() => (listening ? recRef.current?.stop() : start())}>
        {listening ? <MicOff className="w-5 h-5" aria-hidden="true" /> : <Mic className="w-5 h-5" aria-hidden="true" />}
        {listening ? 'หยุดฟัง' : 'พูดแทนพิมพ์'}
      </Button>
      <p className="mt-1 text-sm text-slate-600">เบราว์เซอร์อาจส่งเสียงไปแปลงเป็นข้อความที่เซิร์ฟเวอร์ของผู้ผลิตเบราว์เซอร์ ถ้าไม่ต้องการให้พิมพ์แทน</p>
    </div>
  );
};

/** Module 2: แบบสอบถามทีละขั้น */
export const CheckinPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [draft, setDraft] = useState(() => loadDraft());
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const medNames = useMemo(() => loadMeds().meds.map((m) => ({ value: m.name, label: m.name })), []);

  const answers = draft?.answers;
  const questions = useMemo(() => (answers ? questionsFor(answers) : []), [answers]);
  const steps = useMemo<StepId[]>(
    () => ['purpose', 'symptoms', 'severity', 'details', ...(questions.length ? (['questions'] as StepId[]) : []), 'summary'],
    [questions.length]
  );
  const step = steps[Math.min(stepIndex, steps.length - 1)];

  useEffect(() => {
    headingRef.current?.focus();
    window.scrollTo({ top: 0 });
  }, [step]);

  if (!draft || !answers) return <Navigate to="/consult" replace />;

  const update = (patch: Partial<CheckinAnswers>) => {
    const next = { ...draft, answers: { ...answers, ...patch } };
    setDraft(next);
    saveDraft(next);
  };
  const clear = (id: string) => setErrors((e) => {
    if (!e[id]) return e;
    const { [id]: _removed, ...rest } = e;
    return rest;
  });
  const setAnswer = (id: string, value: string | string[]) => {
    update({ answers: { ...answers.answers, [id]: value } });
    clear(`q-${id}`);
  };

  const goNext = () => {
    const found = validate(step, answers, questions);
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      document.getElementById(first)?.focus();
      return;
    }
    if (step === 'summary') {
      navigate('/consult/review');
      return;
    }
    setStepIndex((i) => i + 1);
  };

  const pickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const saved = await saveLocalFile(file);
      update({ attachments: [...answers.attachments, saved] });
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'แนบไฟล์ไม่สำเร็จ', { tone: 'error' });
    }
  };

  const [picking, setPicking] = useState(false);
  const attachFromFolders = async (docs: FolderDoc[]) => {
    setPicking(false);
    const { attached, problems } = await copyManyToConsult(docs);
    if (attached.length) update({ attachments: [...answers.attachments, ...attached] });
    if (problems.length) toast.show(problems[0], { tone: 'error' });
  };

  const hints = structureText(answers);
  const missing = findMissing(answers);
  const edit = (id: StepId) => setStepIndex(steps.indexOf(id));

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <PageHeader title="อัปเดตอาการก่อนปรึกษา" />
      <div ref={headingRef} tabIndex={-1} className="focus:outline-none">
        <Stepper current={steps.indexOf(step) + 1} total={steps.length} title={STEP_TITLE[step]} />
      </div>

      <Card className="space-y-6 p-5 sm:p-7">
          {step === 'purpose' && (
            <>
              <FieldGroup id="ci-purpose" label="ต้องการปรึกษาเรื่องอะไร" required error={errors['ci-purpose']}>
                <div className="flex flex-wrap gap-2">
                  {PURPOSES.map((p) => (
                    <Chip
                      key={p.value}
                      selected={answers.purpose === p.value}
                      onClick={() => {
                        update({ purpose: p.value });
                        clear('ci-purpose');
                      }}
                    >
                      {p.label}
                    </Chip>
                  ))}
                </div>
              </FieldGroup>
              {answers.purpose === 'other' && (
                <TextField id="ci-other-purpose" label="ระบุเรื่องที่ต้องการปรึกษา" value={answers.otherPurpose} error={errors['ci-other-purpose']} onChange={(e) => { update({ otherPurpose: e.target.value }); clear('ci-other-purpose'); }} />
              )}
            </>
          )}

          {step === 'symptoms' && (
            <>
              <div id="ci-symptoms" tabIndex={-1} className="space-y-4 focus:outline-none">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  อาการที่เป็นอยู่ <span className="font-normal text-slate-500">({SYMPTOM_REQUIRED_PURPOSES.includes(answers.purpose) ? 'จำเป็น' : 'ไม่บังคับ'} เลือกได้หลายข้อ)</span>
                </h2>
                {SYMPTOM_GROUPS.map((group) => (
                  <div key={group.title}>
                    <p className="mb-2 text-base font-semibold text-slate-600">{group.title}</p>
                    <div className="flex flex-wrap gap-2">
                      {group.items.map((item) => (
                        <Chip
                          key={item.value}
                          selected={answers.symptoms.includes(item.value)}
                          onClick={() => {
                            update({ symptoms: toggle(answers.symptoms, item.value) });
                            clear('ci-symptoms');
                          }}
                        >
                          {item.label}
                        </Chip>
                      ))}
                    </div>
                  </div>
                ))}
                {errors['ci-symptoms'] && (
                  <p role="alert" className="text-base font-semibold text-red-700">
                    {errors['ci-symptoms']}
                  </p>
                )}
              </div>
              {answers.symptoms.includes('other') && (
                <TextField id="ci-other-symptom" label="ระบุอาการอื่น" value={answers.otherSymptom} error={errors['ci-other-symptom']} onChange={(e) => { update({ otherSymptom: e.target.value }); clear('ci-other-symptom'); }} />
              )}
            </>
          )}

          {step === 'severity' && (
            <>
              <SeverityScale value={answers.severity} error={errors['severity']} onChange={(v) => { update({ severity: v }); clear('severity'); }} />
              <FieldGroup id="ci-feelings" label="ตอนนี้รู้สึกอย่างไร" hint="แยกจากความรุนแรงของอาการ เลือกได้หลายข้อ" required={answers.symptoms.length > 0} error={errors['ci-feelings']}>
                <div className="flex flex-wrap gap-2">
                  {FEELINGS.map((f) => (
                    <Chip
                      key={f.value}
                      selected={answers.feelings.includes(f.value)}
                      onClick={() => {
                        update({ feelings: toggle(answers.feelings, f.value) });
                        clear('ci-feelings');
                      }}
                    >
                      {f.label}
                    </Chip>
                  ))}
                </div>
              </FieldGroup>
            </>
          )}

          {step === 'details' && (
            <>
              <TextAreaField
                id="ci-description"
                label="อธิบายอาการหรือคำถามของคุณ"
                labelSuffix="(จำเป็น)"
                hint="เล่าด้วยคำของคุณเอง ยิ่งละเอียด เภสัชกรยิ่งช่วยได้ตรงจุด"
                rows={6}
                maxLength={4000}
                value={answers.description}
                error={errors['ci-description']}
                onChange={(e) => {
                  update({ description: e.target.value });
                  clear('ci-description');
                }}
              />
              <div className="flex flex-wrap gap-2">
                {DESCRIBE_STARTERS.map((s) => (
                  <Button
                    key={s}
                    variant="neutral"
                    size="sm"
                    onClick={() => {
                      update({ description: answers.description ? `${answers.description}\n${s}` : s });
                      clear('ci-description');
                      document.getElementById('ci-description')?.focus();
                    }}
                  >
                    {s.replace(': ', '')}
                  </Button>
                ))}
              </div>
              <VoiceInput onText={(t) => update({ description: answers.description ? `${answers.description} ${t}` : t })} />

              {(hints.symptoms.length > 0 || hints.duration) && (
                <div className="rounded-2xl border border-dashed border-purple-300 bg-purple-50/60 p-4 space-y-2">
                  <p className="flex items-center gap-2 text-base font-bold text-purple-900">
                    <Bot className="w-5 h-5 shrink-0" aria-hidden="true" />
                    ระบบพบคำเหล่านี้ในข้อความ กดเพื่อเพิ่มถ้าถูกต้อง
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {hints.symptoms.map((s) => (
                      <Button key={s.value} variant="soft" size="sm" onClick={() => update({ symptoms: [...answers.symptoms, s.value] })}>
                        อาการ: {s.label}
                      </Button>
                    ))}
                    {hints.duration && (
                      <Button variant="soft" size="sm" onClick={() => update({ duration: hints.duration! })}>
                        เป็นมา {hints.duration}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <TextField id="ci-location" label="เป็นที่ตรงไหน" labelSuffix="(ไม่บังคับ)" placeholder="เช่น ขมับซ้าย ท้องด้านขวาล่าง" value={answers.location} onChange={(e) => update({ location: e.target.value })} />
              <SingleChoiceChips id="ci-pattern" label="ลักษณะการเป็น" options={PATTERNS} value={answers.pattern} onChange={(v) => update({ pattern: v })} />
              <SingleChoiceChips id="ci-duration" label="เป็นมานานแค่ไหน" options={DURATIONS} value={DURATIONS.some((d) => d.value === answers.duration) ? answers.duration : ''} hint={answers.duration && !DURATIONS.some((d) => d.value === answers.duration) ? `ตอนนี้: ${answers.duration}` : undefined} onChange={(v) => update({ duration: v })} />
              <DateField id="ci-started" label="เริ่มเป็นเมื่อไร" labelSuffix="(ไม่บังคับ)" max={todayKey()} value={answers.startedOn} error={errors['ci-started']} onChange={(val) => { update({ startedOn: val }); clear('ci-started'); }} />
              <FieldGroup label="อาการดีขึ้นหรือแย่ลง">
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(TREND_LABEL) as Exclude<Trend, ''>[]).map((t) => (
                    <Chip key={t} selected={answers.trend === t} onClick={() => update({ trend: answers.trend === t ? '' : t })}>
                      {TREND_LABEL[t]}
                    </Chip>
                  ))}
                </div>
              </FieldGroup>
              <TextField id="ci-worse" label="อะไรทำให้แย่ลง" labelSuffix="(ไม่บังคับ)" value={answers.worseWith} onChange={(e) => update({ worseWith: e.target.value })} />
              <TextField id="ci-better" label="อะไรทำให้ดีขึ้น" labelSuffix="(ไม่บังคับ)" value={answers.betterWith} onChange={(e) => update({ betterWith: e.target.value })} />
              <TextField id="ci-previous-meds" label="ได้ลองใช้ยาอะไรไปแล้วบ้าง" labelSuffix="(ไม่บังคับ)" value={answers.previousMeds} onChange={(e) => update({ previousMeds: e.target.value })} />
              <TextField id="ci-additional" label="อาการอื่นที่เป็นร่วมด้วย" labelSuffix="(ไม่บังคับ)" value={answers.additionalSymptoms} onChange={(e) => update({ additionalSymptoms: e.target.value })} />

              <div className="space-y-2">
                <p className="text-base sm:text-lg font-bold text-slate-900">
                  แนบรูปหรือเอกสาร <span className="font-normal text-slate-500">(ไม่บังคับ)</span>
                </p>
                <p className="text-sm sm:text-base text-slate-600">ไฟล์จะอยู่ในเครื่องจนกว่าคุณจะยืนยันส่ง คนในบ้านไม่เห็น</p>
                <ul className="space-y-2">
                  {answers.attachments.map((a) => (
                    <li key={a.id} className="flex items-center gap-2 rounded-2xl border border-slate-200 p-2 pl-3">
                      <FileText className="w-5 h-5 shrink-0 text-purple-700" aria-hidden="true" />
                      <span className="flex-1 min-w-0 truncate font-medium">{a.name}</span>
                      <button
                        type="button"
                        aria-label={`เอา ${a.name} ออก`}
                        onClick={() => {
                          update({ attachments: answers.attachments.filter((x) => x.id !== a.id) });
                          void deleteLocalFile(a.id);
                        }}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-xl hover:bg-slate-100 cursor-pointer"
                      >
                        <X className="w-5 h-5" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
                <input ref={fileRef} type="file" accept={CONSULT_FILE_ACCEPT} className="sr-only" tabIndex={-1} aria-label="เลือกไฟล์" onChange={(e) => void pickFile(e)} />
                <div className="flex flex-wrap gap-2">
                  <Button variant="neutral" size="sm" onClick={() => fileRef.current?.click()}>
                    <Paperclip className="w-5 h-5" aria-hidden="true" />
                    แนบไฟล์
                  </Button>
                  <Button variant="soft" size="sm" onClick={() => setPicking(true)}>
                    <FolderOpen className="w-5 h-5" aria-hidden="true" />
                    เลือกจากโฟลเดอร์
                  </Button>
                </div>
                <FolderPickerModal open={picking} onClose={() => setPicking(false)} onConfirm={(docs) => void attachFromFolders(docs)} />
              </div>
            </>
          )}

          {step === 'questions' &&
            questions.map((q) => {
              const id = `q-${q.id}`;
              const value = answers.answers[q.id];
              if (q.kind === 'text') {
                return <TextField key={q.id} id={id} label={q.label} labelSuffix={q.required ? '(จำเป็น)' : '(ไม่บังคับ)'} hint={q.hint} value={(value as string) ?? ''} error={errors[id]} onChange={(e) => setAnswer(q.id, e.target.value)} />;
              }
              if (q.kind === 'med') {
                return <TextField key={q.id} id={id} label={q.label} labelSuffix="(จำเป็น)" hint="เลือกจากตู้ยาหรือพิมพ์ชื่อยา" suggestions={medNames} value={(value as string) ?? ''} error={errors[id]} onChange={(e) => setAnswer(q.id, e.target.value)} />;
              }
              if (q.kind === 'date') {
                return <DateField key={q.id} id={id} label={q.label} labelSuffix="(ไม่บังคับ)" max={todayKey()} value={(value as string) ?? ''} error={errors[id]} onChange={(val) => setAnswer(q.id, val)} />;
              }
              if (q.kind === 'single') {
                return (
                  <FieldGroup key={q.id} id={id} label={q.label} hint={q.hint} error={errors[id]}>
                    <div className="flex flex-wrap gap-2">
                      {q.options!.map((o) => (
                        <Chip key={o.value} selected={value === o.value} onClick={() => setAnswer(q.id, value === o.value ? '' : o.value)}>
                          {o.label}
                        </Chip>
                      ))}
                    </div>
                  </FieldGroup>
                );
              }
              const list = (value as string[]) ?? [];
              return (
                <FieldGroup key={q.id} id={id} label={q.label} hint={q.hint} error={errors[id]}>
                  <div className="space-y-2">
                    {q.options!.map((o) => (
                      <CheckboxField key={o.value} id={`${id}-${o.value}`} checked={list.includes(o.value)} onChange={() => setAnswer(q.id, toggle(list, o.value))}>
                        {o.label}
                      </CheckboxField>
                    ))}
                  </div>
                </FieldGroup>
              );
            })}

          {step === 'summary' && (
            <div className="space-y-4">
              <SummaryRow title="เรื่องที่ปรึกษา" onEdit={() => edit('purpose')}>{purposeLabel(answers)}</SummaryRow>
              <SummaryRow title="อาการ" onEdit={() => edit('symptoms')}>{symptomLabels(answers).join(', ') || 'ไม่ได้เลือก'}</SummaryRow>
              <SummaryRow title="ความรุนแรงและความรู้สึก" onEdit={() => edit('severity')}>
                {answers.severity !== null ? `${answers.severity}/10` : 'ไม่ระบุ'}
                {answers.feelings.length > 0 && ` · ${answers.feelings.map((f) => FEELING_LABEL[f]).join(', ')}`}
              </SummaryRow>
              <SummaryRow title="รายละเอียด" onEdit={() => edit('details')}>
                <span className="block whitespace-pre-wrap">{answers.description}</span>
                {answers.location && <span className="block">ตำแหน่ง: {answers.location}</span>}
                {answers.pattern && <span className="block">ลักษณะ: {answers.pattern}</span>}
                {answers.duration && <span className="block">เป็นมา {answers.duration}</span>}
                {answers.startedOn && <span className="block">เริ่มเมื่อ {answers.startedOn}</span>}
                {answers.trend && <span className="block">แนวโน้ม: {TREND_LABEL[answers.trend]}</span>}
                {answers.worseWith && <span className="block">ทำให้แย่ลง: {answers.worseWith}</span>}
                {answers.betterWith && <span className="block">ทำให้ดีขึ้น: {answers.betterWith}</span>}
                {answers.previousMeds && <span className="block">ยาที่ลองแล้ว: {answers.previousMeds}</span>}
                {answers.additionalSymptoms && <span className="block">อาการร่วม: {answers.additionalSymptoms}</span>}
                {answers.attachments.length > 0 && <span className="block">ไฟล์แนบ {answers.attachments.length} ไฟล์</span>}
              </SummaryRow>
              {questions.length > 0 && (
                <SummaryRow title="คำถามเพิ่มเติม" onEdit={() => edit('questions')}>
                  {questions.filter((q) => answers.answers[q.id]?.length).map((q) => {
                    const v = answers.answers[q.id];
                    const text = Array.isArray(v) ? v.map((x) => q.options?.find((o) => o.value === x)?.label ?? x).join(', ') : v;
                    return (
                      <span key={q.id} className="block">
                        {q.label}: {text}
                      </span>
                    );
                  })}
                </SummaryRow>
              )}

              {missing.length > 0 && (
                <div className="rounded-2xl border border-dashed border-purple-300 bg-purple-50/60 p-4">
                  <p className="flex items-center gap-2 text-base font-bold text-purple-900">
                    <Bot className="w-5 h-5 shrink-0" aria-hidden="true" />
                    ระบบตรวจพบว่ายังขาด (ไม่บังคับ ช่วยให้ร้านยาหรือคลินิกตอบได้ตรงขึ้น)
                  </p>
                  <ul className="mt-1 list-disc pl-6 text-base text-slate-800">
                    {missing.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
      </Card>

        <div className="flex gap-3">
          <Button
            variant="neutral"
            className="flex-1"
            onClick={() => {
              if (stepIndex === 0) {
                answers.attachments.forEach((a) => void deleteLocalFile(a.id));
                clearDraft();
                navigate('/consult');
              } else setStepIndex((i) => i - 1);
            }}
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            {stepIndex === 0 ? 'ยกเลิก' : 'ย้อนกลับ'}
          </Button>
          <Button className="flex-1" onClick={goNext}>
            {step === 'summary' ? 'ไปตรวจสอบข้อมูลที่จะส่ง' : 'ถัดไป'}
            <ArrowRight className="w-5 h-5" aria-hidden="true" />
          </Button>
        </div>
    </div>
  );
};

const SummaryRow: React.FC<{ title: string; onEdit: () => void; children: React.ReactNode }> = ({ title, onEdit, children }) => (
  <div className="rounded-2xl border border-slate-200 p-4">
    <div className="flex items-center justify-between gap-2 mb-1">
      <h3 className="text-base font-bold text-slate-600">{title}</h3>
      <button type="button" onClick={onEdit} aria-label={`แก้ไข${title}`} className="inline-flex min-h-[44px] items-center gap-1 rounded-xl px-3 text-base font-bold text-purple-800 hover:bg-purple-50 cursor-pointer">
        <Pencil className="w-4 h-4" aria-hidden="true" />
        แก้ไข
      </button>
    </div>
    <div className="text-base text-slate-900 break-words">{children}</div>
  </div>
);
