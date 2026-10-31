/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: '#07080C',
        raised: '#0E1017',
        overlay: '#141722',
        line: {
          DEFAULT: '#1E2230',
          strong: '#2E3448',
        },
        brand: {
          DEFAULT: '#2563EB',
          hover: '#3B82F6',
          muted: 'rgba(37, 99, 235, 0.14)',
          text: '#93C5FD',
        },
      },
      fontFamily: {
        display: ['"Be Vietnam Pro"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        sans: ['"Be Vietnam Pro"', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['12px', '18px'],
      },
      maxWidth: {
        page: '1160px',
      },
    },
  },
  plugins: [],
};
