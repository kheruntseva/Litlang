/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f8f5f0',
          100: '#ede8e0',
          200: '#ddd2c3',
          300: '#ccbba6',
          400: '#b79f86',
          500: '#9a7f66',
          600: '#7f634c',
          700: '#684f3c',
          800: '#543f31',
          900: '#3f2f25',
        },
        accent: {
          50: '#faf4f4',
          100: '#f4e6e7',
          200: '#e9c9cc',
          300: '#dca7ad',
          400: '#ca7a83',
          500: '#b45963',
          600: '#973f4d',
          700: '#7a313e',
          800: '#632a34',
          900: '#4a2028',
        },
      },
    },
  },
  plugins: [],
}
