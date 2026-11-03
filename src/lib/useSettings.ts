import { useEffect, useState } from 'react';
import { SETTINGS_CHANGED_EVENT, loadSettings, type AppSettings } from './settings';

/** อ่านการตั้งค่าล่าสุดและอัปเดตอัตโนมัติเมื่อมีการบันทึก (เช่น เปลี่ยนบทบาท) */
export function useSettings(): AppSettings {
  const [settings, setSettings] = useState(loadSettings);
  useEffect(() => {
    const sync = () => setSettings(loadSettings());
    window.addEventListener(SETTINGS_CHANGED_EVENT, sync);
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, sync);
  }, []);
  return settings;
}
