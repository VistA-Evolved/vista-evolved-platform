/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1A1A2E',
          hover: '#2E5984',
          container: '#1A1A2E',
        },
        navy: '#1A1A2E',
        steel: '#2E5984',
        slate: '#3A6FA0',
        secondary: {
          DEFAULT: '#37618C',
          container: '#a4cdfe',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          alt: '#F5F8FB',
          dim: '#f8f9fd',
        },
        border: '#E2E4E8',
        hover: '#EBEDF0',
        danger: {
          DEFAULT: '#CC3333',
          bg: '#FDE8E8',
        },
        warning: {
          DEFAULT: '#E6A817',
          bg: '#FFF3E0',
        },
        success: {
          DEFAULT: '#2E7D32',
          bg: '#E8F5E9',
        },
        info: {
          DEFAULT: '#1565C0',
          bg: '#E3F2FD',
        },
        text: {
          DEFAULT: '#1A1A2E',
          secondary: '#555555',
          muted: '#999999',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      fontSize: {
        xs: ['11px', { lineHeight: '1.25' }],
        sm: ['13px', { lineHeight: '1.25' }],
        base: ['15px', { lineHeight: '1.5' }],
        md: ['17px', { lineHeight: '1.5' }],
        lg: ['20px', { lineHeight: '1.5' }],
        xl: ['24px', { lineHeight: '1.5' }],
        '2xl': ['30px', { lineHeight: '1.25' }],
      },
      spacing: {
        18: '4.5rem',
      },
      borderRadius: {
        sm: '4px',
        md: '6px',
        DEFAULT: '8px',
        lg: '12px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0,0,0,0.05)',
        md: '0 4px 8px rgba(0,0,0,0.1)',
        lg: '0 8px 24px rgba(0,0,0,0.15)',
      },
      minHeight: {
        content: 'calc(100vh - 40px)',
      },
    },
  },
  plugins: [],
};
