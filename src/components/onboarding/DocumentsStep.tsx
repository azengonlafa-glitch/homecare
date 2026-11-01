import React from 'react';
import { Info } from 'lucide-react';
import { AttachmentPicker } from '../ui/AttachmentPicker';
import { FieldGroup } from '../ui/ChoiceChips';
import { TextAreaField } from '../ui/TextAreaField';
import type { StepProps } from './stepTypes';

/** ขั้นที่ 7: เอกสารทางการแพทย์และข้อมูลอื่น ๆ (ไม่บังคับ แนบหรือพิมพ์อะไรก็ได้) */
export const StepDocuments: React.FC<StepProps> = ({ profile, update }) => (
  <div className="space-y-8">
    <p className="flex items-start gap-2 rounded-2xl bg-purple-50 border border-purple-200 p-4 text-base text-purple-950 leading-snug">
      <Info className="w-5 h-5 mt-0.5 shrink-0" aria-hidden="true" />
      <span>ขั้นตอนนี้ไม่บังคับ ข้ามไปได้เลย และกลับมาเพิ่มภายหลังได้</span>
    </p>

    <FieldGroup
      label="เอกสารและผลตรวจ"
      hint="แนบอะไรก็ได้ที่เป็นข้อมูลสุขภาพของคุณ เช่น ผลตรวจเลือด ผลเอกซเรย์ ผลวินิจฉัย ใบรับรองแพทย์ สมุดวัคซีน ใบสั่งยา ประวัติการรักษา ทั้งรูปภาพ PDF หรือไฟล์เอกสาร แนบได้หลายไฟล์"
    >
      <AttachmentPicker
        id="ob-medical-docs"
        value={profile.medicalDocs}
        onChange={(v) => update({ medicalDocs: v })}
        title="เพิ่มเอกสารหรือรูปภาพ"
      />
    </FieldGroup>

    <TextAreaField
      id="ob-medical-notes"
      label="บันทึกข้อมูลทางการแพทย์อื่น ๆ"
      labelSuffix="(ไม่บังคับ)"
      hint="พิมพ์อะไรก็ได้ที่อยากบันทึกไว้ เช่น ค่าน้ำตาลหรือความดันล่าสุด ผลตรวจที่แพทย์แจ้ง วัคซีนที่เคยฉีด คำแนะนำจากแพทย์"
      rows={6}
      value={profile.medicalNotes}
      onChange={(e) => update({ medicalNotes: e.target.value })}
    />
  </div>
);
