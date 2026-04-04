/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'Consolas', 'monospace'],
      },
      colors: {
        cabin: {
          bg: 'var(--cabin-bg)',
          surface: 'var(--cabin-surface)',
          border: 'var(--cabin-border)',
        },
      },
    },
  },
  plugins: [],
}
