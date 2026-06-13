/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f4f8ff',
          100: '#eaf2ff',
          200: '#c7dcff',
          300: '#90bdff',
          400: '#5095ff',
          500: '#2878e8',
          600: '#1768d1', // Primary Brand Blue
          700: '#0f56b3',
          800: '#0d3f8f',
          900: '#0b2d63',
          950: '#08111f',
        },
        success: {
          50: '#edfcf4',
          100: '#dcf8e8',
          500: '#18b866',
          600: '#119c55',
          700: '#0e7a42',
        },
        warning: {
          50: '#fff9e8',
          100: '#fef0c7',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b76300',
        },
        danger: {
          50: '#fff1f1',
          100: '#fde3e3',
          500: '#ef3535',
          600: '#e02424',
          700: '#c81e1e',
        },
        monitor: {
          background: '#07111f',
          surface: '#0d1a2a',
          border: '#223247',
        },
        secondary: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#08111f',
        }
      },
      borderRadius: {
        'sm': '2px',
        'DEFAULT': '5px',
        'md': '5px',
        'lg': '5px',
        'xl': '5px',
        '2xl': '5px',
        '3xl': '5px',
      },
      boxShadow: {
        'sm': '0 1px 3px rgba(15, 23, 42, 0.05)',
        'md': '0 4px 14px rgba(15, 23, 42, 0.07)',
        'lg': '0 10px 28px rgba(15, 23, 42, 0.10)',
        'soft': '0 3px 12px rgba(15, 23, 42, 0.06)',
        'premium': '0 10px 25px -5px rgba(0, 0, 0, 0.05)',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
