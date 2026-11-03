import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { bootCloud } from './cloud/engine';
import { retryPendingUploads } from './lib/fileStore';
import { applyFontScale, loadSettings } from './lib/settings';

// โหมดคลาวด์: ตรวจเซสชันและดึงข้อมูลล่าสุดลงเครื่องก่อนวาดหน้าจอ (ไม่ตั้งค่า Supabase = ข้ามขั้นนี้)
bootCloud()
  .catch((err) => console.error('Cloud boot failed', err))
  .finally(() => {
    // ใช้ขนาดตัวอักษรที่ผู้ใช้เลือกไว้ ก่อนวาดหน้าจอครั้งแรก (กันข้อความกระพริบ)
    applyFontScale(loadSettings().fontScale);
    void retryPendingUploads();

    ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  });
