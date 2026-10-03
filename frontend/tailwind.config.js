/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0a0a0c',
        surface: '#121216',
        surfaceLight: '#1b1b22',
        surfaceBorder: '#272733',
        brand: {
          50: '#f0f5ff',
          100: '#e0ebff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
        syne: ['Syne', 'sans-serif'],
      },
      keyframes: {
        pulseDots: {
          '0%, 100%': { opacity: '0.2', transform: 'scale(0.8)' },
          '50%': { opacity: '1', transform: 'scale(1.2)' },
        },
        eqBar: {
          '0%, 100%': { height: '4px' },
          '50%': { height: '16px' },
        },
      },
      animation: {
        pulseDots: 'pulseDots 1.4s infinite ease-in-out',
        eqBar: 'eqBar 0.8s ease-in-out infinite alternate',
      },
    },
  },
  plugins: [],
};
