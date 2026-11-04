import React, { useState } from 'react';
import { Paperclip, Plus, X } from 'lucide-react';
import { TextField } from '../ui/TextField';
import { TextAreaField } from '../ui/TextAreaField';
import { Button } from '../ui/Button';
import { CheckboxField } from '../ui/CheckboxField';
import { ChipsWithCustom } from '../ui/ChipsWithCustom';
import { ConditionPicker } from '../ui/ConditionPicker';
import { AttachmentList, AttachmentPicker } from '../ui/AttachmentPicker';
import { Chip, FieldGroup } from '../ui/ChoiceChips';
import { OTHER_ALLERGIES, SEVERITIES } from '../../data/onboardingOptions';
import {
  ALLERGY_SYMPTOM_SUGGESTIONS,
  DRUG_SUGGESTIONS,
  SUPPLEMENT_SUGGESTIONS,
} from '../../data/suggestions';
import { MEDICAL_CONDITIONS } from '../../data/medicalConditions';
import { deleteFiles } from '../../lib/fileStore';
import type { Attachment, DrugAllergy } from '../../lib/onboarding';
import type { StepProps } from './stepTypes';

const severityLabel = (value: DrugAllergy['severity']) =>
  SEVERITIES.find((s) => s.value === value)?.label ?? '';

/** ขั้นที่ 3: ประวัติการแพ้ */
export const StepAllergies: React.FC<StepProps> = ({ profile, update, errors, clearError }) => {
  const [drug, setDrug] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [severity, setSeverity] = useState<DrugAllergy['severity']>('moderate');
  const [files, setFiles] = useState<Attachment[]>([]);

  // เพิ่มได้เมื่อพิมพ์ชื่อยา หรือแนบไฟล์/รูปอย่างน้อย 1 ไฟล์
  const canAdd = drug.trim().length > 0 || files.length > 0;

  const addDrugAllergy = () => {
    if (!canAdd) return;
    clearError('ob-no-allergies');
    update({
      drugAllergies: [
        ...profile.drugAllergies,
        { drug: drug.trim(), symptoms: symptoms.trim(), severity, attachments: files },
      ],
    });
    setDrug('');
    setSymptoms('');
    setSeverity('moderate');
    setFiles([]);
  };

  const removeDrugAllergy = (index: number) => {
    void deleteFiles(profile.drugAllergies[index]?.attachments);
    update({ drugAllergies: profile.drugAllergies.filter((_, i) => i !== index) });
  };

  const handleNoAllergies = (checked: boolean) => {
    clearError('ob-no-allergies');
    if (checked) {
      // ติ๊ก "ไม่เคยแพ้" แล้วล้างรายการที่กรอกไว้ (รวมไฟล์แนบ) เพื่อไม่ให้ข้อมูลขัดแย้งกัน
      profile.drugAllergies.forEach((item) => void deleteFiles(item.attachments));
      void deleteFiles(files);
      setFiles([]);
      update({ noAllergies: true, drugAllergies: [], otherAllergies: [] });
    } else {
      update({ noAllergies: false });
    }
  };

  return (
    <div className="space-y-8">
      {!profile.noAllergies && (
        <>
          <FieldGroup
            label="แพ้ยา"
            hint="พิมพ์ชื่อยาที่แพ้ หรือแนบรูป/ไฟล์ เช่น บัตรแพ้ยา ใบรับรองแพทย์ รูปอาการ ก็ได้ ถ้าไม่เคยแพ้ยาให้เว้นไว้"
          >
            {profile.drugAllergies.length > 0 && (
              <ul className="space-y-2">
                {profile.drugAllergies.map((item, index) => (
                  <li
                    key={`${item.drug}-${index}`}
                    className="rounded-2xl bg-red-50 border border-red-200 p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-base text-red-950 min-w-0 break-words pt-1.5 pl-1">
                        <strong>{item.drug || 'ประวัติแพ้ยา (ไฟล์แนบ)'}</strong>
                        {item.symptoms && ` (${item.symptoms})`} · {severityLabel(item.severity)}
                      </span>
                      <button
                        type="button"
                        aria-label={`ลบประวัติแพ้ ${item.drug || 'ที่แนบไฟล์'}`}
                        onClick={() => removeDrugAllergy(index)}
                        className="inline-flex items-center justify-center w-11 h-11 shrink-0 rounded-full hover:bg-red-100 cursor-pointer"
                      >
                        <X className="w-5 h-5" aria-hidden="true" />
                      </button>
                    </div>
                    {item.attachments && item.attachments.length > 0 && (
                      <AttachmentList items={item.attachments} compact />
                    )}
                  </li>
                ))}
              </ul>
            )}

            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5 space-y-4">
              <p className="text-base font-bold text-slate-900">เพิ่มประวัติแพ้ยา</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <TextField
                  id="ob-drug-name"
                  suggestions={DRUG_SUGGESTIONS}
                  label="ชื่อยาหรือสารที่แพ้"
                  autoComplete="off"
                  placeholder="เช่น เพนิซิลลิน, ซัลฟา"
                  value={drug}
                  onChange={(e) => setDrug(e.target.value)}
                />
                <TextField
                  id="ob-drug-symptoms"
                  suggestions={ALLERGY_SYMPTOM_SUGGESTIONS}
                  suggestMode="list"
                  label="อาการที่เคยเป็น"
                  autoComplete="off"
                  placeholder="เช่น ผื่น, ปากบวม"
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                />
              </div>

              <div role="group" aria-label="ความรุนแรงของอาการแพ้" className="flex flex-wrap gap-2">
                {SEVERITIES.map((option) => (
                  <Chip
                    key={option.value}
                    selected={severity === option.value}
                    onClick={() => setSeverity(option.value as DrugAllergy['severity'])}
                  >
                    {option.label}
                  </Chip>
                ))}
              </div>

              <div>
                <p className="flex items-center gap-2 text-base font-bold text-slate-900 mb-2">
                  <Paperclip className="w-5 h-5 text-purple-700" aria-hidden="true" />
                  แนบรูปหรือไฟล์ <span className="font-normal text-slate-500">(ไม่บังคับ)</span>
                </p>
                <AttachmentPicker
                  id="ob-drug-files"
                  value={files}
                  onChange={setFiles}
                  title="แนบรูปหรือไฟล์ประวัติแพ้ยา"
                />
              </div>

              <div className="space-y-2">
                <Button type="button" variant="soft" size="sm" onClick={addDrugAllergy} disabled={!canAdd}>
                  <Plus className="w-5 h-5" aria-hidden="true" />
                  <span>เพิ่มประวัติแพ้ยา</span>
                </Button>
                {!canAdd && (
                  <p className="text-sm text-slate-600">
                    พิมพ์ชื่อยาที่แพ้ หรือแนบรูป/ไฟล์ก่อน จึงจะเพิ่มได้
                  </p>
                )}
              </div>
            </div>
          </FieldGroup>

          <ChipsWithCustom
            id="ob-other-allergy"
            label="แพ้อาหารและสิ่งอื่น ๆ"
            options={OTHER_ALLERGIES}
            value={profile.otherAllergies}
            onChange={(v) => {
              update({ otherAllergies: v });
              clearError('ob-no-allergies');
            }}
            customPlaceholder="พิมพ์สิ่งที่แพ้อื่น ๆ"
          />
        </>
      )}

      <CheckboxField
        id="ob-no-allergies"
        checked={profile.noAllergies}
        onChange={handleNoAllergies}
        error={errors['ob-no-allergies']}
      >
        ฉันไม่เคยแพ้ยา อาหาร หรือสิ่งใดเลย
      </CheckboxField>
    </div>
  );
};

/** ขั้นที่ 4: โรคและยาที่ใช้ */
export const StepConditions: React.FC<StepProps> = ({ profile, update, errors, clearError }) => (
  <div className="space-y-8">
    <div className="space-y-4">
      <ConditionPicker
        id="ob-condition"
        label="โรคประจำตัวหรือโรคที่เป็นอยู่"
        hint="กดเลือกจากรายการโรค ค้นหาได้ ติ๊กได้หลายโรค ถ้าไม่มีในรายการพิมพ์เพิ่มเองได้"
        modalTitle="เลือกโรคประจำตัว"
        options={MEDICAL_CONDITIONS}
        value={profile.conditions}
        onChange={(v) => {
          update({ conditions: v });
          clearError('ob-no-conditions');
        }}
        disabled={profile.noConditions}
      />
      <CheckboxField
        id="ob-no-conditions"
        checked={profile.noConditions}
        error={errors['ob-no-conditions']}
        onChange={(checked) => {
          clearError('ob-no-conditions');
          update(checked ? { noConditions: true, conditions: [] } : { noConditions: false });
        }}
      >
        ฉันไม่มีโรคประจำตัว
      </CheckboxField>
    </div>

    <ChipsWithCustom
      id="ob-current-med"
      suggestions={DRUG_SUGGESTIONS}
      label="ยาที่ใช้อยู่ตอนนี้"
      hint="ยังไม่มียาที่ใช้ประจำ รวมถึงยาที่ซื้อเองและยาทาหรือพ่น"
      options={[]}
      value={profile.currentMeds}
      onChange={(v) => update({ currentMeds: v })}
      customPlaceholder="ชื่อยาและขนาด เช่น Amlodipine 5 mg"
      footer={'อยากให้ระบบเตือนเวลากินยาและยาใกล้หมด เพิ่มได้ในเมนู "ตู้ยา" ภายหลัง'}
    />

    <TextField
      id="ob-supplements"
      suggestions={SUPPLEMENT_SUGGESTIONS}
      suggestMode="list"
      label="วิตามิน อาหารเสริม และสมุนไพรที่กินเป็นประจำ"
      autoComplete="off"
      placeholder="เช่น วิตามินซี น้ำมันปลา ขมิ้นชัน"
      value={profile.supplements}
      onChange={(e) => update({ supplements: e.target.value })}
    />

    <TextAreaField
      id="ob-surgery"
      label="เคยผ่าตัดหรือนอนโรงพยาบาลด้วยเรื่องอะไร"
      hint="ระบุเรื่องและปีโดยย่อ เช่น ผ่าตัดไส้ติ่ง 2560"
      value={profile.surgeryHistory}
      onChange={(e) => update({ surgeryHistory: e.target.value })}
    />

    <TextAreaField
      id="ob-pharmacist-note"
      label="หมายเหตุอื่นถึงเภสัชกร"
      hint="เช่น กลืนยาเม็ดใหญ่ลำบาก ใช้ยาแล้วง่วงมาก ไม่ชอบรสยาน้ำบางชนิด"
      value={profile.pharmacistNote}
      onChange={(e) => update({ pharmacistNote: e.target.value })}
    />
  </div>
);

/** ขั้นที่ 5: ประวัติครอบครัว */
export const StepFamily: React.FC<StepProps> = ({ profile, update }) => (
  <ConditionPicker
    id="ob-family"
    label="โรคที่พ่อ แม่ พี่น้อง หรือปู่ย่าตายายเคยเป็น"
    hint="บางโรคมีแนวโน้มเป็นในครอบครัว ใช้ประกอบการแนะนำเท่านั้น กดเลือกจากรายการโรค ค้นหาได้ ติ๊กได้หลายโรค"
    modalTitle="เลือกโรคในครอบครัว"
    options={MEDICAL_CONDITIONS}
    value={profile.familyHistory}
    onChange={(v) => update({ familyHistory: v })}
  />
);
