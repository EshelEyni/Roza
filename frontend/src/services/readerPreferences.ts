import type { Rendition } from "epubjs";
import type { ReaderPreferences } from "../../../shared/types/reader";

const palettes = {
  light: { background: "#fffefa", color: "#28231e" },
  sepia: { background: "#f3e8d5", color: "#392e24" },
  dark: { background: "#242622", color: "#e5e4da" },
};

export function applyPreferences(
  rendition: Rendition,
  preferences: ReaderPreferences,
) {
  const palette = palettes[preferences.theme];
  rendition.themes.default({
    body: {
      color: palette.color,
      background: palette.background,
    },
    "p, li, blockquote": {
      "line-height": preferences.lineHeight + " !important",
    },
    a: {
      color:
        preferences.theme === "dark"
          ? "#d5b88d !important"
          : "#79552e !important",
    },
    img: { "max-width": "100% !important", "object-fit": "contain" },
  });
  rendition.themes.override("color", palette.color, true);
  rendition.themes.override("background", palette.background, true);
  rendition.themes.override("font-size", preferences.fontSize + "px", true);
  rendition.themes.override(
    "font-family",
    preferences.fontFamily === "serif" ? "Georgia, serif" : "Arial, sans-serif",
    true,
  );
  rendition.themes.override(
    "line-height",
    String(preferences.lineHeight),
    true,
  );
}
