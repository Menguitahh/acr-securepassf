/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        'bg-base': '#09090b',
        'bg-surface': '#121212',
        'bg-elevated': '#1a1a1d',
        border: '#27272a',
        'text-primary': '#fafafa',
        'text-muted': '#a1a1aa',
        allow: '#16a34a',
        deny: '#dc2626',
        warn: '#d97706',
      },
    },
  },
};
