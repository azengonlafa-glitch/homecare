import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { bootCloud } from './cloud/engine';
import { retryPendingUploads } from './lib/fileStore';
import { applyFontScale, loadSettings } from './lib/settings';
import { installUiSounds } from './lib/sound';

/** รอเตรียมระบบคลาวด์ได้นานสุดเท่านี้ ถ้าเน็ตช้าหรือเซิร์ฟเวอร์ไม่ตอบ ก็ยังเปิดแอปด้วยข้อมูลในเครื่องให้ใช้งานได้ ไม่ค้างหน้าขาว */
const BOOT_TIMEOUT_MS = 6000;

// โหมดคลาวด์: ตรวจเซสชันและดึงข้อมูลล่าสุดลงเครื่องก่อนวาดหน้าจอ (ไม่ตั้งค่า Supabase = ข้ามขั้นนี้)
Promise.race([
  bootCloud().catch((err) => console.error('Cloud boot failed', err)),
  new Promise<void>((resolve) => window.setTimeout(() => {
    console.warn('Cloud boot is slow, opening the app with cached data first');
    resolve();
  }, BOOT_TIMEOUT_MS)),
])
  .finally(() => {
    // ใช้ขนาดตัวอักษรที่ผู้ใช้เลือกไว้ ก่อนวาดหน้าจอครั้งแรก (กันข้อความกระพริบ)
    applyFontScale(loadSettings().fontScale);
    void retryPendingUploads();
    installUiSounds();

    ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  });
