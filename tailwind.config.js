/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#f1f3f6",
        surface: {
          DEFAULT: "#ffffff",
          elevated: "#ffffff",
          subtle: "#f8f9fa",
        },
        border: {
          DEFAULT: "#d8dce0",
          subtle: "#e7eaef",
        },
        trimble: {
          blue: {
            DEFAULT: "#0063a3",
            dark: "#004f83",
            hover: "#005084",
            active: "#003d66",
            light: "#e5f2f8",
          },
          yellow: {
            DEFAULT: "#fbad26",
            light: "#fef8e8",
            dark: "#8a5800",
          },
          gray: {
            dark: "#252a2e",
            medium: "#46535e",
            muted: "#7c878e",
            border: "#d8dce0",
            bg: "#f1f3f6",
          },
          success: {
            DEFAULT: "#00823b",
            light: "#e6f5ec",
            dark: "#005a28",
          },
          danger: {
            DEFAULT: "#da3832",
            light: "#fdecec",
            dark: "#9e1b16",
          },
        },
        accent: {
          emerald: "#00823b",
          amber: "#fbad26",
          violet: "#0063a3",
        },
        slate: {
          muted: "#7c878e",
        },
      },
      fontFamily: {
        sans: ['"Open Sans"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'modus-1': '0 1px 3px rgba(37, 42, 46, 0.1), 0 1px 2px rgba(37, 42, 46, 0.06)',
        'modus-2': '0 4px 6px -1px rgba(37, 42, 46, 0.1), 0 2px 4px -1px rgba(37, 42, 46, 0.06)',
        'modus-3': '0 10px 15px -3px rgba(37, 42, 46, 0.15), 0 4px 6px -2px rgba(37, 42, 46, 0.1)',
      },
      borderRadius: {
        'modus': '4px',
      },
    },
  },
  plugins: [],
};
