import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          green: "#22C55E",
          greenDark: "#16A34A",
          yellow: "#FACC15",
          bg: "#F3F4F6",
          card: "#FFFFFF",
          text: "#111827",
          muted: "#6B7280",
          borderSubtle: "#E5E7EB",
          danger: "#EF4444",
          success: "#22C55E",
        },
      },
      boxShadow: {
        "card-soft": "0 12px 40px rgba(15,23,42,0.08)",
        "card-md": "0 8px 20px rgba(15,23,42,0.05)",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
        pill: "9999px",
      },
    },
  },
  plugins: [],
};

export default config;

