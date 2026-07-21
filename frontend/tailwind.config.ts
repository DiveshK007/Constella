import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Catppuccin Mocha palette
        rosewater: 'hsl(var(--ctp-rosewater) / <alpha-value>)',
        flamingo: 'hsl(var(--ctp-flamingo) / <alpha-value>)',
        pink: 'hsl(var(--ctp-pink) / <alpha-value>)',
        mauve: 'hsl(var(--ctp-mauve) / <alpha-value>)',
        red: 'hsl(var(--ctp-red) / <alpha-value>)',
        maroon: 'hsl(var(--ctp-maroon) / <alpha-value>)',
        peach: 'hsl(var(--ctp-peach) / <alpha-value>)',
        yellow: 'hsl(var(--ctp-yellow) / <alpha-value>)',
        green: 'hsl(var(--ctp-green) / <alpha-value>)',
        teal: 'hsl(var(--ctp-teal) / <alpha-value>)',
        sky: 'hsl(var(--ctp-sky) / <alpha-value>)',
        sapphire: 'hsl(var(--ctp-sapphire) / <alpha-value>)',
        blue: 'hsl(var(--ctp-blue) / <alpha-value>)',
        lavender: 'hsl(var(--ctp-lavender) / <alpha-value>)',
        text: 'hsl(var(--ctp-text) / <alpha-value>)',
        subtext1: 'hsl(var(--ctp-subtext1) / <alpha-value>)',
        subtext0: 'hsl(var(--ctp-subtext0) / <alpha-value>)',
        overlay2: 'hsl(var(--ctp-overlay2) / <alpha-value>)',
        overlay1: 'hsl(var(--ctp-overlay1) / <alpha-value>)',
        overlay0: 'hsl(var(--ctp-overlay0) / <alpha-value>)',
        surface2: 'hsl(var(--ctp-surface2) / <alpha-value>)',
        surface1: 'hsl(var(--ctp-surface1) / <alpha-value>)',
        surface0: 'hsl(var(--ctp-surface0) / <alpha-value>)',
        base: 'hsl(var(--ctp-base) / <alpha-value>)',
        mantle: 'hsl(var(--ctp-mantle) / <alpha-value>)',
        crust: 'hsl(var(--ctp-crust) / <alpha-value>)',
        
        // Theme mappings
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
          foreground: 'hsl(var(--popover-foreground) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
        },
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        chart: {
          '1': 'hsl(var(--chart-1) / <alpha-value>)',
          '2': 'hsl(var(--chart-2) / <alpha-value>)',
          '3': 'hsl(var(--chart-3) / <alpha-value>)',
          '4': 'hsl(var(--chart-4) / <alpha-value>)',
          '5': 'hsl(var(--chart-5) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      backgroundImage: {
        aurora: 'linear-gradient(120deg, hsl(var(--aurora-from)), hsl(var(--aurora-to)))',
        'aurora-135': 'linear-gradient(135deg, hsl(var(--aurora-from)), hsl(var(--aurora-to)))',
        'aurora-soft':
          'linear-gradient(120deg, hsl(var(--aurora-from) / 0.16), hsl(var(--aurora-to) / 0.16))',
      },
      boxShadow: {
        glow: '0 0 24px -6px hsl(var(--aurora-from) / 0.55)',
        'glow-cyan': '0 0 24px -6px hsl(var(--aurora-to) / 0.5)',
        'glow-sm': '0 0 14px -6px hsl(var(--aurora-from) / 0.5)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        'twinkle': {
          '0%, 100%': { opacity: '0.35' },
          '50%': { opacity: '0.7' },
        },
        'aurora-pan': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'pulse-soft': 'pulse-soft 3s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'twinkle': 'twinkle 6s ease-in-out infinite',
        'aurora-pan': 'aurora-pan 8s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;