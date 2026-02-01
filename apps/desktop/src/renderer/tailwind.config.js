/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#0f0f1a",
          light: "#161625",
          lighter: "#1e1e35",
          border: "#2a2a4a",
        },
        accent: {
          DEFAULT: "#7c3aed",
          light: "#a78bfa",
          dark: "#5b21b6",
          glow: "rgba(124, 58, 237, 0.15)",
        },
        muted: {
          DEFAULT: "#64748b",
          light: "#94a3b8",
        },
      },
      boxShadow: {
        glow: "0 0 20px rgba(124, 58, 237, 0.15), 0 0 60px rgba(124, 58, 237, 0.05)",
        "glow-strong": "0 0 30px rgba(124, 58, 237, 0.25), 0 0 80px rgba(124, 58, 237, 0.1)",
        card: "0 4px 24px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(124, 58, 237, 0.08)",
      },
    },
  },
  plugins: [],
};
