import React, { useState } from 'react';
import { CheckCircle2, Crosshair, FileText } from 'lucide-react';
import { TextField } from '../ui/TextField';
import { TextAreaField } from '../ui/TextAreaField';
import { Button } from '../ui/Button';
import { FieldGroup } from '../ui/ChoiceChips';
import { ConsentDocumentModal } from './ConsentDocumentModal';
import { CheckboxField } from '../ui/CheckboxField';
import { CURRENT_MEMBER_ID } from '../../lib/settings';
import { loadMemberRecord, saveMemberRecord } from '../../lib/members';
import { CONSENT_VERSION } from '../../data/consentDocument';
import { RELATION_SUGGESTIONS } from '../../data/suggestions';
import type { StepProps } from './stepTypes';

/** ขั้นที่ 6: ติดต่อและที่อยู่ */
export const StepContact: React.FC<StepProps> = ({ profile, update, errors, clearError }) => {
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');

  const pinCurrentLocation = () => {
    setLocationError('');
    if (!('geolocation' in navigator)) {
      setLocationError('เบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        update({
          lat: Number(position.coords.latitude.toFixed(4)),
          lng: Number(position.coords.longitude.toFixed(4)),
        });
        setLocating(false);
      },
      (error) => {
        setLocating(false);
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? 'ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง กรุณาอนุญาตในการตั้งค่าเบราว์เซอร์แล้วลองใหม่'
            : 'ระบุตำแหน่งไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-6">
      <FieldGroup label="ผู้ติดต่อฉุกเฉิน" required hint="ใช้เมื่อเกิดเหตุฉุกเฉินเท่านั้น ต้องกรอกชื่อและเบอร์โทร">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField
            id="ob-emergency-name"
            label="ชื่อผู้ติดต่อฉุกเฉิน"
            hideLabel
            autoComplete="off"
            placeholder="ชื่อ"
            value={profile.emergencyName}
            onChange={(e) => {
              update({ emergencyName: e.target.value });
              clearError('ob-emergency-name');
            }}
            error={errors['ob-emergency-name']}
          />
          <TextField
            id="ob-emergency-phone"
            type="tel"
            label="เบอร์โทรผู้ติดต่อฉุกเฉิน"
            hideLabel
            inputMode="tel"
            autoComplete="off"
            placeholder="เบอร์โทร"
            value={profile.emergencyPhone}
            onChange={(e) => {
              update({ emergencyPhone: e.target.value });
              clearError('ob-emergency-phone');
            }}
            error={errors['ob-emergency-phone']}
          />
        </div>
        <TextField
          id="ob-emergency-relation"
          suggestions={RELATION_SUGGESTIONS}
          label="ความสัมพันธ์กับผู้ติดต่อฉุกเฉิน"
          hideLabel
          autoComplete="off"
          placeholder="ความสัมพันธ์ เช่น ลูกสาว คู่สมรส"
          value={profile.emergencyRelation}
          onChange={(e) => update({ emergencyRelation: e.target.value })}
        />
      </FieldGroup>

      <TextAreaField
        id="ob-address"
        name="street-address"
        autoComplete="street-address"
        label="ที่อยู่จัดส่ง"
        labelSuffix="(จำเป็น)"
        hint="ใช้เป็นที่อยู่จัดส่งและจุดอ้างอิงตำแหน่งบ้านของคุณ"
        value={profile.address}
        onChange={(e) => {
          update({ address: e.target.value });
          clearError('ob-address');
        }}
        error={errors['ob-address']}
      />

      <div className="space-y-2">
        <Button
          type="button"
          variant="soft"
          size="sm"
          fullWidth
          onClick={pinCurrentLocation}
          disabled={locating}
        >
          <Crosshair className="w-5 h-5" aria-hidden="true" />
          <span>{locating ? 'กำลังระบุตำแหน่ง…' : 'ปักหมุดบ้านที่ตำแหน่งปัจจุบัน'}</span>
        </Button>
        {profile.lat !== null && profile.lng !== null && (
          <p className="text-sm text-slate-600" role="status">
            พิกัดที่ใช้อยู่: {profile.lat}, {profile.lng}
          </p>
        )}
        {locationError && (
          <p role="alert" className="text-base font-semibold text-red-700">
            {locationError}
          </p>
        )}
      </div>
    </div>
  );
};

const SUMMARY_POINTS = [
  'เราขอเก็บและใช้ข้อมูลสุขภาพที่คุณกรอกเพื่อช่วยดูแลเรื่องยาและบันทึกอาการ (ข้อ 4 ก) จำเป็นต่อการใช้แอป',
  'การแสดงข้อมูลให้สมาชิกบ้านที่คุณเชิญเป็นทางเลือก เลือกด้านล่างได้ ไม่เลือกก็ใช้แอปได้',
  'การปรึกษาเภสัชกรหรือคลินิกขอความยินยอมแยกทุกครั้ง ก่อนส่ง คุณจะเห็นข้อมูลทั้งหมดที่ส่ง และไม่ส่งเบอร์โทร ที่อยู่ และผู้ติดต่อฉุกเฉิน',
  'คุณดาวน์โหลดสำเนาข้อมูล ถอนความยินยอม หรือลบบัญชีได้เองที่ ตั้งค่า › ข้อมูลและความยินยอมของฉัน',
];

const formatThaiDateTime = (iso: string) =>
  new Date(iso).toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' });

/** ขั้นที่ 8: ความยินยอม ต้องเปิดอ่านเอกสารและเลื่อนจนจบก่อนจึงกดยอมรับได้ */
export const StepConsent: React.FC<StepProps> = ({ profile, update, errors, clearError }) => {
  const [open, setOpen] = useState(false);

  const applyShareChoice = (share: boolean) => {
    const record = loadMemberRecord(CURRENT_MEMBER_ID);
    saveMemberRecord({ ...record, sharing: { ...record.sharing, shareData: share } });
  };

  const accept = () => {
    // ข้อ 4 ข) เป็นตัวเลือก: ค่าที่เลือกไว้กำหนดว่าจะแสดงข้อมูลให้คนในบ้านหรือไม่ (ไม่เลือก = ไม่แสดง)
    applyShareChoice(profile.consentShareHome);
    update({ consent: true, consentAt: new Date().toISOString(), consentVersion: CONSENT_VERSION });
    clearError('ob-consent');
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 shrink-0 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
            <FileText className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">
              หนังสือให้ความยินยอมและขออนุญาตใช้ข้อมูลสุขภาพ
            </h2>
            <p className="text-base text-slate-600 mt-1">
              กรุณาเปิดอ่านเอกสารให้ครบ เลื่อนจนถึงท้ายเอกสาร แล้วกดยอมรับ
            </p>
          </div>
        </div>

        <ul className="list-disc pl-6 mt-5 space-y-2 text-base text-slate-700">
          {SUMMARY_POINTS.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>

        <div className="mt-6">
          <Button
            id="ob-consent"
            type="button"
            variant={profile.consent ? 'soft' : 'primary'}
            fullWidth
            onClick={() => setOpen(true)}
          >
            <FileText className="w-5 h-5" aria-hidden="true" />
            <span>{profile.consent ? 'เปิดอ่านเอกสารอีกครั้ง' : 'เปิดอ่านเอกสาร'}</span>
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <p className="text-base font-bold text-slate-900">ตัวเลือก (ไม่บังคับ)</p>
        <div className="mt-3">
          <CheckboxField
            id="ob-consent-share-home"
            checked={profile.consentShareHome}
            onChange={(checked) => {
              update({ consentShareHome: checked });
              if (profile.consent) applyShareChoice(checked);
            }}
          >
            ให้สมาชิกบ้านที่ฉันเชิญดูข้อมูลสุขภาพของฉัน (ข้อ 4 ข)
          </CheckboxField>
        </div>
        <p className="mt-2 text-sm text-slate-700">
          ไม่เลือกก็ใช้แอปได้ เปลี่ยนใจได้ทุกเมื่อที่ ตั้งค่า › ความเป็นส่วนตัว
        </p>
      </div>

      {profile.consent && profile.consentAt ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-base font-semibold text-emerald-900"
        >
          <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
          <span>อ่านและยอมรับเอกสารแล้ว เมื่อ {formatThaiDateTime(profile.consentAt)}</span>
        </p>
      ) : (
        <p className="rounded-2xl bg-slate-100 p-4 text-base text-slate-700">
          ยังไม่ได้อ่านเอกสาร ต้องอ่านและกดยอมรับก่อนจึงจะเริ่มใช้งานได้
        </p>
      )}

      {errors['ob-consent'] && (
        <p id="ob-consent-error" role="alert" className="text-base font-semibold text-red-700">
          {errors['ob-consent']}
        </p>
      )}

      <ConsentDocumentModal open={open} onClose={() => setOpen(false)} onAccept={accept} />
    </div>
  );
};
