/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Lora', 'Georgia', 'serif'],
        mono: ['DM Mono', 'monospace'],
      },
      colors: {
        stone: {
          50: '#fafaf9',
          100: '#f5f5f4',
          200: '#e7e5e4',
          300: '#d6d3d1',
          400: '#a8a29e',
          500: '#78716c',
          600: '#57534e',
          700: '#44403c',
          800: '#292524',
          900: '#1c1917',
          950: '#0c0a09',
        },
        sage: {
          50: '#f2f7f4',
          100: '#e0ece4',
          200: '#c2d9cb',
          300: '#97bea7',
          400: '#679d80',
          500: '#457f62',
          600: '#34644d',
          700: '#2a503e',
          800: '#234033',
          900: '#1d352b',
        },
        warm: {
          50: '#fdf8f0',
          100: '#faefd8',
          200: '#f4dcac',
          300: '#ecc475',
          400: '#e4a84a',
          500: '#dc8f2d',
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
};
