/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:           '#111113',
        sidebar:      '#0c0c0e',
        surface:      '#1c1c21',
        'surface-2':  '#242429',
        border:       '#26262d',
        'border-2':   '#323239',
        accent:       '#6366f1',
        'accent-hover': '#4f46e5',
        'accent-dim': '#6366f120',
        muted:        '#71717a',
        'muted-2':    '#52525b',
        danger:       '#f87171',
        warning:      '#fbbf24',
        success:      '#34d399',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'glow': '0 0 20px rgba(99,102,241,0.15)',
        'sm-dark': '0 1px 3px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
}
