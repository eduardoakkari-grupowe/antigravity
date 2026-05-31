import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        roge: {
          red: "#C8102E",
          redDark: "#A50C24",
          navy: "#1B2A63",
          navyDark: "#131E4A",
          sand: "#F7F3EC",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Poppins", "Inter", "sans-serif"],
      },
      boxShadow: {
        soft: "0 10px 40px -12px rgba(27, 42, 99, 0.25)",
      },
    },
  },
  plugins: [],
} satisfies Config;
