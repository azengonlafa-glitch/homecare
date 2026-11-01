import React from 'react';
import { TextField } from '../ui/TextField';
import { SelectField } from '../ui/SelectField';
import { FieldGroup, SingleChoiceChips } from '../ui/ChoiceChips';
import {
  ALCOHOL,
  BLOOD_TYPES,
  DAYS,
  EXERCISE,
  GENDERS,
  MONTHS,
  OCCUPATIONS,
  SMOKING,
} from '../../data/onboardingOptions';
import type { StepProps } from './stepTypes';

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

    <FieldGroup
      label="วันเกิด"
      hint="ขนาดยาและข้อห้ามใช้ยาขึ้นกับอายุ รู้แค่ปีเกิดก็กรอกได้"
      error={errors['ob-birth-year']}
    >
      <div className="grid grid-cols-3 sm:grid-cols-[0.9fr_1.5fr_1.1fr] gap-2 sm:gap-3 [&>*]:min-w-0 [&>*:nth-child(2)]:col-span-2 sm:[&>*:nth-child(2)]:col-span-1 [&>*:nth-child(3)]:col-span-3 sm:[&>*:nth-child(3)]:col-span-1 [&_button]:px-4 [&_input]:px-4 sm:[&_button]:px-6 sm:[&_input]:px-6">
        <SelectField
          id="ob-birth-day"
          label="วัน"
          hideLabel
          placeholder="วัน"
          options={DAYS}
          value={profile.birthDay}
          onChange={(v) => update({ birthDay: v })}
        />
        <SelectField
          id="ob-birth-month"
          label="เดือน"
          hideLabel
          placeholder="เดือน"
          options={MONTHS}
          value={profile.birthMonth}
          onChange={(v) => update({ birthMonth: v })}
        />
        <TextField
          id="ob-birth-year"
          name="bday-year"
          label="ปีเกิด (พ.ศ.)"
          hideLabel
          inputMode="numeric"
          maxLength={4}
          autoComplete="off"
          placeholder="ปี พ.ศ."
          value={profile.birthYear}
          onChange={(e) => {
            update({ birthYear: e.target.value.replace(/\D/g, '') });
            clearError('ob-birth-year');
          }}
        />
      </div>
    </FieldGroup>

    <SingleChoiceChips
      label="เพศ"
      options={GENDERS}
      value={profile.gender}
      onChange={(v) => update({ gender: v })}
    />

    <SelectField
      id="ob-occupation"
      label="อาชีพ"
      hint="อาชีพช่วยให้เภสัชกรแนะนำได้ตรงขึ้น เช่น งานกะกลางคืน งานที่ต้องขับรถ หรือสัมผัสสารเคมี"
      placeholder="เลือกอาชีพ"
      options={OCCUPATIONS}
      value={profile.occupation}
      onChange={(v) => update({ occupation: v })}
    />

    <TextField
      id="ob-phone"
      name="tel"
      type="tel"
      label="เบอร์โทรศัพท์"
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
