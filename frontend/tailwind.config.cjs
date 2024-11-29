/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1536px",
      },
    },
    extend: {
      colors: {
        "app-100": "#EADAC7",
        "app-200": "#C5B7A7",
        "app-300": "#C39B78",
        "app-400": "#937E6E",
        "app-500": "#725E52",
        "app-600": "#6A4A36",
        "app-700": "#3D3837",
        "app-800": "#2A1F19",
        "app-900": "#080809",
        "app-1000": "#000000",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
      fontFamily: {
        bellefair: ["Bellefair", "sans-serif"],
        alef: ["Alef", "sans-serif"],
        alefBold: ["Alef-Bold", "sans-serif"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
