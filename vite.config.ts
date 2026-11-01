import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // รองรับการเปิดดูจากมือถือในเครือข่ายเดียวกัน (LAN)
    port: 5173,
  },
});

