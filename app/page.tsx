"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ChevronRight, Zap, Shield, Globe, X, Calendar, SearchX, AlertTriangle } from "lucide-react";
import { useEvents } from "@/hooks/useEvent";
import { EventCard, EventCardSkeleton } from "@/components/EventCard";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { FilterBar, DEFAULT_FILTERS } from "@/components/FilterBar";
import type { FilterState } from "@/components/FilterBar";
import type { EventFilters } from "@/lib/arkiv/queries/events";
import type { Event, EventStatus } from "@/lib/arkiv/types";

const CATEGORIES = ["All", "DeFi", "NFT", "Gaming", "IRL", "Virtual", "Infrastructure", "DAO", "Education", "Other"];

export default function HomePage() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [activeCategory, setActiveCategory] = useState("All");
  const [visibleCount, setVisibleCount] = useState(9);

  // Compose Arkiv-level filters — category pills + FilterBar all go on-chain
  const eventFilters = useMemo<EventFilters | undefined>(() => {
    const f: EventFilters = {};
    // Category from FilterBar dropdown
    if (filters.category) f.category = filters.category;
    // Category from pills — overrides dropdown when not "All"
    if (activeCategory !== "All") f.category = activeCategory;
    // location is filtered client-side (substring match); omit from on-chain exact-match query
    if (filters.status) f.status = filters.status as EventStatus;
    if (filters.dateFrom)
      f.dateFrom = Math.floor(new Date(filters.dateFrom).getTime() / 1_000);
    if (filters.dateTo)
      f.dateTo = Math.floor(
        new Date(filters.dateTo + "T23:59:59").getTime() / 1_000,
      );
    return Object.keys(f).length ? f : undefined;
  }, [filters, activeCategory]);

  const { events: rawEvents, isLoading, error } = useEvents(eventFilters);

  
  // Client-side filters: keyword (full-text) and location (substring) only.
  // Category is now an Arkiv-level query — no matchesCat needed here.
  const events = useMemo(() => {
    const kw = filters.keyword.trim().toLowerCase();
    const loc = filters.location.trim().toLowerCase();
    return rawEvents.filter((entity) => {
      const ev = entity.toJson() as Event;
      const matchesKw =
        !kw ||
        ev.title.toLowerCase().includes(kw) ||
        ev.description.toLowerCase().includes(kw);
      const matchesLoc =
        !loc || ev.location.toLowerCase().includes(loc);
      return matchesKw && matchesLoc;
    });
  }, [rawEvents, filters.keyword, filters.location]);

  const visibleEvents = events.slice(0, visibleCount);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Navbar active="browse" />

      {}
      <section className="relative overflow-hidden border-b border-white/5 bg-zinc-950">
        {}
        <div className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, #7c3aed 1px, transparent 0)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="relative mx-auto max-w-4xl px-4 py-20 sm:px-6 text-center">
          {}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-700/30 bg-violet-950/30 px-3 py-1 text-xs font-medium text-violet-300">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
            Event management · Kaolin Testnet
          </div>

          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl leading-tight">
            Discover and host
            <br />
            <span className="text-violet-400">
              events
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base text-zinc-400 sm:text-lg">
            Own your events. Own your community. All data lives on Arkiv — no backend, no middleman.
          </p>

          {}
          <div className="mt-8 mx-auto max-w-lg">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Search events by name or description…"
                value={filters.keyword}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, keyword: e.target.value }))
                }
                className="w-full rounded-full border border-white/10 bg-zinc-800 pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/30 transition shadow-sm"
              />
              {filters.keyword && (
                <button
                  onClick={() => setFilters((f) => ({ ...f, keyword: "" }))}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#events"
              className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition-colors"
            >
              Browse Events
              <ChevronRight size={14} />
            </a>
            <Link
              href="/organizer/onboard"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-6 py-2.5 text-sm font-semibold text-zinc-300 hover:border-white/20 hover:text-white transition-colors"
            >
              Host an Event
            </Link>
          </div>

          {}
          <div className="mt-12 grid grid-cols-3 gap-4 max-w-sm mx-auto sm:max-w-md sm:grid-cols-3">
            <div className="flex flex-col items-center gap-1.5 rounded-xl border border-white/5 bg-zinc-900 p-3">
              <Shield size={16} className="text-violet-400" />
              <span className="text-xs font-medium text-zinc-400">Wallet-owned</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 rounded-xl border border-white/5 bg-zinc-900 p-3">
              <Zap size={16} className="text-violet-400" />
              <span className="text-xs font-medium text-zinc-400">No backend</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 rounded-xl border border-white/5 bg-zinc-900 p-3">
              <Globe size={16} className="text-violet-400" />
              <span className="text-xs font-medium text-zinc-400">Public access</span>
            </div>
          </div>
        </div>
      </section>

      {}
      <section id="events" className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        {}
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">
              {filters.status === "live" ? "Live Now" : "Upcoming Events"}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Discover events happening around the world
            </p>
          </div>
          {!isLoading && !error && (
            <span className="text-sm text-zinc-600">
              {events.length} event{events.length !== 1 ? "s" : ""} found
            </span>
          )}
        </div>

        {}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                activeCategory === cat
                  ? "bg-violet-600 text-white"
                  : "border border-white/10 text-zinc-400 hover:border-white/20 hover:text-white"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {}
        <div className="mb-8">
          <FilterBar
            filters={filters}
            onChange={setFilters}
            onClear={() => setFilters(DEFAULT_FILTERS)}
            showKeyword={false}
          />
        </div>

        {}
        {error ? (
          <ErrorState message={error} onRetry={() => window.location.reload()} />
        ) : isLoading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <EventCardSkeleton key={i} />
            ))}
          </div>
        ) : events.length === 0 ? (
          <EmptyState hasFilters={
            filters.keyword !== "" ||
            filters.category !== "" ||
            filters.location !== "" ||
            filters.dateFrom !== "" ||
            filters.dateTo !== "" ||
            filters.status !== "" ||
            activeCategory !== "All"
          } onClear={() => { setFilters(DEFAULT_FILTERS); setActiveCategory("All"); }} />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {visibleEvents.map((entity) => {
                const event = entity.toJson() as Event;
                return (
                  <EventCard key={entity.key} entity={entity} event={event} />
                );
              })}
            </div>

            {}
            {visibleCount < events.length && (
              <div className="mt-12 flex justify-center">
                <button
                  onClick={() => setVisibleCount((c) => c + 9)}
                className="rounded-full border border-white/10 px-8 py-3 text-sm font-semibold text-zinc-300 hover:border-white/20 hover:text-white transition-colors"
                >
                  Load more events ({events.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <Footer />
    </div>
  );
}

function EmptyState({ hasFilters, onClear }: { hasFilters?: boolean; onClear?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-20 px-6 text-center">
      <div className="mb-4 text-4xl">{hasFilters ? "🔍" : "🗓"}</div>
      <h3 className="text-base font-semibold text-gray-900">
        {hasFilters ? "No matching events" : "No upcoming events yet"}
      </h3>
      <p className="mt-2 max-w-xs text-sm text-gray-500">
        {hasFilters
          ? "Try adjusting your filters or clearing your search."
          : "Be the first to host an event."}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {hasFilters && onClear && (
          <button
            onClick={onClear}
            className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-white hover:border-gray-300 transition-colors"
          >
            Clear filters
          </button>
        )}
        <Link
          href="/organizer/onboard"
          className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-5 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        >
          Host an Event
        </Link>
      </div>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-red-800/30 bg-red-950/10 py-16 px-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-950/40 border border-red-700/30">
        <AlertTriangle size={22} className="text-red-400" />
      </div>
      <h3 className="text-base font-semibold text-white">
        Failed to load events
      </h3>
      <p className="mt-2 max-w-xs text-xs text-red-400 font-mono break-all">
        {message}
      </p>
      <button
        onClick={onRetry}
        className="mt-6 rounded-full border border-red-800/40 px-5 py-2 text-sm font-semibold text-red-400 hover:bg-red-950/30 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}