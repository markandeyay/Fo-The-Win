import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ftw: {
          dark: "#0b0f19",
          panel: "#111827",
          accent: "#f59e0b",
          success: "#22c55e",
          danger: "#ef4444",
          info: "#3b82f6",
          text: "#f3f4f6",
          muted: "#9ca3af",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
