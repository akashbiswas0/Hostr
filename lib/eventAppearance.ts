import type { Event } from "@/lib/arkiv/types";

export const EVENT_THEME_OPTIONS = [
  { id: "minimal", label: "Minimal", preview: "linear-gradient(145deg, #fbe5eb 0%, #b02441 100%)" },
  { id: "emoji", label: "Emoji", preview: "linear-gradient(145deg, #95d54c 0%, #2f7f1e 100%)" },
  { id: "pattern", label: "Pattern", preview: "linear-gradient(145deg, #6f54ff 0%, #5f8fff 50%, #95a1ff 100%)" },
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

export const EVENT_EMOJI_OPTIONS = [
  { id: "heart", label: "Heart", emoji: "❤️", from: "#6f122d", to: "#2a0914" },
  { id: "party", label: "Party", emoji: "🥳", from: "#5f226d", to: "#2b1536" },
  { id: "sunglasses", label: "Sunglasses", emoji: "😎", from: "#66551e", to: "#2f260f" },
  { id: "clover", label: "Clover", emoji: "🍀", from: "#1f6a12", to: "#0a2f06" },
  { id: "pumpkin", label: "Pumpkin", emoji: "🎃", from: "#73310f", to: "#2f1507" },
  { id: "lollipop", label: "Lollipop", emoji: "🍭", from: "#8b2576", to: "#3d1236" },
  { id: "earth", label: "Earth", emoji: "🌍", from: "#175075", to: "#0c2233" },
  { id: "fire", label: "Fire", emoji: "🔥", from: "#8b2d12", to: "#3a1408" },
  { id: "ghost", label: "Ghost", emoji: "👻", from: "#4f5072", to: "#1f2130" },
  { id: "dragon", label: "Dragon", emoji: "🐉", from: "#2d6a33", to: "#123017" },
  { id: "cocktail", label: "Cocktail", emoji: "🍸", from: "#30675f", to: "#12312d" },
  { id: "gameday", label: "Gameday", emoji: "🏀", from: "#734113", to: "#2f1b08" },
  { id: "demon", label: "Demon", emoji: "😈", from: "#5f1a67", to: "#290b2d" },
  { id: "alien", label: "Alien", emoji: "👽", from: "#32516e", to: "#13212d" },
  { id: "skull", label: "Skull", emoji: "💀", from: "#505050", to: "#1f1f1f" },
  { id: "america", label: "America", emoji: "🇺🇸", from: "#1b4a7d", to: "#0b2138" },
] as const;

export type EventEmojiId = (typeof EVENT_EMOJI_OPTIONS)[number]["id"];

const DEFAULT_THEME_ID: EventThemeId = "minimal";
const DEFAULT_FONT_PRESET: EventFontPreset = "Default";
export const DEFAULT_MINIMAL_THEME_COLOR = "#b02441";
export const DEFAULT_EMOJI_SYMBOL = "🍀";

export type ThemeInfo = {
  id: EventThemeId;
  label: string;
  preview: string;
  heroGradient: string;
  cardGradient: string;
  pageBackground: string;
  detailBackground: string;
  detailOverlay?: string;
  detailOverlaySize?: string;
  accentColor: string;
  accentTextColor: string;
};

type Rgb = { r: number; g: number; b: number };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseHexColor(value: string): Rgb | null {
  const normalized = value.trim().toLowerCase();
  const short = normalized.match(/^#([0-9a-f]{3})$/i);
  if (short) {
    const [r, g, b] = short[1].split("").map((char) => parseInt(`${char}${char}`, 16));
    return { r, g, b };
  }

  const full = normalized.match(/^#([0-9a-f]{6})$/i);
  if (!full) return null;
  return {
    r: parseInt(full[1].slice(0, 2), 16),
    g: parseInt(full[1].slice(2, 4), 16),
    b: parseInt(full[1].slice(4, 6), 16),
  };
}

function rgbToHex(rgb: Rgb): string {
  const safe = {
    r: clamp(Math.round(rgb.r), 0, 255),
    g: clamp(Math.round(rgb.g), 0, 255),
    b: clamp(Math.round(rgb.b), 0, 255),
  };
  return `#${safe.r.toString(16).padStart(2, "0")}${safe.g.toString(16).padStart(2, "0")}${safe.b.toString(16).padStart(2, "0")}`;
}

function mix(colorA: Rgb, colorB: Rgb, ratio: number): Rgb {
  const p = clamp(ratio, 0, 1);
  return {
    r: colorA.r + (colorB.r - colorA.r) * p,
    g: colorA.g + (colorB.g - colorA.g) * p,
    b: colorA.b + (colorB.b - colorA.b) * p,
  };
}

function withAlpha(rgb: Rgb, alpha: number): string {
  return `rgba(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}, ${clamp(alpha, 0, 1)})`;
}

function relativeLuminance(rgb: Rgb): number {
  const normalize = (channel: number) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };

  const r = normalize(rgb.r);
  const g = normalize(rgb.g);
  const b = normalize(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function normalizeHexColor(value?: string): string | null {
  if (!value) return null;
  const parsed = parseHexColor(value);
  if (!parsed) return null;
  return rgbToHex(parsed);
}

function createSvgDataUri(svg: string): string {
  const compact = svg.replace(/\s{2,}/g, " ").replace(/\n/g, "").trim();
  return `url("data:image/svg+xml,${encodeURIComponent(compact)}")`;
}

function createEmojiOverlay(symbol: string): string {
  return createSvgDataUri(`
    <svg xmlns='http://www.w3.org/2000/svg' width='280' height='280' viewBox='0 0 280 280'>
      <rect width='280' height='280' fill='none'/>
      <text x='14' y='44' font-size='44'>${symbol}</text>
      <text x='116' y='54' font-size='40'>${symbol}</text>
      <text x='208' y='78' font-size='42'>${symbol}</text>
      <text x='44' y='134' font-size='50'>${symbol}</text>
      <text x='170' y='156' font-size='52'>${symbol}</text>
      <text x='20' y='228' font-size='46'>${symbol}</text>
      <text x='196' y='246' font-size='48'>${symbol}</text>
    </svg>
  `);
}

const PATTERN_OVERLAY = createSvgDataUri(`
  <svg xmlns='http://www.w3.org/2000/svg' width='180' height='180' viewBox='0 0 180 180'>
    <defs>
      <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0%' stop-color='#ffffff' stop-opacity='0.2'/>
        <stop offset='100%' stop-color='#ffffff' stop-opacity='0.02'/>
      </linearGradient>
    </defs>
    <rect width='180' height='180' fill='none'/>
    <path d='M0 36 Q45 0 90 36 T180 36' stroke='url(#g)' stroke-width='2' fill='none'/>
    <path d='M0 90 Q45 54 90 90 T180 90' stroke='url(#g)' stroke-width='2' fill='none'/>
    <path d='M0 144 Q45 108 90 144 T180 144' stroke='url(#g)' stroke-width='2' fill='none'/>
    <circle cx='30' cy='30' r='22' stroke='url(#g)' stroke-width='2' fill='none'/>
    <circle cx='120' cy='120' r='40' stroke='url(#g)' stroke-width='2' fill='none'/>
  </svg>
`);

function buildMinimalTheme(themeColor: string): ThemeInfo {
  const base = parseHexColor(themeColor) ?? parseHexColor(DEFAULT_MINIMAL_THEME_COLOR)!;
  const bright = mix(base, { r: 255, g: 255, b: 255 }, 0.6);
  const light = mix(base, { r: 255, g: 255, b: 255 }, 0.32);
  const deep = mix(base, { r: 8, g: 10, b: 20 }, 0.62);
  const darker = mix(base, { r: 5, g: 7, b: 12 }, 0.74);
  const accent = mix(base, { r: 255, g: 255, b: 255 }, 0.5);

  return {
    id: "minimal",
    label: "Minimal",
    preview: `linear-gradient(145deg, ${rgbToHex(bright)} 0%, ${themeColor} 100%)`,
    heroGradient: `linear-gradient(145deg, ${rgbToHex(light)} 0%, ${themeColor} 62%, ${rgbToHex(deep)} 100%)`,
    cardGradient: `linear-gradient(145deg, ${rgbToHex(mix(base, { r: 255, g: 255, b: 255 }, 0.38))} 0%, ${themeColor} 100%)`,
    pageBackground: `radial-gradient(circle at 8% 0%, ${withAlpha(bright, 0.28)}, transparent 32%), radial-gradient(circle at 88% 0%, ${withAlpha(light, 0.22)}, transparent 29%), linear-gradient(180deg, ${rgbToHex(deep)} 0%, ${rgbToHex(darker)} 55%, #090b12 100%)`,
    detailBackground: `radial-gradient(circle at 10% 0%, ${withAlpha(bright, 0.33)}, transparent 35%), radial-gradient(circle at 94% 8%, ${withAlpha(light, 0.24)}, transparent 30%), linear-gradient(180deg, ${rgbToHex(deep)} 0%, ${rgbToHex(darker)} 55%, #090b12 100%)`,
    accentColor: rgbToHex(accent),
    accentTextColor: relativeLuminance(accent) > 0.5 ? "#231526" : "#f7f2f8",
  };
}

function buildEmojiTheme(emojiSymbol: string): ThemeInfo {
  const option = EVENT_EMOJI_OPTIONS.find((item) => item.emoji === emojiSymbol) ?? EVENT_EMOJI_OPTIONS.find((item) => item.emoji === DEFAULT_EMOJI_SYMBOL)!;
  const from = parseHexColor(option.from)!;
  const to = parseHexColor(option.to)!;
  const bright = mix(from, { r: 255, g: 255, b: 255 }, 0.34);
  const accent = mix(from, { r: 255, g: 255, b: 255 }, 0.55);

  return {
    id: "emoji",
    label: "Emoji",
    preview: `linear-gradient(145deg, ${option.from} 0%, ${option.to} 100%)`,
    heroGradient: `linear-gradient(145deg, ${rgbToHex(bright)} 0%, ${option.from} 58%, ${option.to} 100%)`,
    cardGradient: `linear-gradient(145deg, ${rgbToHex(mix(from, { r: 255, g: 255, b: 255 }, 0.22))} 0%, ${option.from} 60%, ${option.to} 100%)`,
    pageBackground: `radial-gradient(circle at 15% 0%, ${withAlpha(bright, 0.22)}, transparent 30%), radial-gradient(circle at 88% 6%, ${withAlpha(from, 0.27)}, transparent 28%), linear-gradient(180deg, ${option.from} 0%, ${option.to} 65%, ${rgbToHex(mix(to, { r: 0, g: 0, b: 0 }, 0.3))} 100%)`,
    detailBackground: `radial-gradient(circle at 10% 0%, ${withAlpha(bright, 0.22)}, transparent 34%), radial-gradient(circle at 86% 6%, ${withAlpha(from, 0.29)}, transparent 30%), linear-gradient(180deg, ${option.from} 0%, ${option.to} 65%, ${rgbToHex(mix(to, { r: 0, g: 0, b: 0 }, 0.3))} 100%)`,
    detailOverlay: createEmojiOverlay(option.emoji),
    detailOverlaySize: "240px 240px",
    accentColor: rgbToHex(accent),
    accentTextColor: relativeLuminance(accent) > 0.5 ? "#132312" : "#f5fff2",
  };
}

const STATIC_THEME_DETAILS: Record<Exclude<EventThemeId, "minimal" | "emoji">, ThemeInfo> = {
  pattern: {
    id: "pattern",
    label: "Pattern",
    preview: "linear-gradient(145deg, #6f54ff 0%, #5f8fff 50%, #95a1ff 100%)",
    heroGradient: "linear-gradient(145deg, #6f54ff 0%, #5f8fff 50%, #95a1ff 100%)",
    cardGradient: "linear-gradient(145deg, #6247ff 0%, #5c86f7 48%, #8f99f5 100%)",
    pageBackground:
      "radial-gradient(circle at 15% 0%, rgba(111,84,255,0.34), transparent 31%), radial-gradient(circle at 88% 0%, rgba(95,143,255,0.3), transparent 28%), linear-gradient(180deg, #1e1742 0%, #171237 50%, #110d29 100%)",
    detailBackground:
      "radial-gradient(circle at 14% 0%, rgba(111,84,255,0.4), transparent 32%), radial-gradient(circle at 86% 8%, rgba(95,143,255,0.34), transparent 30%), linear-gradient(180deg, #1e1742 0%, #171237 52%, #110d29 100%)",
    detailOverlay: PATTERN_OVERLAY,
    accentColor: "#8f9bff",
    accentTextColor: "#181335",
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
  return EVENT_THEME_OPTIONS.some((option) => option.id === value);
}

function isFontPreset(value: string): value is EventFontPreset {
  return EVENT_FONT_PRESETS.includes(value as EventFontPreset);
}

function isEmojiSymbol(value: string): boolean {
  return EVENT_EMOJI_OPTIONS.some((option) => option.emoji === value);
}

export function normalizeEventThemeId(themeId?: string): EventThemeId {
  if (!themeId) return DEFAULT_THEME_ID;
  return isThemeId(themeId) ? themeId : DEFAULT_THEME_ID;
}

export function normalizeEventFontPreset(fontPreset?: string): EventFontPreset {
  if (!fontPreset) return DEFAULT_FONT_PRESET;
  return isFontPreset(fontPreset) ? fontPreset : DEFAULT_FONT_PRESET;
}

export function normalizeEventThemeColor(themeId?: string, themeColor?: string): string {
  const normalizedTheme = normalizeEventThemeId(themeId);
  if (normalizedTheme !== "minimal") return "";
  return normalizeHexColor(themeColor) ?? DEFAULT_MINIMAL_THEME_COLOR;
}

export function normalizeEventEmojiSymbol(themeId?: string, emojiSymbol?: string): string {
  const normalizedTheme = normalizeEventThemeId(themeId);
  if (normalizedTheme !== "emoji") return "";
  if (!emojiSymbol) return DEFAULT_EMOJI_SYMBOL;
  return isEmojiSymbol(emojiSymbol) ? emojiSymbol : DEFAULT_EMOJI_SYMBOL;
}

export function getEventTheme(themeId?: string, themeColor?: string, emojiSymbol?: string): ThemeInfo {
  const normalizedTheme = normalizeEventThemeId(themeId);
  if (normalizedTheme === "minimal") {
    return buildMinimalTheme(normalizeEventThemeColor("minimal", themeColor));
  }
  if (normalizedTheme === "emoji") {
    return buildEmojiTheme(normalizeEventEmojiSymbol("emoji", emojiSymbol));
  }
  return STATIC_THEME_DETAILS[normalizedTheme];
}

export function getEventFontFamily(fontPreset?: string): string {
  const key = normalizeEventFontPreset(fontPreset);
  return FONT_FAMILY_BY_PRESET[key];
}

export function resolveEventAppearance(
  event?: Pick<Event, "themeId" | "fontPreset" | "themeColor" | "emojiSymbol"> | null,
): {
  themeId: EventThemeId;
  fontPreset: EventFontPreset;
  themeColor: string;
  emojiSymbol: string;
  theme: ThemeInfo;
  fontFamily: string;
} {
  const themeId = normalizeEventThemeId(event?.themeId);
  const fontPreset = normalizeEventFontPreset(event?.fontPreset);
  const themeColor = normalizeEventThemeColor(themeId, event?.themeColor);
  const emojiSymbol = normalizeEventEmojiSymbol(themeId, event?.emojiSymbol);

  return {
    themeId,
    fontPreset,
    themeColor,
    emojiSymbol,
    theme: getEventTheme(themeId, themeColor, emojiSymbol),
    fontFamily: FONT_FAMILY_BY_PRESET[fontPreset],
  };
}
