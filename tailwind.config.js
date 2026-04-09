/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/client/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        risk: {
          danger: '#ef4444',
          warning: '#f59e0b',
          review: '#eab308',
          safe: '#22c55e',
        },
        ai: {
          badge: '#8b5cf6',
        },
        rule: {
          badge: '#6b7280',
        },
      },
    },
  },
  plugins: [],
};
