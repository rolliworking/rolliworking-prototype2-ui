/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#f3f4f6',
        surface: '#ffffff',
        line: '#e2e6ea',
        ink: {
          DEFAULT: '#1c2430',
          700: '#2a3547',
          500: '#5b6b80',
          400: '#7c8a9d',
          300: '#a5b0bf',
        },
        brand: {
          DEFAULT: '#1f4e79',
          600: '#1a4266',
          100: '#d8e5f2',
          50: '#eaf1f8',
        },
        moss: {
          DEFAULT: '#1f7a4d',
          700: '#176240',
          100: '#d9eee0',
          50: '#eef7f1',
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(28, 36, 48, 0.06), 0 0 0 1px rgba(28, 36, 48, 0.04)',
        pop: '0 8px 24px rgba(28, 36, 48, 0.14), 0 0 0 1px rgba(28, 36, 48, 0.06)',
      },
    },
  },
  plugins: [],
};
