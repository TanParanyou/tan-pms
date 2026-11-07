import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#000000",
          foreground: "#ffffff",
        },
        ink: "#000000",
        "ink-deep": "#090909",
        charcoal: "#525252",
        body: "#737373",
        mute: "#a3a3a3",
        canvas: "#ffffff",
        "surface-soft": "#fafafa",
        "surface-card": "#ffffff",
        hairline: "#e5e5e5",
        "hairline-strong": "#d4d4d4",
        "on-dark": "#ffffff",
        "on-dark-mute": "rgba(255,255,255,0.7)",
        "surface-dark": "#171717",
        "focus-ring": "rgba(59,130,246,0.5)",
        link: "#000000",
        "link-mute": "#737373",
        terminal: {
          red: "#ff5f56",
          yellow: "#ffbd2e",
          green: "#27c93f",
        },
        // shadcn/ui semantic tokens mapped to Ollama system
        border: "#e5e5e5",
        input: "#e5e5e5",
        ring: "rgba(59,130,246,0.5)",
        background: "#ffffff",
        foreground: "#000000",
        secondary: {
          DEFAULT: "#fafafa",
          foreground: "#000000",
        },
        destructive: {
          DEFAULT: "#ff5f56",
          foreground: "#ffffff",
        },
        muted: {
          DEFAULT: "#fafafa",
          foreground: "#737373",
        },
        accent: {
          DEFAULT: "#fafafa",
          foreground: "#000000",
        },
        card: {
          DEFAULT: "#ffffff",
          foreground: "#000000",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "'Inter'", "'Noto Sans Thai'", "sans-serif"],
        rounded: ["'SF Pro Rounded'", "-apple-system", "BlinkMacSystemFont", "'Nunito'", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "'JetBrains Mono'", "monospace"],
      },
      borderRadius: {
        none: "0px",
        sm: "6px",
        md: "8px",
        lg: "12px",
        full: "9999px",
      },
      height: {
        control: "var(--pms-control-h, 2.5rem)",
      },
      minHeight: {
        control: "var(--pms-control-h, 2.5rem)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
