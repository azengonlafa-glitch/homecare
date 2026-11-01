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

