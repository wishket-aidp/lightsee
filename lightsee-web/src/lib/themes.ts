import type { ThemeColors } from "./types";

export const themes: Record<string, ThemeColors> = {
  light: { bg: "#ffffff", text: "#1a1a1a", heading: "#111111", link: "#0066cc", codeBg: "#f5f5f5", border: "#e0e0e0", blockquoteBorder: "#d0d0d0", blockquoteText: "#555555" },
  dark: { bg: "#1e1e1e", text: "#d4d4d4", heading: "#e0e0e0", link: "#6cb6ff", codeBg: "#2d2d2d", border: "#404040", blockquoteBorder: "#555555", blockquoteText: "#999999" },
  sepia: { bg: "#f4ecd8", text: "#5b4636", heading: "#3e2c1c", link: "#8b5e3c", codeBg: "#ebe3d1", border: "#d4c9b0", blockquoteBorder: "#c4b99a", blockquoteText: "#7a6652" },
  nord: { bg: "#2e3440", text: "#d8dee9", heading: "#eceff4", link: "#88c0d0", codeBg: "#3b4252", border: "#4c566a", blockquoteBorder: "#5e81ac", blockquoteText: "#a0aec0" },
  solarized: { bg: "#fdf6e3", text: "#657b83", heading: "#586e75", link: "#268bd2", codeBg: "#eee8d5", border: "#d3cbb7", blockquoteBorder: "#b58900", blockquoteText: "#839496" },
  dracula: { bg: "#282a36", text: "#f8f8f2", heading: "#f8f8f2", link: "#8be9fd", codeBg: "#44475a", border: "#6272a4", blockquoteBorder: "#bd93f9", blockquoteText: "#bfbfbf" },
  github: { bg: "#ffffff", text: "#24292f", heading: "#1f2328", link: "#0969da", codeBg: "#f6f8fa", border: "#d0d7de", blockquoteBorder: "#d0d7de", blockquoteText: "#656d76" },
  monokai: { bg: "#272822", text: "#f8f8f2", heading: "#f92672", link: "#66d9ef", codeBg: "#3e3d32", border: "#49483e", blockquoteBorder: "#a6e22e", blockquoteText: "#a09f93" },
  catMocha: { bg: "#1e1e2e", text: "#cdd6f4", heading: "#cdd6f4", link: "#89b4fa", codeBg: "#313244", border: "#45475a", blockquoteBorder: "#cba6f7", blockquoteText: "#a6adc8" },
  catMacchiato: { bg: "#24273a", text: "#cad3f5", heading: "#cad3f5", link: "#8aadf4", codeBg: "#363a4f", border: "#494d64", blockquoteBorder: "#c6a0f6", blockquoteText: "#a5adcb" },
  catFrappe: { bg: "#303446", text: "#c6d0f5", heading: "#c6d0f5", link: "#8caaee", codeBg: "#414559", border: "#51576d", blockquoteBorder: "#ca9ee6", blockquoteText: "#a5adce" },
  catLatte: { bg: "#eff1f5", text: "#4c4f69", heading: "#4c4f69", link: "#1e66f5", codeBg: "#ccd0da", border: "#bcc0cc", blockquoteBorder: "#8839ef", blockquoteText: "#6c6f85" },
  gradDeepOcean: { bg: "#1c2739", text: "#c1c1c1", heading: "#e2e2e2", link: "#ede891", codeBg: "#243647", border: "#151d2c", blockquoteBorder: "#4a75a2", blockquoteText: "#8a8a8a" },
  gradNatureGreen: { bg: "#20403f", text: "#cccece", heading: "#f1f4f6", link: "#cded91", codeBg: "#1e3b39", border: "#0a373b", blockquoteBorder: "#4aa275", blockquoteText: "#9aacab" },
  gradDarkFuchsia: { bg: "#3d214e", text: "#c8ccd0", heading: "#c9c9c9", link: "#c9a7d2", codeBg: "#3e1c4c", border: "#311f39", blockquoteBorder: "#643578", blockquoteText: "#9a8aa0" },
  gradMidnightBlue: { bg: "#282839", text: "#d4d4d4", heading: "#e2e2e2", link: "#ede891", codeBg: "#3d3d56", border: "#221b3c", blockquoteBorder: "#6b53a5", blockquoteText: "#9a9aac" },
  monocai: { bg: "#2d2a2f", text: "#fcfcfb", heading: "#fcfcfb", link: "#78dce9", codeBg: "#403e42", border: "#7f7e7f", blockquoteBorder: "#ab9df3", blockquoteText: "#727072" },
  everforestDark: { bg: "#2d353b", text: "#d3c6aa", heading: "#d3c6aa", link: "#7fbbb3", codeBg: "#343f44", border: "#475258", blockquoteBorder: "#a7c080", blockquoteText: "#859289" },
  everforestLight: { bg: "#fdf6e3", text: "#5c6a72", heading: "#5c6a72", link: "#35a77c", codeBg: "#f0e4ca", border: "#e0dcc7", blockquoteBorder: "#8da101", blockquoteText: "#939f91" },
};
