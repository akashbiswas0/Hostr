"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AlertTriangle, MapPin, Search, Signal, Users } from "lucide-react";
import type { Entity } from "@arkiv-network/sdk";
import { Navbar } from "@/components/Navbar";
import { useEvents } from "@/hooks/useEvent";
import { useEventImage } from "@/hooks/useEventImage";
import { resolveEventAppearance } from "@/lib/eventAppearance";
import type { Event } from "@/lib/arkiv/types";

type TimelineGroup = {
  key: string;
  dayLabel: string;
  weekday: string;
  items: Array<{ entity: Entity; event: Event; startMs: number }>;
};

function toMs(value: unknown): number {
  if (value == null || value === "") return NaN;
  if (typeof value === "number") return Number.isFinite(value) ? value * 1_000 : NaN;
  const str = String(value);
  if (/^\d+$/.test(str)) return Number(str) * 1_000;
  const parsed = Date.parse(str);
  return Number.isNaN(parsed) ? NaN : parsed;
}

function formatDay(ms: number): string {
  if (Number.isNaN(ms)) return "Date TBD";
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short" }).format(new Date(ms));
}

function formatWeekday(ms: number): string {
  if (Number.isNaN(ms)) return "";
  return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date(ms));
}

function formatTime(ms: number): string {
  if (Number.isNaN(ms)) return "Time TBD";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ms));
}

function groupByDay(entities: Entity[]): TimelineGroup[] {
  const grouped = new Map<string, TimelineGroup>();

  for (const entity of entities) {
    const event = entity.toJson() as Event;
    const startMs = toMs(event.date);
    const date = Number.isNaN(startMs) ? new Date(0) : new Date(startMs);
    const dayKey = Number.isNaN(startMs)
      ? `tbd-${entity.key}`
      : `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const existing = grouped.get(dayKey);
    if (existing) {
      existing.items.push({ entity, event, startMs });
      continue;
    }
    grouped.set(dayKey, {
      key: dayKey,
      dayLabel: formatDay(startMs),
      weekday: formatWeekday(startMs),
      items: [{ entity, event, startMs }],
    });
  }

  const sorted = Array.from(grouped.values()).sort((a, b) => {
    const aMs = a.items[0]?.startMs ?? Number.MAX_SAFE_INTEGER;
    const bMs = b.items[0]?.startMs ?? Number.MAX_SAFE_INTEGER;
    return aMs - bMs;
  });

  for (const group of sorted) {
    group.items.sort((a, b) => a.startMs - b.startMs);
  }

  return sorted;
}

export default function AllEventsTimelinePage() {
  const { events, isLoading, error } = useEvents();
  const defaultAppearance = resolveEventAppearance(null);
  const groups = useMemo(() => groupByDay(events), [events]);

  return (
    <div
      className="min-h-screen text-white"
      style={{ background: defaultAppearance.theme.pageBackground }}
    >
      <Navbar active="events" />

      <main
        className="mx-auto max-w-4xl px-4 pb-16 pt-8 sm:px-6"
      >
        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight">Events</h1>
          <div className="flex items-center gap-2">
            <Link
              href="/organizer/events/create"
              className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-sm font-semibold text-zinc-100 hover:bg-white/20"
            >
              + Submit Event
            </Link>
            <button type="button" className="rounded-xl border border-white/15 bg-white/10 p-2 text-zinc-200">
              <Signal size={16} />
            </button>
            <button type="button" className="rounded-xl border border-white/15 bg-white/10 p-2 text-zinc-200">
              <Search size={16} />
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-5">
            <div className="flex items-center gap-2 text-rose-300">
              <AlertTriangle size={15} />
              <p className="text-sm font-semibold">Could not load events</p>
            </div>
            <p className="mt-2 text-xs text-rose-200/80">{error}</p>
          </div>
        ) : isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-28 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-6 py-12 text-center">
            <p className="text-sm text-zinc-300">No events available yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <section key={group.key} className="relative pl-7">
                <span className="absolute left-[5px] top-3 h-2.5 w-2.5 rounded-full bg-zinc-400" />
                <div className="mb-3 flex items-baseline gap-2">
                  <h2 className="text-xl font-bold text-white">{group.dayLabel}</h2>
                  <p className="text-lg text-zinc-400">{group.weekday}</p>
                </div>

                <div className="space-y-3 border-l border-dashed border-white/15 pl-6">
                  {group.items.map((item) => (
                    <TimelineCard key={item.entity.key as string} entity={item.entity} event={item.event} startMs={item.startMs} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function TimelineCard({
  entity,
  event,
  startMs,
}: {
  entity: Entity;
  event: Event;
  startMs: number;
}) {
  const appearance = resolveEventAppearance(event);
  const imgUrl = useEventImage(event.imageUrl);
  const rsvpCount = Number(entity.attributes.find((a) => a.key === "rsvpCount")?.value ?? 0);
  const isSoldOut = rsvpCount >= event.capacity && event.capacity > 0;
  const organizerNameAttr = entity.attributes.find((a) => a.key === "organizerName")?.value as string | undefined;
  const organizer = organizerNameAttr || "Community";

  return (
    <Link
      href={`/events/${entity.key}`}
      className="block rounded-xl border border-white/10 p-2.5 transition-colors hover:border-white/20"
      style={{
        background: "linear-gradient(120deg, rgba(33,33,33,0.86), rgba(38,38,38,0.86))",
      }}
    >
      <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_100px]">
        <div className="min-w-0">
          <p className="text-base font-medium text-zinc-300">{formatTime(startMs)}</p>
          <h3 className="mt-1 line-clamp-2 text-xl font-semibold leading-tight text-white">{event.title}</h3>

          <p className="mt-1 text-sm text-zinc-300">By {organizer}</p>
          <p className="mt-1 flex items-center gap-1 text-sm text-zinc-400">
            <MapPin size={14} className="shrink-0" />
            <span className="truncate">{event.location || "Online"}</span>
          </p>

          <div className="mt-2 flex items-center gap-2">
            {isSoldOut && (
              <span className="rounded-md bg-rose-500/20 px-2 py-1 text-xs font-semibold text-rose-300">
                Sold Out
              </span>
            )}
            <span className="flex items-center gap-1 text-xs text-zinc-400">
              <Users size={12} />
              {rsvpCount} / {event.capacity} attending
            </span>
          </div>
        </div>

        <div className="aspect-square w-full overflow-hidden rounded-xl border border-white/15 bg-zinc-900">
          {imgUrl ? (
            <img src={imgUrl} alt={event.title} className="h-full w-full aspect-square object-cover" />
          ) : (
            <div className="h-full w-full aspect-square" style={{ background: appearance.theme.cardGradient }} />
          )}
        </div>
      </div>
    </Link>
  );
}
