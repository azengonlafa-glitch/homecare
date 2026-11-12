import React, { useState } from 'react';
import { Gauge, HeartPulse, Smile, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { TextField } from '../ui/TextField';
import { TextAreaField } from '../ui/TextAreaField';
import { AttachmentPicker } from '../ui/AttachmentPicker';
import { Chip, FieldGroup } from '../ui/ChoiceChips';
import { MoodBadge } from './MoodPickerModal';
import { SYMPTOM_TITLE_SUGGESTIONS } from '../../data/suggestions';
import type { Attachment } from '../../lib/onboarding';
import type { MoodKey } from '../../data/journalOptions';
import { SYMPTOM_DESCRIPTIONS } from '../../data/symptomDescriptions';
import { draftHasValues, emptyVitalDraft, parseVitalDraft, vitalChips, type VitalDraft, type VitalValues } from '../../lib/dailyRecord';

export interface PostDraft {
  about: string;
  title: string;
  content: string;
  symptoms: string[];
  moodMain: MoodKey | null;
  moodDetails: string[];
  photo: Attachment | null;
  /** ค่าสุขภาพที่วัดได้ (ไม่บังคับ) */
  vitals: VitalDraft;
}

interface PostComposerModalProps {
  open: boolean;
  mode: 'new' | 'edit';
  draft: PostDraft;
  aboutOptions: string[];
  onChange: (patch: Partial<PostDraft>) => void;
  onOpenSymptoms: () => void;
  onOpenMood: () => void;
  onOpenVitals: () => void;
  onSubmit: (vitals: VitalValues | null) => void;
  onClose: () => void;
  /** ตรวจว่าบันทึกค่าสุขภาพให้คนนี้ได้ไหม คืนข้อความเมื่อทำไม่ได้ */
  vitalsBlockedFor?: (about: string) => string | null;
}

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

const ComposerDialog: React.FC<Omit<PostComposerModalProps, 'open'>> = ({
  mode,
  draft,
  aboutOptions,
  onChange,
  onOpenSymptoms,
  onOpenMood,
  onOpenVitals,
  onSubmit,
  onClose,
  vitalsBlockedFor,
}) => {
  const [error, setError] = useState('');
  const hasVitalInput = draftHasValues(draft.vitals);
  const parsedVitals = parseVitalDraft(draft.vitals);
  const chips = parsedVitals.ok && parsedVitals.values ? vitalChips(parsedVitals.values) : [];

  const isEmpty =
    !draft.title.trim() &&
    !draft.content.trim() &&
    draft.symptoms.length === 0 &&
    !draft.moodMain &&
    !draft.photo &&
    !hasVitalInput;

  const submit = () => {
    if (isEmpty) {
      setError('เขียนข้อความ หรือเลือกอาการ อารมณ์ รูปภาพ หรือกรอกค่าสุขภาพอย่างน้อยหนึ่งอย่างก่อนบันทึก');
      return;
    }
    if (!parsedVitals.ok) {
      setError(parsedVitals.error);
      return;
    }
    const blocked = parsedVitals.values ? vitalsBlockedFor?.(draft.about) : null;
    if (blocked) {
      setError(blocked);
      return;
    }
    onSubmit(parsedVitals.values);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === 'edit' ? 'แก้ไขบันทึกประจำวัน' : 'บันทึกประจำวัน'}
      initialFocusSelector="#jr-content"
      footer={
        <div className="space-y-2">
          {error && (
            <p role="alert" className="text-base font-semibold text-red-700">
              {error}
            </p>
          )}
          <Button type="button" fullWidth onClick={submit}>
            {mode === 'edit' ? 'บันทึกการแก้ไข' : 'บันทึก'}
          </Button>
        </div>
      }
    >
      <div className="py-6 space-y-7">
        <FieldGroup label="บันทึกของใคร">
          <div role="group" aria-label="บันทึกของใคร" className="flex flex-wrap gap-2">
            {aboutOptions.map((name) => (
              <Chip key={name} selected={draft.about === name} onClick={() => onChange({ about: name })}>
                {name}
              </Chip>
            ))}
          </div>
        </FieldGroup>

        <TextField
          id="jr-title"
          suggestions={SYMPTOM_TITLE_SUGGESTIONS}
          label="หัวข้อโพสต์"
          labelSuffix="(ไม่บังคับ)"
          autoComplete="off"
          placeholder="เช่น ปวดหัวตั้งแต่เช้า"
          value={draft.title}
          onChange={(e) => {
            onChange({ title: e.target.value });
            setError('');
          }}
        />

        <TextAreaField
          id="jr-content"
          label="เล่าอาการ"
          hint="เริ่มเมื่อไหร่ เป็นมากแค่ไหน กินยาอะไรไปแล้วบ้าง"
          rows={5}
          value={draft.content}
          onChange={(e) => {
            onChange({ content: e.target.value });
            setError('');
          }}
        />

        <FieldGroup label="อาการที่พบ">
          {draft.symptoms.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="อาการที่เลือกไว้">
              {draft.symptoms.map((item) => (
                <li
                  key={item}
                  title={SYMPTOM_DESCRIPTIONS[item]}
                  className="inline-flex items-center gap-1 pl-4 pr-1 min-h-[44px] rounded-full bg-red-50 border border-red-200 text-red-900 text-base font-semibold cursor-help"
                >
                  <span>{item}</span>
                  <button
                    type="button"
                    aria-label={`ลบอาการ ${item}`}
                    onClick={() => onChange({ symptoms: draft.symptoms.filter((s) => s !== item) })}
                    className="inline-flex items-center justify-center w-9 h-9 rounded-full hover:bg-red-100 cursor-pointer"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Button type="button" variant="soft" size="sm" onClick={onOpenSymptoms}>
            <HeartPulse className="w-5 h-5" aria-hidden="true" />
            <span>{draft.symptoms.length > 0 ? 'เพิ่มหรือแก้ไขอาการ' : 'เลือกอาการ'}</span>
          </Button>
        </FieldGroup>

        <FieldGroup label="ค่าสุขภาพที่วัดได้" hint="ไม่บังคับ · ค่าที่บันทึกจะขึ้นกราฟพัฒนาการในหน้าสมาชิก">
          {chips.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="ค่าสุขภาพที่กรอกไว้">
              {chips.map((c) => (
                <li key={c.key} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-sky-200 bg-sky-soft px-4 text-base text-sky-950">
                  <span className="font-semibold">{c.label}</span>
                  <span className="font-extrabold tabular-nums">{c.value}</span>
                </li>
              ))}
            </ul>
          )}
          {!parsedVitals.ok && (
            <p className="text-base font-semibold text-red-700">มีค่าที่ต้องตรวจสอบ: {parsedVitals.error}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="soft" size="sm" onClick={onOpenVitals}>
              <Gauge className="w-5 h-5" aria-hidden="true" />
              <span>{hasVitalInput ? 'เพิ่มหรือแก้ไขค่าสุขภาพ' : 'กรอกค่าสุขภาพ'}</span>
            </Button>
            {hasVitalInput && (
              <button
                type="button"
                onClick={() => onChange({ vitals: emptyVitalDraft() })}
                className="inline-flex items-center min-h-[44px] px-2 text-base font-semibold text-slate-600 hover:text-red-700 cursor-pointer"
              >
                ล้าง
              </button>
            )}
          </div>
        </FieldGroup>

        <FieldGroup label="อารมณ์ของวันนี้">
          {draft.moodMain && (
            <div className="flex flex-wrap items-center gap-2">
              <MoodBadge main={draft.moodMain} details={draft.moodDetails} />
              <button
                type="button"
                onClick={() => onChange({ moodMain: null, moodDetails: [] })}
                className="inline-flex items-center min-h-[44px] px-2 text-base font-semibold text-slate-600 hover:text-red-700 cursor-pointer"
              >
                ล้าง
              </button>
            </div>
          )}
          <Button type="button" variant="soft" size="sm" onClick={onOpenMood}>
            <Smile className="w-5 h-5" aria-hidden="true" />
            <span>{draft.moodMain ? 'เปลี่ยนอารมณ์' : 'เลือกอารมณ์'}</span>
          </Button>
        </FieldGroup>

        <FieldGroup label="รูปภาพ" hint="แนบได้ 1 รูป (JPEG, JPG, PNG ไม่เกิน 10 MB)">
          <AttachmentPicker
            id="jr-photo"
            value={draft.photo ? [draft.photo] : []}
            onChange={(files) => {
              onChange({ photo: files[0] ?? null });
              setError('');
            }}
            accept="image/jpeg,image/png"
            title="แนบรูปภาพ"
            maxFiles={1}
            maxBytes={MAX_PHOTO_BYTES}
            deferDelete
          />
        </FieldGroup>
      </div>
    </Modal>
  );
};

/** หน้าต่างรายละเอียดโพสต์: หัวข้อ เนื้อหา อาการ อารมณ์ และรูปภาพ */
export const PostComposerModal: React.FC<PostComposerModalProps> = ({ open, ...rest }) =>
  open ? <ComposerDialog {...rest} /> : null;
