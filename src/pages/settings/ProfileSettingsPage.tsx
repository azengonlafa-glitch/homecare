import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { useToast } from '../../components/ui/Toast';
import { PageLayout } from '../../components/settings/PageLayout';
import { CURRENT_MEMBER_ID, loadSettings, saveSettings } from '../../lib/settings';

const MAX_NICKNAME = 20;

/** ตั้งค่า > โปรไฟล์ของฉัน: แก้ชื่อเล่นของตัวเอง (ช่องเดียว) */
export const ProfileSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState(loadSettings);
  const [nickname, setNickname] = useState(settings.nickname);
  const [error, setError] = useState('');
  const toast = useToast();

  // ปุ่มบันทึกเปิดใช้เมื่อมีการแก้จากค่าที่บันทึกไว้
  const unchanged = nickname.trim() === settings.nickname;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = nickname.trim();

    if (!value) {
      setError('กรอกชื่อเล่นก่อนนะ');
      document.getElementById('settings-nickname')?.focus();
      return;
    }
    if (unchanged) return;

    const next = saveSettings({
      ...settings,
      nickname: value,
      // ให้ชื่อในรายชื่อสมาชิกตรงกับชื่อเล่นที่เพิ่งแก้
      members: settings.members.map((member) =>
        member.id === CURRENT_MEMBER_ID ? { ...member, name: value } : member
      ),
    });
    setSettings(next);
    setNickname(value);
    setError('');
    toast.show('บันทึกแล้ว');
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <PageLayout
        title="โปรไฟล์ของฉัน"
        description="ตั้งชื่อเล่นที่คนในบ้านจะเห็น"
        footer={
          <Button type="submit" fullWidth disabled={unchanged}>
            บันทึก
          </Button>
        }
      >
        <Card>
          <TextField
            id="settings-nickname"
            name="nickname"
            label="ชื่อเล่นของฉัน"
            value={nickname}
            maxLength={MAX_NICKNAME}
            autoComplete="off"
            error={error}
            onChange={(e) => {
              setNickname(e.target.value);
              if (error) setError('');
            }}
          />
          <p
            className="mt-2 text-right text-base font-semibold text-slate-600"
            aria-label={`พิมพ์แล้ว ${nickname.length} จาก ${MAX_NICKNAME} ตัวอักษร`}
          >
            {nickname.length}/{MAX_NICKNAME}
          </p>
        </Card>
      </PageLayout>
    </form>
  );
};
