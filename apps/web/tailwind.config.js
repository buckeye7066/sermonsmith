export default {
  darkMode: 'class',
  content: ['./index.html', './app.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sermon: {
          cream: '#f8f3e8',
          amber: '#d97706',
          ink: '#0f172a',
          night: '#020617',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
