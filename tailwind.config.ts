import type { Config } from "tailwindcss";
import flowbite from "flowbite/plugin";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./node_modules/flowbite-react/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Legacy brand colors
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
        // True Crime Theme
        crime: {
          // Primary - Blood Red
          primary: {
            50: "#fef2f2",
            100: "#fee2e2",
            200: "#fecaca",
            300: "#fca5a5",
            400: "#f87171",
            500: "#8B0000",
            600: "#7f1d1d",
            700: "#6b1515",
            800: "#450a0a",
            900: "#2a0505",
          },
          // Backgrounds
          bg: "#0a0a0f",
          surface: "rgba(255, 255, 255, 0.03)",
          "surface-hover": "rgba(255, 255, 255, 0.06)",
          // Borders
          border: "rgba(255, 255, 255, 0.1)",
          "border-hover": "rgba(139, 0, 0, 0.3)",
          // Text
          text: "#ffffff",
          "text-secondary": "rgba(255, 255, 255, 0.7)",
          "text-muted": "rgba(255, 255, 255, 0.4)",
          // Status
          success: "#10b981",
          warning: "#f59e0b",
          error: "#ef4444",
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
  plugins: [flowbite],
  darkMode: "class",
};

export default config;

