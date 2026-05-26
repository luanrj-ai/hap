import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0b0d12",
        panel: "#12151c",
        panel2: "#171b24",
        line: "#242a36",
        accent: "#7c5cff",
        cyan: "#22d3ee",
        green: "#3ddc97",
        yellow: "#ffd166",
        red: "#ff5d73",
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
