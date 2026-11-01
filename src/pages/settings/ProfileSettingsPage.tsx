import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { SettingsSubPage } from '../../components/settings/SettingsSubPage';
import { SavedNote } from '../../components/settings/SavedNote';
import { CURRENT_MEMBER_ID, loadSettings, saveSettings } from '../../lib/settings';

const MAX_NICKNAME = 20;

/** ตั้งค่า > โปรไฟล์ของฉัน: แก้ชื่อเล่นของตัวเอง (ช่องเดียว) */
export const ProfileSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState(loadSettings);
  const [nickname, setNickname] = useState(settings.nickname);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = nickname.trim();

    if (!value) {
      setError('กรุณากรอกชื่อเล่น');
      setSaved(false);
      document.getElementById('settings-nickname')?.focus();
      return;
    }

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
    setSaved(true);
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <SettingsSubPage
        title="โปรไฟล์ของฉัน"
        description="ตั้งชื่อเล่นที่คนในบ้านจะเห็น"
        footer={
          <Button type="submit" fullWidth>
            บันทึก
          </Button>
        }
      >
        <Card className="space-y-4">
          <TextField
            id="settings-nickname"
            name="nickname"
            label="ชื่อเล่นของฉัน"
            hint={`สูงสุด ${MAX_NICKNAME} ตัวอักษร`}
            value={nickname}
            maxLength={MAX_NICKNAME}
            autoComplete="off"
            error={error}
            onChange={(e) => {
              setNickname(e.target.value);
              if (error) setError('');
              if (saved) setSaved(false);
            }}
          />
          <SavedNote show={saved} />
        </Card>
      </SettingsSubPage>
    </form>
  );
};
