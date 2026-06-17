/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FFF8EC",
        paper: "#FFF2D8",
        accent: {
          orange: "#FF6B35",
          orangeLight: "#FFB088",
          mint: "#2EC4B6",
          mintLight: "#9AE8E0",
          red: "#E71D36",
          redLight: "#FF8FA3",
          ink: "#2B2D42",
          inkMute: "#8D8D92",
          blue: "#4A90D9",
          grayLight: "#E5E5E5",
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['"Space Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: "0 10px 30px -12px rgba(43, 45, 66, 0.15)",
        cardHover: "0 20px 40px -12px rgba(43, 45, 66, 0.25)",
      },
      keyframes: {
        floatUp: {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        floatUp: "floatUp 0.35s ease-out both",
      },
    },
  },
  plugins: [],
};
