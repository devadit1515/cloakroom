/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        obsidian: { 950: "#050609", 900: "#06070A", 800: "#080910", 700: "#0B0D14", 600: "#11131C", 500: "#171A26" },
        mercury: { DEFAULT: "#C8D2E0", bright: "#EAF0F8", deep: "#8C97AB" },
        pii: { DEFAULT: "#B197D6", glow: "#7C5EA8" },
        phi: { DEFAULT: "#5FB3A8", glow: "#37756E" },
        pfi: { DEFAULT: "#DCB87E", glow: "#A87E45" }
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ['"Bricolage Grotesque"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"]
      },
      letterSpacing: { label: "0.34em" },
      transitionTimingFunction: { vault: "cubic-bezier(0.16, 1, 0.3, 1)" },
      zIndex: { scene: "0", content: "10", chrome: "40", overlay: "60", grain: "90" }
    }
  },
  plugins: []
};
