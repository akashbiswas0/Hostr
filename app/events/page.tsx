"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bitcoin,
  Bot,
  Clock3,
  Cpu,
  Dumbbell,
  Flower2,
  Leaf,
  Loader2,
  MapPin,
  Palette,
  Sparkles,
  Soup,
  type LucideIcon,
} from "lucide-react";

import { EventCardSkeleton } from "@/components/EventCard";
import { Navbar } from "@/components/Navbar";
import {
  DEFAULT_FILTERS,
  FilterBar,
  type FilterState,
} from "@/components/FilterBar";
import { useEvents } from "@/hooks/useEvent";
import { useEventImage } from "@/hooks/useEventImage";
import { EVENT_CATEGORIES, type Category } from "@/lib/arkiv/categories";
import type { Event } from "@/lib/arkiv/types";
import { resolveEventAppearance } from "@/lib/eventAppearance";

const CATEGORY_META: Record<Category, { icon: LucideIcon; iconClass: string }> = {
  Tech: { icon: Cpu, iconClass: "text-amber-300" },
  "Food & Drink": { icon: Soup, iconClass: "text-orange-300" },
  AI: { icon: Bot, iconClass: "text-pink-300" },
  "Arts & Culture": { icon: Palette, iconClass: "text-lime-300" },
  Climate: { icon: Leaf, iconClass: "text-green-300" },
  Fitness: { icon: Dumbbell, iconClass: "text-red-300" },
  Wellness: { icon: Flower2, iconClass: "text-cyan-300" },
  Crypto: { icon: Bitcoin, iconClass: "text-violet-300" },
};

type SearchMode = "ai" | "manual";

type AiSearchResponse = {
  filters?: FilterState;
  error?: string;
};

function toUnixStartOfDay(date: string): number | undefined {
  if (!date) return undefined;
  const ms = Date.parse(`${date}T00:00:00.000Z`);
  if (Number.isNaN(ms)) return undefined;
  return Math.floor(ms / 1_000);
}

function toUnixEndOfDay(date: string): number | undefined {
  if (!date) return undefined;
  const ms = Date.parse(`${date}T23:59:59.000Z`);
  if (Number.isNaN(ms)) return undefined;
  return Math.floor(ms / 1_000);
}

function toMs(value: unknown): number {
  if (value == null || value === "") return NaN;
  if (typeof value === "number") return Number.isFinite(value) ? value * 1_000 : NaN;
  const str = String(value);
  if (/^\d+$/.test(str)) return Number(str) * 1_000;
  const parsed = Date.parse(str);
  return Number.isNaN(parsed) ? NaN : parsed;
}

function formatDateTime(value: unknown): string {
  const ms = toMs(value);
  if (Number.isNaN(ms)) return "Date TBD";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ms));
}

function getPrimaryLocationName(location: string): string {
  const trimmed = location.trim();
  if (!trimmed) return "Online";
  if (trimmed.toLowerCase() === "online") return "Online";
  const [primary] = trimmed.split(",");
  return primary?.trim() || trimmed;
}

function PopularThumb({ event }: { event: Event }) {
  const imgUrl = useEventImage(event.imageUrl);
  const appearance = resolveEventAppearance(event);
  return (
    <div className="relative aspect-square w-20 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-900">
      {imgUrl ? (
        <img src={imgUrl} alt={event.title} className="h-full w-full aspect-square object-cover" />
      ) : (
        <div
          className="h-full w-full aspect-square"
          style={{ background: appearance.theme.cardGradient }}
        />
      )}
    </div>
  );
}

export default function EventsPage() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [searchMode, setSearchMode] = useState<SearchMode>("ai");
  const [aiPrompt, setAiPrompt] = useState("");
  const [isApplyingAi, setIsApplyingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const defaultAppearance = resolveEventAppearance(null);

  const queryFilters = useMemo(() => {
    const isOnline: 0 | 1 | undefined =
      filters.format === "online"
        ? 1
        : filters.format === "in_person"
          ? 0
          : undefined;
    const hasImage: 0 | 1 | undefined =
      filters.hasImage === "with-image" ? 1 : undefined;

    return {
      category: filters.category || undefined,
      location: filters.location || undefined,
      dateFrom: toUnixStartOfDay(filters.dateFrom),
      dateTo: toUnixEndOfDay(filters.dateTo),
      status: filters.status || undefined,
      isOnline,
      keyword: filters.keyword || undefined,
      approvalMode: filters.approvalMode || undefined,
      hasImage,
      hasSeatsOnly: filters.availability === "open",
      format: filters.format || undefined,
    };
  }, [filters]);

  const { events, isLoading, error } = useEvents(queryFilters);
  const { events: allEvents } = useEvents();
  const popularEvents = useMemo(() => events.slice(0, 6), [events]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entity of events) {
      const event = entity.toJson() as Event;
      const key = event.category?.trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return EVENT_CATEGORIES.map((category) => [category, counts.get(category) ?? 0] as const);
  }, [events]);

  const locationCounts = useMemo(() => {
    const counts = new Map<string, { location: string; count: number }>();
    for (const entity of allEvents) {
      const event = entity.toJson() as Event;
      const location = (event.location || "Online").trim();
      if (!location) continue;
      const key = location.toLowerCase();
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, { location, count: 1 });
      }
    }
    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count || a.location.localeCompare(b.location))
      .slice(0, 16);
  }, [allEvents]);

  function clearFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  async function applyAiSearch() {
    const prompt = aiPrompt.trim();
    if (!prompt || isApplyingAi) return;

    setIsApplyingAi(true);
    setAiError(null);

    try {
      const response = await fetch("/api/ai-event-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const data = (await response.json()) as AiSearchResponse;
      if (!response.ok || !data.filters) {
        throw new Error(data.error || "AI search mapping failed.");
      }

      setFilters({ ...DEFAULT_FILTERS, ...data.filters });
      setSearchMode("ai");
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "AI search mapping failed.");
    } finally {
      setIsApplyingAi(false);
    }
  }

  return (
    <div
      className="relative min-h-screen overflow-hidden text-white"
      style={{ background: defaultAppearance.theme.pageBackground }}
    >

      <Navbar active="events" />

      <main
        className="relative mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6"
      >
        <header className="max-w-4xl">
          <h1 className="text-4xl font-bold tracking-tight">Discover Events</h1>
          <p className="mt-2 text-zinc-300">
            Ask in plain language, or switch to manual filters.
          </p>
        </header>

        <div className="mt-6 rounded-2xl border border-white/10 bg-transparent p-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-end">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">AI Search</label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-zinc-400">
                    <Sparkles size={15} />
                  </span>
                  <input
                    type="text"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void applyAiSearch();
                      }
                    }}
                    placeholder='Try: "show me events in New Delhi about food"'
                    className="w-full rounded-lg border border-white/10 bg-white/[0.03] py-2 pl-9 pr-3 text-sm text-white placeholder-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void applyAiSearch()}
                  disabled={isApplyingAi || !aiPrompt.trim()}
                  className="inline-flex min-w-[160px] items-center justify-center gap-2 rounded-lg border border-violet-400/30 bg-violet-500/20 px-4 py-2 text-sm font-semibold text-violet-100 transition-colors hover:bg-violet-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isApplyingAi ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Applying...
                    </>
                  ) : (
                    "Apply AI Search"
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">Search mode</label>
              <select
                value={searchMode}
                onChange={(e) => setSearchMode(e.target.value as SearchMode)}
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
              >
                <option value="ai">AI search</option>
                <option value="manual">Manual filters</option>
              </select>
            </div>
          </div>

          {aiError && (
            <p className="mt-3 rounded-lg border border-rose-400/30 bg-rose-900/25 px-3 py-2 text-xs text-rose-200">
              {aiError}
            </p>
          )}

          {searchMode === "manual" ? (
            <div className="mt-4">
              <FilterBar
                filters={filters}
                onChange={setFilters}
                onClear={clearFilters}
                showKeyword
              />
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="mt-10 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-6">
            <div className="flex items-center gap-2 text-rose-300">
              <AlertTriangle size={16} />
              <p className="text-sm font-semibold">Could not load events</p>
            </div>
            <p className="mt-2 break-all text-xs text-rose-200/80">{error}</p>
          </div>
        ) : isLoading ? (
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <EventCardSkeleton key={index} />
            ))}
          </div>
        ) : (
          <>
            <section className="mt-10">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-semibold">Popular Events</h2>
                  <p className="text-sm text-zinc-400">Ranked by current result set</p>
                </div>
                <Link
                  href="/events/all"
                  className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-zinc-300 hover:border-white/20 hover:text-white transition-colors"
                >
                  View all <ArrowRight size={14} />
                </Link>
              </div>

              {popularEvents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-6 py-12 text-center">
                  <p className="text-sm text-zinc-300">No events matched your filters.</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {popularEvents.map((entity) => {
                    const event = entity.toJson() as Event;
                    return (
                      <Link
                        key={entity.key}
                        href={`/events/${entity.key}`}
                        className="group flex items-center gap-4 rounded-2xl border border-white/10 p-3 transition-all hover:border-white/20"
                        style={{
                          background: "rgba(255, 255, 255, 0.04)",
                        }}
                      >
                        <PopularThumb event={event} />

                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="flex items-center gap-1 text-xs text-zinc-400">
                            <Clock3 size={12} /> {formatDateTime(event.date)}
                          </p>
                          <h3 className="truncate text-xl font-semibold text-white transition-colors group-hover:text-fuchsia-200">
                            {event.title}
                          </h3>
                          <p className="flex items-center gap-1 text-sm text-zinc-400">
                            <MapPin size={12} />
                            <span className="truncate">{event.location || "Online"}</span>
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="mt-10 border-t border-white/10 pt-8">
              <h2 className="text-3xl font-semibold">Browse by Category</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {categoryCounts.map(([category, count]) => {
                  const meta = CATEGORY_META[category];
                  const Icon = meta.icon;
                  return (
                    <button
                      key={category}
                      onClick={() => setFilters((prev) => ({ ...prev, category }))}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-left transition-all hover:border-white/20 hover:bg-white/[0.05]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-2">
                          <Icon size={18} className={meta.iconClass} />
                        </div>
                        <div>
                          <p className="text-lg font-semibold text-white">{category}</p>
                          <p className="mt-0.5 text-sm text-zinc-400">
                            {count} Event{count !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="mt-10 border-t border-white/10 pt-8">
              <h2 className="text-3xl font-semibold">Explore Local Events</h2>
              <p className="mt-2 text-sm text-zinc-400">Locations with at least one published event.</p>

              {locationCounts.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-6 py-10 text-center">
                  <p className="text-sm text-zinc-300">No event locations available yet.</p>
                </div>
              ) : (
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {locationCounts.map((item) => (
                    <button
                      key={item.location}
                      type="button"
                      onClick={() => setFilters((prev) => ({ ...prev, location: item.location }))}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left transition-colors hover:border-white/20 hover:bg-white/[0.05]"
                    >
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-fuchsia-500/25 text-fuchsia-200">
                          <MapPin size={16} />
                        </span>
                        <div>
                          <p className="font-semibold text-white">{getPrimaryLocationName(item.location)}</p>
                          <p className="text-sm text-zinc-400">{item.count} event{item.count > 1 ? "s" : ""}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
