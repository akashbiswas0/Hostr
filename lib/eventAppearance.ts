import type { Event } from "@/lib/arkiv/types";

export const EVENT_THEME_OPTIONS = [
  { id: "minimal", label: "Minimal", preview: "linear-gradient(145deg, #ece6f2 0%, #b7b1c5 100%)" },
  { id: "quantum", label: "Quantum", preview: "linear-gradient(145deg, #7cdbff 0%, #d078ff 50%, #6f83ff 100%)" },
  { id: "warp", label: "Warp", preview: "radial-gradient(circle at 50% 50%, #320337 0%, #0f0a1a 42%, #6de2ff 100%)" },
  { id: "emoji", label: "Emoji", preview: "linear-gradient(145deg, #ffd4f6 0%, #c8a1ff 100%)" },
  { id: "confetti", label: "Confetti", preview: "linear-gradient(145deg, #7f17f0 0%, #c64ffd 45%, #ff79d7 100%)" },
  { id: "pattern", label: "Pattern", preview: "linear-gradient(145deg, #6f54ff 0%, #5f8fff 50%, #95a1ff 100%)" },
  { id: "seasonal", label: "Seasonal", preview: "linear-gradient(145deg, #63c2ff 0%, #4d8fff 50%, #0f4f86 100%)" },
] as const;

export type EventThemeId = (typeof EVENT_THEME_OPTIONS)[number]["id"];

export const EVENT_FONT_PRESETS = [
  "Default",
  "Museo",
  "Factoria",
  "Ivy Presto",
  "Ivy Mode",
  "Google",
  "Roc",
  "Nunito",
  "Degular",
  "Pearl",
  "Geist Mono",
  "New Spirit",
  "Departure",
  "Garamond",
  "Futura",
  "Alternate",
] as const;

export type EventFontPreset = (typeof EVENT_FONT_PRESETS)[number];

const DEFAULT_THEME_ID: EventThemeId = "minimal";
const DEFAULT_FONT_PRESET: EventFontPreset = "Default";

type ThemeInfo = {
  id: EventThemeId;
  label: string;
  preview: string;
  heroGradient: string;
  cardGradient: string;
  pageBackground: string;
  accentColor: string;
  accentTextColor: string;
};

const THEME_DETAILS: Record<EventThemeId, ThemeInfo> = {
  minimal: {
    id: "minimal",
    label: "Minimal",
    preview: "linear-gradient(145deg, #ece6f2 0%, #b7b1c5 100%)",
    heroGradient: "linear-gradient(145deg, #f4ecfa 0%, #cfc7dd 55%, #b6b0c5 100%)",
    cardGradient: "linear-gradient(145deg, #d8d2e4 0%, #bbb5cc 100%)",
    pageBackground:
      "radial-gradient(circle at 8% 0%, rgba(232,222,246,0.28), transparent 30%), radial-gradient(circle at 88% 0%, rgba(205,197,221,0.22), transparent 26%), linear-gradient(180deg, #26192f 0%, #170f20 50%, #120a19 100%)",
    accentColor: "#ddd8e8",
    accentTextColor: "#23182d",
  },
  quantum: {
    id: "quantum",
    label: "Quantum",
    preview: "linear-gradient(145deg, #7cdbff 0%, #d078ff 50%, #6f83ff 100%)",
    heroGradient: "linear-gradient(140deg, #7cdbff 0%, #d078ff 52%, #6f83ff 100%)",
    cardGradient: "linear-gradient(135deg, #62cbff 0%, #b16bff 52%, #758eff 100%)",
    pageBackground:
      "radial-gradient(circle at 12% 0%, rgba(97,216,255,0.34), transparent 32%), radial-gradient(circle at 88% 0%, rgba(198,95,255,0.3), transparent 28%), linear-gradient(180deg, #170f2f 0%, #0f0a20 50%, #080613 100%)",
    accentColor: "#8f86ff",
    accentTextColor: "#f8f5ff",
  },
  warp: {
    id: "warp",
    label: "Warp",
    preview: "radial-gradient(circle at 50% 50%, #320337 0%, #0f0a1a 42%, #6de2ff 100%)",
    heroGradient: "radial-gradient(circle at 45% 40%, #3d0b48 0%, #120c21 48%, #6de2ff 100%)",
    cardGradient: "linear-gradient(150deg, #30063d 0%, #111023 62%, #62dcff 100%)",
    pageBackground:
      "radial-gradient(circle at 50% 0%, rgba(102,230,255,0.18), transparent 36%), radial-gradient(circle at 5% 10%, rgba(112,36,153,0.32), transparent 28%), linear-gradient(180deg, #0f0a1a 0%, #0a0714 52%, #06050d 100%)",
    accentColor: "#67dfff",
    accentTextColor: "#0b1220",
  },
  emoji: {
    id: "emoji",
    label: "Emoji",
    preview: "linear-gradient(145deg, #ffd4f6 0%, #c8a1ff 100%)",
    heroGradient: "linear-gradient(140deg, #ffd4f6 0%, #f5b8ff 38%, #c8a1ff 100%)",
    cardGradient: "linear-gradient(145deg, #ffc5ef 0%, #d09dff 100%)",
    pageBackground:
      "radial-gradient(circle at 10% 0%, rgba(255,194,236,0.35), transparent 30%), radial-gradient(circle at 88% 2%, rgba(210,157,255,0.3), transparent 26%), linear-gradient(180deg, #311737 0%, #25122d 52%, #1a0d20 100%)",
    accentColor: "#f1c3ff",
    accentTextColor: "#2d1133",
  },
  confetti: {
    id: "confetti",
    label: "Confetti",
    preview: "linear-gradient(145deg, #7f17f0 0%, #c64ffd 45%, #ff79d7 100%)",
    heroGradient: "linear-gradient(140deg, #7f17f0 0%, #c64ffd 45%, #ff79d7 100%)",
    cardGradient: "linear-gradient(145deg, #6f18df 0%, #bd4efd 42%, #ff75d2 100%)",
    pageBackground:
      "radial-gradient(circle at 12% 0%, rgba(198,79,253,0.34), transparent 28%), radial-gradient(circle at 90% 8%, rgba(255,121,215,0.28), transparent 25%), linear-gradient(180deg, #280d3e 0%, #1f0a30 52%, #160721 100%)",
    accentColor: "#ff86dd",
    accentTextColor: "#36081f",
  },
  pattern: {
    id: "pattern",
    label: "Pattern",
    preview: "linear-gradient(145deg, #6f54ff 0%, #5f8fff 50%, #95a1ff 100%)",
    heroGradient: "linear-gradient(145deg, #6f54ff 0%, #5f8fff 50%, #95a1ff 100%)",
    cardGradient: "linear-gradient(145deg, #6247ff 0%, #5c86f7 48%, #8f99f5 100%)",
    pageBackground:
      "radial-gradient(circle at 15% 0%, rgba(111,84,255,0.34), transparent 31%), radial-gradient(circle at 88% 0%, rgba(95,143,255,0.3), transparent 28%), linear-gradient(180deg, #1e1742 0%, #171237 50%, #110d29 100%)",
    accentColor: "#8f9bff",
    accentTextColor: "#181335",
  },
  seasonal: {
    id: "seasonal",
    label: "Seasonal",
    preview: "linear-gradient(145deg, #63c2ff 0%, #4d8fff 50%, #0f4f86 100%)",
    heroGradient: "linear-gradient(140deg, #63c2ff 0%, #4d8fff 50%, #0f4f86 100%)",
    cardGradient: "linear-gradient(145deg, #5eb8f2 0%, #4f8eef 48%, #145987 100%)",
    pageBackground:
      "radial-gradient(circle at 10% 0%, rgba(95,194,255,0.34), transparent 32%), radial-gradient(circle at 88% 4%, rgba(77,143,255,0.28), transparent 27%), linear-gradient(180deg, #111f3a 0%, #0d1931 52%, #091227 100%)",
    accentColor: "#6cc8ff",
    accentTextColor: "#0e2338",
  },
};

const FONT_FAMILY_BY_PRESET: Record<EventFontPreset, string> = {
  Default: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  Museo: "'Museo Sans', 'Avenir Next', 'Segoe UI', sans-serif",
  Factoria: "'Factoria', 'Franklin Gothic Medium', 'Arial Narrow', sans-serif",
  "Ivy Presto": "'IvyPresto Display', 'Bodoni Moda', Georgia, serif",
  "Ivy Mode": "'IvyMode', 'Cormorant Garamond', Georgia, serif",
  Google: "'Google Sans', 'Product Sans', 'Segoe UI', sans-serif",
  Roc: "'Roc Grotesk', 'Poppins', 'Segoe UI', sans-serif",
  Nunito: "'Nunito', 'Avenir Next', 'Segoe UI', sans-serif",
  Degular: "'Degular', 'General Sans', 'Segoe UI', sans-serif",
  Pearl: "'Pearl', 'DM Sans', 'Segoe UI', sans-serif",
  "Geist Mono": "'Geist Mono', 'JetBrains Mono', Menlo, monospace",
  "New Spirit": "'New Spirit', 'Newsreader', Georgia, serif",
  Departure: "'Departure Mono', 'IBM Plex Mono', Menlo, monospace",
  Garamond: "'EB Garamond', Garamond, Georgia, serif",
  Futura: "Futura, 'Century Gothic', 'Avenir Next', sans-serif",
  Alternate: "'Bebas Neue', 'Oswald', 'Arial Narrow', sans-serif",
};

function isThemeId(value: string): value is EventThemeId {
  return value in THEME_DETAILS;
}

function isFontPreset(value: string): value is EventFontPreset {
  return EVENT_FONT_PRESETS.includes(value as EventFontPreset);
}

export function normalizeEventThemeId(themeId?: string): EventThemeId {
  if (!themeId) return DEFAULT_THEME_ID;
  return isThemeId(themeId) ? themeId : DEFAULT_THEME_ID;
}

export function normalizeEventFontPreset(fontPreset?: string): EventFontPreset {
  if (!fontPreset) return DEFAULT_FONT_PRESET;
  return isFontPreset(fontPreset) ? fontPreset : DEFAULT_FONT_PRESET;
}

export function getEventTheme(themeId?: string): ThemeInfo {
  return THEME_DETAILS[normalizeEventThemeId(themeId)];
}

export function getEventFontFamily(fontPreset?: string): string {
  const key = normalizeEventFontPreset(fontPreset);
  return FONT_FAMILY_BY_PRESET[key];
}

export function resolveEventAppearance(
  event?: Pick<Event, "themeId" | "fontPreset"> | null,
): {
  themeId: EventThemeId;
  fontPreset: EventFontPreset;
  theme: ThemeInfo;
  fontFamily: string;
} {
  const themeId = normalizeEventThemeId(event?.themeId);
  const fontPreset = normalizeEventFontPreset(event?.fontPreset);
  return {
    themeId,
    fontPreset,
    theme: THEME_DETAILS[themeId],
    fontFamily: FONT_FAMILY_BY_PRESET[fontPreset],
  };
}
