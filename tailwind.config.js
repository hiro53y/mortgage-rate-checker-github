/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#eef5ff",
          100: "#d9e9ff",
          600: "#1559b7",
          700: "#0f438b",
          800: "#0b3268",
          900: "#08284f"
        }
      },
      boxShadow: {
        soft: "0 10px 28px rgba(15, 67, 139, 0.08)"
      }
    }
  },
  plugins: []
};
