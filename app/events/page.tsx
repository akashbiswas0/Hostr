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
  MapPin,
  Palette,
  Soup,
  type LucideIcon,
} from "lucide-react";

import { EventCard, EventCardSkeleton } from "@/components/EventCard";
import { Footer } from "@/components/Footer";
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

function PopularThumb({ event }: { event: Event }) {
  const imgUrl = useEventImage(event.imageUrl);
  return (
    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-900">
      {imgUrl ? (
        <img src={imgUrl} alt={event.title} className="h-full w-full object-cover" />
      ) : (
        <div
          className="h-full w-full"
          style={{ backgroundImage: "linear-gradient(140deg, rgba(59,130,246,0.35), rgba(124,58,237,0.35))" }}
        />
      )}
    </div>
  );
}

export default function EventsPage() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

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

  function clearFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#060912] text-white">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 18% 0%, rgba(37,99,235,0.25), transparent 38%), radial-gradient(circle at 85% 2%, rgba(99,102,241,0.2), transparent 31%), linear-gradient(180deg, #0a1120 0%, #060912 55%)",
        }}
      />

      <Navbar active="events" />

      <main className="relative mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6">
        <header className="max-w-4xl">
          <h1 className="text-4xl font-bold tracking-tight">Discover Events</h1>
          <p className="mt-2 text-zinc-300">
            Explore with Arkiv-native filters and keyword search.
          </p>
        </header>

        <div className="mt-6">
          <FilterBar
            filters={filters}
            onChange={setFilters}
            onClear={clearFilters}
            showKeyword
          />
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
                  href="#all-events"
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
                        className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition-all hover:border-white/20 hover:bg-white/[0.05]"
                      >
                        <PopularThumb event={event} />

                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="flex items-center gap-1 text-xs text-zinc-400">
                            <Clock3 size={12} /> {formatDateTime(event.date)}
                          </p>
                          <h3 className="truncate text-xl font-semibold text-white group-hover:text-violet-200 transition-colors">
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

            <section id="all-events" className="mt-10 border-t border-white/10 pt-8">
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-semibold">All Events</h2>
                  <p className="text-sm text-zinc-400">
                    {events.length} event{events.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {events.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-6 py-12 text-center">
                  <p className="text-sm text-zinc-300">No events matched your filters.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {events.map((entity) => {
                    const event = entity.toJson() as Event;
                    return <EventCard key={entity.key} entity={entity} event={event} />;
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
