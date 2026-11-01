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
        // โทนสีม่วงกับขาว สะอาดตา (Clean Purple & White)
        primary: {
          50: '#F5F3FF',
          100: '#EDE9FE',
          200: '#DDD6FE',
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#7C3AED', // ม่วงหลัก สดใส ชัดเจน
          700: '#6D28D9', // ม่วงเข้มสำหรับปุ่มและตัวอักษรสำคัญ
          800: '#5B21B6',
          900: '#4C1D95',
          DEFAULT: '#6D28D9',
        },
        surface: {
          light: '#FAFAFE',
          DEFAULT: '#FFFFFF',
          dark: '#0F172A',
        },
        contrast: {
          high: '#0F172A',
          medium: '#475569',
          border: '#E2E8F0',
        }
      },
      // ใช้ rem เพื่อให้ขนาดตัวอักษรทั้งแอปขยายตามค่า html font-size
      // (ตัวอักษรหลักที่ขนาดปกติ = 18px, หน้า "ตั้งค่า > ขนาดตัวอักษร" ปรับได้ 18/22/26px)
      fontSize: {
        sm: ['0.8889rem', { lineHeight: '1.3333rem' }],
        base: ['1rem', { lineHeight: '1.5556rem' }],
        lg: ['1.1111rem', { lineHeight: '1.6667rem' }],
        xl: ['1.3333rem', { lineHeight: '1.7778rem' }],
        '2xl': ['1.5556rem', { lineHeight: '2rem' }],
        '3xl': ['1.7778rem', { lineHeight: '2.2222rem' }],
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

