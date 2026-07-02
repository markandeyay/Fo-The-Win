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
          bg: "var(--ftw-bg)",
          canvas: "var(--ftw-canvas)",
          panel: "var(--ftw-surface)",
          raised: "var(--ftw-surface-raised)",
          line: "var(--ftw-line)",
          accent: "var(--ftw-accent)",
          accentDeep: "var(--ftw-accent-deep)",
          text: "var(--ftw-text)",
          muted: "var(--ftw-muted)",
          success: "var(--ftw-success)",
          danger: "var(--ftw-danger)",
          warning: "var(--ftw-warning)",
          info: "var(--ftw-info)",
          dark: "var(--ftw-bg)",
        },
      },
      fontFamily: {
        sans: ["var(--font-ftw-sans)", "Inter", "system-ui", "sans-serif"],
        serif: ["var(--font-ftw-serif)", "Newsreader", "Georgia", "serif"],
      },
      boxShadow: {
        ftw: "0 14px 32px rgb(87 61 39 / 0.12)",
        "ftw-sm": "0 5px 14px rgb(87 61 39 / 0.09)",
        "ftw-inset": "inset 0 1px 0 rgb(255 255 255 / 0.68)",
      },
      borderRadius: {
        ftw: "0.5rem",
        "ftw-sm": "0.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
