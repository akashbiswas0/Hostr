"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Clock3,
  MapPin,
  Search,
} from "lucide-react";

import { EventCard, EventCardSkeleton } from "@/components/EventCard";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { useEvents } from "@/hooks/useEvent";
import type { Event } from "@/lib/arkiv/types";

const CATEGORY_COLORS = [
  "text-amber-300",
  "text-cyan-300",
  "text-violet-300",
  "text-emerald-300",
  "text-rose-300",
  "text-lime-300",
  "text-orange-300",
  "text-sky-300",
];

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

export default function EventsPage() {
  const [keyword, setKeyword] = useState("");
  const { events: rawEvents, isLoading, error } = useEvents();

  const events = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return rawEvents;

    return rawEvents.filter((entity) => {
      const event = entity.toJson() as Event;
      return (
        (event.title ?? "").toLowerCase().includes(q) ||
        (event.description ?? "").toLowerCase().includes(q) ||
        (event.location ?? "").toLowerCase().includes(q) ||
        (event.category ?? "").toLowerCase().includes(q)
      );
    });
  }, [rawEvents, keyword]);

  const popularEvents = useMemo(() => events.slice(0, 6), [events]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entity of events) {
      const event = entity.toJson() as Event;
      const key = event.category?.trim() || "Other";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [events]);

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

      <main className="relative mx-auto max-w-5xl px-4 pb-16 pt-10 sm:px-6">
        <header className="max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight">Discover Events</h1>
          <p className="mt-2 text-zinc-300">
            Explore popular events near you, browse by category, and RSVP instantly.
          </p>

          <div className="relative mt-6 max-w-xl">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Search by title, location, or category"
              className="w-full rounded-full border border-white/10 bg-white/[0.03] py-3 pl-10 pr-4 text-sm text-white placeholder-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
            />
          </div>
        </header>

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
                  <p className="text-sm text-zinc-400">Trending right now</p>
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
                  <p className="text-sm text-zinc-300">No events matched your search.</p>
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
                        <div
                          className="h-20 w-20 shrink-0 rounded-xl border border-white/10 bg-zinc-900"
                          style={
                            event.imageUrl
                              ? {
                                  backgroundImage: `linear-gradient(180deg, rgba(10,17,32,0.15), rgba(10,17,32,0.35)), url(${event.imageUrl})`,
                                  backgroundSize: "cover",
                                  backgroundPosition: "center",
                                }
                              : {
                                  backgroundImage:
                                    "linear-gradient(140deg, rgba(59, 130, 246, 0.35), rgba(124, 58, 237, 0.35))",
                                }
                          }
                        />

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
              {categoryCounts.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-400">No categories available yet.</p>
              ) : (
                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {categoryCounts.map(([category, count], index) => (
                    <button
                      key={category}
                      onClick={() => setKeyword(category)}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-left transition-all hover:border-white/20 hover:bg-white/[0.05]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-lg font-semibold text-white">{category}</p>
                        <Calendar size={16} className={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                      </div>
                      <p className="mt-1 text-sm text-zinc-400">{count} event{count !== 1 ? "s" : ""}</p>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section id="all-events" className="mt-10 border-t border-white/10 pt-8">
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-semibold">All Events</h2>
                  <p className="text-sm text-zinc-400">{events.length} event{events.length !== 1 ? "s" : ""}</p>
                </div>
              </div>

              {events.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-6 py-12 text-center">
                  <p className="text-sm text-zinc-300">No events matched your search.</p>
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
