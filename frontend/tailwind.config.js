/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0fdf4',
          100: '#dcfce7',
          600: '#16a34a', // Forest Green
          700: '#15803d',
        },
        secondary: {
          600: '#4b5563', // Professional Gray
        },
        alert: {
          500: '#f59e0b', // Amber/Orange
          600: '#d97706',
        }
      },
    },
  },
  plugins: [],
}
