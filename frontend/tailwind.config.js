/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        astral: {
          950: '#040508',
          900: '#070910',
          850: '#0C0E17',
          800: '#111420',
          750: '#171B2A',
          700: '#1F2438',
          600: '#2A314C',
          border: 'rgba(255, 255, 255, 0.08)',
          'border-hover': 'rgba(255, 255, 255, 0.16)',
          'border-active': 'rgba(99, 102, 241, 0.4)',
        },
        surface: {
          0: '#05060A',
          1: '#0A0C14',
          2: '#10131E',
          3: '#161A28',
          hover: '#1F2538',
        },
        accent: {
          DEFAULT: '#6366F1',
          hover: '#4F46E5',
          subtle: 'rgba(99, 102, 241, 0.12)',
          border: 'rgba(99, 102, 241, 0.28)',
          glow: 'rgba(99, 102, 241, 0.35)',
        },
        cosmic: {
          indigo: '#6366F1',
          violet: '#8B5CF6',
          cyan: '#06B6D4',
          emerald: '#10B981',
          amber: '#F59E0B',
          rose: '#F43F5E',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        panel: '0 4px 24px -2px rgba(0, 0, 0, 0.65)',
        elevated: '0 12px 36px -6px rgba(0, 0, 0, 0.75)',
        'glow-sm': '0 0 15px -3px rgba(99, 102, 241, 0.25)',
        'glow-md': '0 0 25px -4px rgba(99, 102, 241, 0.35)',
        'glow-cyan': '0 0 20px -4px rgba(6, 182, 212, 0.3)',
        'glow-emerald': '0 0 20px -4px rgba(16, 185, 129, 0.3)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'radar': 'radar 2s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
      keyframes: {
        radar: {
          '0%': { transform: 'scale(0.95)', opacity: '0.8' },
          '70%': { transform: 'scale(2.2)', opacity: '0' },
          '100%': { transform: 'scale(2.4)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
};
