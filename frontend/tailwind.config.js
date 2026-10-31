/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: '#000000',
        raised: '#0B0B0D',
        overlay: '#111114',
        line: {
          DEFAULT: 'rgba(255, 255, 255, 0.08)',
          strong: 'rgba(255, 255, 255, 0.14)',
        },
        brand: {
          DEFAULT: '#6D6AF7',
          hover: '#8481FA',
          muted: 'rgba(109, 106, 247, 0.14)',
          text: '#A9A7FF',
        },
      },
      fontFamily: {
        display: ['"Outfit"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        sans: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['11px', '16px'],
      },
      maxWidth: {
        page: '1200px',
      },
    },
  },
  plugins: [],
};
