import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { applyFontScale, loadSettings } from './lib/settings';

// ใช้ขนาดตัวอักษรที่ผู้ใช้เลือกไว้ ก่อนวาดหน้าจอครั้งแรก (กันข้อความกระพริบ)
applyFontScale(loadSettings().fontScale);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
