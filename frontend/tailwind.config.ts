import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Tight"', 'Inter', 'system-ui', 'sans-serif'],
        display: ['"Inter Tight"', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: {
          950: '#030304',
          900: '#07070a',
          850: '#0b0b0f',
          800: '#111117',
          700: '#171a20',
          600: '#1f232a',
        },
        gold: {
          50: '#fffdf3',
          100: '#fff7cc',
          200: '#ffed92',
          300: '#ffe05b',
          400: '#f6cc2b',
          500: '#d4af37',
          600: '#b88f2b',
          700: '#9a7525',
          800: '#7a5a1c',
          900: '#5a4214',
        },
        brand: {
          50: '#fff8de',
          100: '#ffefb3',
          200: '#ffe06a',
          300: '#ffd13d',
          400: '#f6be18',
          500: '#c9a33c',
          600: '#b18f33',
          700: '#8f6f2a',
          800: '#735420',
          900: '#5a4217',
        },
        metal: {
          950: '#f8e8b0',
          900: '#d1b45f',
          800: '#b08f2e',
          700: '#9a7a24',
          600: '#86691b',
        },
      },
      boxShadow: {
        glowGold: '0 0 0 1px rgba(212, 175, 55, 0.25), 0 18px 40px -28px rgba(212, 175, 55, 0.6)',
        panel: '0 18px 60px -32px rgba(0, 0, 0, 0.75)',
        glass: '0 20px 55px -36px rgba(0, 0, 0, 0.85)',
      },
      borderRadius: {
        '2.2xl': '1.1rem',
        '3xl': '1.5rem',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};

export default config;
