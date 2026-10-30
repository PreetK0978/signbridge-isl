import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 950: '#050a18', 900: '#0a1228', 800: '#101b3a', 700: '#18264d', 600: '#22335f' },
        electric: { 400: '#4d8dff', 500: '#2f6bff', 600: '#1f4fd6' },
        cyan: { 300: '#7cf3ff', 400: '#3ee6f5', 500: '#12c8db' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(62,230,245,0.25), 0 8px 32px -8px rgba(47,107,255,0.45)',
        'glow-sm': '0 0 16px -4px rgba(62,230,245,0.55)',
      },
      keyframes: {
        pulseRing: { '0%': { transform: 'scale(0.9)', opacity: '0.8' }, '100%': { transform: 'scale(1.6)', opacity: '0' } },
        fadeUp: { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        'pulse-ring': 'pulseRing 1.4s ease-out infinite',
        'fade-up': 'fadeUp 0.4s ease-out both',
      },
    },
  },
  plugins: [],
} satisfies Config;
