import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { readFileSync } from 'node:fs';

/**
 * Tailwind อ่าน tailwind.config.js ครั้งเดียวตอน dev server เริ่ม แก้ไฟล์นี้แล้วสี/ขนาดใหม่ไม่ขึ้นจนกว่าจะรีสตาร์ท
 * (เคยทำให้เปิดแอปแล้วสียังเป็นสีเก่า) ปลั๊กอินนี้รีสตาร์ท dev server ให้เองทุกครั้งที่ไฟล์นี้เปลี่ยน
 */
const restartOnTailwindConfig = (): Plugin => ({
  name: 'restart-on-tailwind-config',
  configureServer(server) {
    const file = 'tailwind.config.js';
    const read = () => {
      try {
        return readFileSync(file, 'utf8');
      } catch {
        return '';
      }
    };
    // รีสตาร์ทเฉพาะเมื่อ "เนื้อหา" ของไฟล์เปลี่ยนจริง (OneDrive หรือโปรแกรมอื่นแตะเวลาไฟล์เฉย ๆ ไม่นับ) และรอให้การแก้ไขนิ่งก่อน
    let known = read();
    let timer: ReturnType<typeof setTimeout> | undefined;
    server.watcher.add(file);
    server.watcher.on('change', (changed) => {
      if (!/(^|\/)tailwind\.config\.js$/.test(changed.replace(/\\/g, '/'))) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        const now = read();
        if (now && now !== known) {
          known = now;
          void server.restart();
        }
      }, 400);
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), restartOnTailwindConfig()],
  // วันที่/เวลาที่ build หรือเริ่ม dev server แสดงในหน้า "เกี่ยวกับต้นแบบ" ให้ผู้ทดสอบรายงานตรงเวอร์ชัน
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  server: {
    host: '127.0.0.1', // ใช้งานบนเครื่อง localhost ได้อย่างเสถียร
    port: 5173,
    // ถ้าพอร์ตนี้ถูกใช้อยู่ (เช่นเปิด dev server ค้างไว้อีกตัว) ให้ล้มเหลวทันที แทนที่จะย้ายไปพอร์ตอื่นเงียบ ๆ จนเปิดผิดตัว
    strictPort: true,
  },
  // หมายเหตุ: ค่าใน tailwind.config.js ถูกอ่านตอน dev server เริ่มทำงาน
  // ถ้าแก้ขนาดตัวอักษรใน config ต้องรีสตาร์ท dev server (ไฟล์นี้เปลี่ยน = รีสตาร์ทอัตโนมัติ)
});

