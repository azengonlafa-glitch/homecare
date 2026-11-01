import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // วันที่/เวลาที่ build หรือเริ่ม dev server แสดงในหน้า "เกี่ยวกับต้นแบบ" ให้ผู้ทดสอบรายงานตรงเวอร์ชัน
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  server: {
    host: true, // รองรับการเปิดดูจากมือถือในเครือข่ายเดียวกัน (LAN)
    port: 5173,
  },
  // หมายเหตุ: ค่าใน tailwind.config.js ถูกอ่านตอน dev server เริ่มทำงาน
  // ถ้าแก้ขนาดตัวอักษรใน config ต้องรีสตาร์ท dev server (ไฟล์นี้เปลี่ยน = รีสตาร์ทอัตโนมัติ)
});

