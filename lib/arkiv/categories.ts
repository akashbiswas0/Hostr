export const EVENT_CATEGORIES = [
  "Tech",
  "Food & Drink",
  "AI",
  "Arts & Culture",
  "Climate",
  "Fitness",
  "Wellness",
  "Crypto",
] as const;

export type Category = (typeof EVENT_CATEGORIES)[number];

export const CATEGORY_STYLE: Record<
  Category,
  { cardGradient: string; badge: string; heroGradient: string }
> = {
  Tech: {
    cardGradient: "from-amber-400 to-orange-500",
    badge: "bg-white/90 text-amber-700",
    heroGradient: "from-amber-900 to-orange-950",
  },
  "Food & Drink": {
    cardGradient: "from-orange-400 to-amber-500",
    badge: "bg-white/90 text-orange-700",
    heroGradient: "from-orange-900 to-amber-950",
  },
  AI: {
    cardGradient: "from-pink-400 to-fuchsia-500",
    badge: "bg-white/90 text-pink-700",
    heroGradient: "from-pink-900 to-fuchsia-950",
  },
  "Arts & Culture": {
    cardGradient: "from-lime-400 to-green-500",
    badge: "bg-white/90 text-lime-700",
    heroGradient: "from-lime-900 to-green-950",
  },
  Climate: {
    cardGradient: "from-green-400 to-emerald-500",
    badge: "bg-white/90 text-green-700",
    heroGradient: "from-green-900 to-emerald-950",
  },
  Fitness: {
    cardGradient: "from-orange-500 to-red-500",
    badge: "bg-white/90 text-orange-700",
    heroGradient: "from-orange-900 to-red-950",
  },
  Wellness: {
    cardGradient: "from-cyan-400 to-sky-500",
    badge: "bg-white/90 text-cyan-700",
    heroGradient: "from-cyan-900 to-sky-950",
  },
  Crypto: {
    cardGradient: "from-violet-400 to-purple-500",
    badge: "bg-white/90 text-violet-700",
    heroGradient: "from-violet-900 to-purple-950",
  },
};

export const DEFAULT_CATEGORY_STYLE = {
  cardGradient: "from-gray-400 to-gray-500",
  badge: "bg-white/90 text-gray-700",
  heroGradient: "from-zinc-800 to-zinc-900",
} as const;
