import React from 'react';
import { TextField } from '../ui/TextField';
import { SingleChoiceChips } from '../ui/ChoiceChips';
import {
  ALCOHOL,
  BLOOD_TYPES,
  EXERCISE,
  GENDERS,
  SMOKING,
} from '../../data/onboardingOptions';
import type { StepProps } from './stepTypes';

const thisYearBE = () => new Date().getFullYear() + 543;

/** ขั้นที่ 1: ข้อมูลส่วนตัว */
export const StepPersonal: React.FC<StepProps> = ({ profile, update, errors, clearError }) => (
  <div className="space-y-6">
    <TextField
      id="ob-fullname"
      name="name"
      label="ชื่อ-นามสกุล"
      labelSuffix="(จำเป็น)"
      autoComplete="name"
      placeholder="ชื่อและนามสกุลของคุณ"
      value={profile.fullName}
      onChange={(e) => {
        update({ fullName: e.target.value });
        clearError('ob-fullname');
      }}
      error={errors['ob-fullname']}
    />

    <TextField
      id="ob-age"
      name="age"
      label="อายุ (ปี)"
      labelSuffix="(จำเป็น)"
      hint="ขนาดยาและข้อห้ามใช้ยาขึ้นกับอายุ"
      inputMode="numeric"
      maxLength={3}
      autoComplete="off"
      placeholder="เช่น 45"
      value={profile.birthYear ? String(thisYearBE() - Number(profile.birthYear)) : ''}
      onChange={(e) => {
        const age = e.target.value.replace(/\D/g, '');
        update({ birthDay: '', birthMonth: '', birthYear: age === '' ? '' : String(thisYearBE() - Number(age)) });
        clearError('ob-age');
      }}
      error={errors['ob-age']}
    />

    <SingleChoiceChips
      id="ob-gender"
      label="เพศ"
      required
      error={errors['ob-gender']}
      options={GENDERS}
      value={profile.gender}
      onChange={(v) => {
        update({ gender: v });
        clearError('ob-gender');
      }}
    />

    <TextField
      id="ob-occupation"
      name="occupation"
      label="อาชีพ"
      hint="พิมพ์อาชีพของคุณ เช่น ครู พยาบาล ขับรถ งานกะกลางคืน จะช่วยให้เภสัชกรแนะนำได้ตรงขึ้น"
      autoComplete="off"
      placeholder="เช่น ครู, พนักงานออฟฟิศ, ค้าขาย"
      value={profile.occupation}
      onChange={(e) => update({ occupation: e.target.value })}
    />

    <TextField
      id="ob-phone"
      name="tel"
      type="tel"
      label="เบอร์โทรศัพท์"
      labelSuffix="(จำเป็น)"
      hint="ใช้ให้ร้านยาและคนส่งติดต่อได้เมื่อมีปัญหากับคำสั่งซื้อ"
      inputMode="tel"
      autoComplete="tel"
      placeholder="08x-xxx-xxxx"
      value={profile.phone}
      onChange={(e) => {
        update({ phone: e.target.value });
        clearError('ob-phone');
      }}
      error={errors['ob-phone']}
    />
  </div>
);

/** ขั้นที่ 2: ร่างกายและไลฟ์สไตล์ */
export const StepBody: React.FC<StepProps> = ({ profile, update, errors, clearError }) => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      <TextField
        id="ob-height"
        name="height"
        label="ส่วนสูง (ซม.)"
        inputMode="decimal"
        autoComplete="off"
        placeholder="เช่น 165"
        value={profile.heightCm}
        onChange={(e) => {
          update({ heightCm: e.target.value.replace(/[^\d.]/g, '') });
          clearError('ob-height');
        }}
        error={errors['ob-height']}
      />
      <TextField
        id="ob-weight"
        name="weight"
        label="น้ำหนัก (กก.)"
        labelSuffix="(จำเป็น)"
        inputMode="decimal"
        autoComplete="off"
        placeholder="เช่น 58"
        value={profile.weightKg}
        onChange={(e) => {
          update({ weightKg: e.target.value.replace(/[^\d.]/g, '') });
          clearError('ob-weight');
        }}
        error={errors['ob-weight']}
      />
    </div>

    <SingleChoiceChips
      label="หมู่เลือด"
      options={BLOOD_TYPES}
      value={profile.bloodType}
      onChange={(v) => update({ bloodType: v })}
    />
    <SingleChoiceChips
      label="การสูบบุหรี่"
      options={SMOKING}
      value={profile.smoking}
      onChange={(v) => update({ smoking: v })}
    />
    <SingleChoiceChips
      label="การดื่มแอลกอฮอล์"
      options={ALCOHOL}
      value={profile.alcohol}
      onChange={(v) => update({ alcohol: v })}
    />
    <SingleChoiceChips
      label="การออกกำลังกาย"
      options={EXERCISE}
      value={profile.exercise}
      onChange={(v) => update({ exercise: v })}
    />
  </div>
);
