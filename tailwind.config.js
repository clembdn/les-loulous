import tailwindcssAnimate from 'tailwindcss-animate'

const v = (name) => `rgb(var(${name}) / <alpha-value>)`

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        bg: v('--bg'),
        surface: v('--surface'),
        'surface-2': v('--surface-2'),
        border: v('--border'),
        'border-strong': v('--border-strong'),
        fg: v('--fg'),
        muted: v('--muted'),
        faint: v('--faint'),
        accent: v('--accent'),
        'accent-fg': v('--accent-fg'),
        success: '#22C55E',
        danger: '#EF4444',
        warning: '#F59E0B',
      },
      boxShadow: {
        card: '0 1px 0 rgb(255 255 255 / 0.03) inset, 0 8px 28px -16px rgb(0 0 0 / 0.55)',
        lift: '0 16px 48px -20px rgb(0 0 0 / 0.55)',
      },
    },
  },
  plugins: [tailwindcssAnimate],
}
