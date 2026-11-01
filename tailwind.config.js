/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans Thai"', '"Noto Sans Thai"', 'sans-serif'],
      },
      colors: {
        // สีเน้นสีเดียวที่อบอุ่น (Warm Terracotta / Amber) พร้อมคอนทราสต์สูง
        primary: {
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#F97316',
          600: '#EA580C', // สีเน้นหลัก warm primary อบอุ่น ชัดเจน
          700: '#C2410C',
          800: '#9A3412',
          900: '#7C2D12',
          DEFAULT: '#EA580C',
        },
        // สีพื้นหลังและตัวหนังสือเน้นคอนทราสต์สูง อ่านง่ายสำหรับผู้สูงอายุ
        surface: {
          light: '#F8FAFC',
          DEFAULT: '#FFFFFF',
          dark: '#0F172A',
        },
        contrast: {
          high: '#0F172A',    // ดำเข้ม ชัดเจนสำหรับเนื้อหาสำคัญ
          medium: '#334155',  // เทาเข้ม คอนทราสต์ผ่านเกณฑ์ WCAG AAA
          border: '#CBD5E1',  // ขอบชัดเจน สังเกตง่าย
        }
      },
      fontSize: {
        // ตัวอักษรหลักเริ่มต้นอย่างน้อย 18px
        sm: ['16px', { lineHeight: '24px' }],
        base: ['18px', { lineHeight: '28px' }],
        lg: ['20px', { lineHeight: '30px' }],
        xl: ['24px', { lineHeight: '32px' }],
        '2xl': ['28px', { lineHeight: '36px' }],
        '3xl': ['32px', { lineHeight: '40px' }],
      },
      minHeight: {
        // ขนาดสัมผัสของปุ่มอย่างน้อย 48px สำหรับผู้สูงอายุ
        button: '48px',
        touch: '48px',
      },
      spacing: {
        12: '48px', // ปุ่ม 48px
      }
    },
  },
  plugins: [],
};
