/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#212121',
        sidebar: '#171717',
        surface: '#2f2f2f',
        border: '#3a3a3a',
        accent: '#10a37f',
        'accent-hover': '#0d8f6e',
        muted: '#8e8ea0',
        danger: '#ef4444',
        warning: '#f59e0b',
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
}
