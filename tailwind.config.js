/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'navbar-accent-1': '#C89A4B',
        'navbar-accent-2': '#E1B86B',
        'navbar-accent-3': '#000000',
        'navbar-background': '#050608',
        'sidebar-background': '#F5F5F5',
        'sidebar-link-hover': '#A3A3A3',
        'sidebar-accent': '#C89A4B',
        'sidebar-hover-accent': '#E1B86B',
      },
      animation: {
        spotlight: 'spotlight 20s infinite linear',
        'slide-in-right': 'slideInRight 0.3s ease-out forwards',
        'fade-in': 'fadeIn 0.2s ease-out forwards',
      },
      keyframes: {
        spotlight: {
          '0%': { backgroundPosition: '200% 50%' },
          '100%': { backgroundPosition: '-100% 50%' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      boxShadow: {
        'glow-gold': '0 0 15px 0 rgba(200, 154, 75, 0.4)',
      },
    },
  },
  plugins: [],
};
