/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // Enable class-based dark mode
  content: [
    "./src/renderer/**/*.{html,js}", // Scan HTML and JS files in the renderer directory
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
