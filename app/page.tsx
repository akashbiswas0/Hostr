"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Entity } from "@arkiv-network/sdk";
import type { Hex } from "viem";
import {
  AlertTriangle,
  CalendarDays,
  Clock3,
  MapPin,
  Sparkles,
} from "lucide-react";

import { ConnectButton } from "@/components/ConnectButton";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { useMyTickets } from "@/hooks/useTicket";
import { useWallet } from "@/hooks/useWallet";
import { useEventImage } from "@/hooks/useEventImage";
import { publicClient } from "@/lib/arkiv/client";
import { getEventByKey } from "@/lib/arkiv/queries/events";
import type { Event } from "@/lib/arkiv/types";

type TimelineView = "upcoming" | "past";

interface RegisteredEventItem {
  eventKey: Hex;
  eventEntity: Entity;
  event: Event;
  rsvpStatus: string;
  organizerName: string;
  dateMs: number;
}

interface DayGroup {
  key: string;
  label: string;
  weekday: string;
  sortMs: number;
  items: RegisteredEventItem[];
}

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-emerald-500/20 text-emerald-300 border border-emerald-400/25",
  pending: "bg-amber-500/20 text-amber-300 border border-amber-400/25",
  waitlisted: "bg-orange-500/20 text-orange-300 border border-orange-400/25",
  "checked-in": "bg-violet-500/20 text-violet-300 border border-violet-400/25",
  rejected: "bg-rose-500/20 text-rose-300 border border-rose-400/25",
};

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Going",
  pending: "Pending",
  waitlisted: "Waitlisted",
  "checked-in": "Checked in",
  rejected: "Rejected",
};

function toMs(value: unknown): number {
  if (value == null || value === "") return NaN;
  if (typeof value === "number") return Number.isFinite(value) ? value * 1_000 : NaN;
  const str = String(value);
  if (/^\d+$/.test(str)) return Number(str) * 1_000;
  const parsed = Date.parse(str);
  return Number.isNaN(parsed) ? NaN : parsed;
}

function formatTime(value: unknown): string {
  const ms = toMs(value);
  if (Number.isNaN(ms)) return "Time TBD";
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(ms));
}

function formatDay(value: number): string {
  if (Number.isNaN(value)) return "Date TBD";
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

function formatWeekday(value: number): string {
  if (Number.isNaN(value)) return "Upcoming";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
  }).format(new Date(value));
}

function truncateAddress(value?: string): string {
  if (!value) return "Unknown organizer";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function extractEventKey(entity: Entity): Hex | null {
  const raw = entity.attributes.find((attr) => attr.key === "eventKey")?.value;
  if (typeof raw !== "string") return null;
  return raw.startsWith("0x") ? (raw as Hex) : null;
}

function statusClass(status: string): string {
  return STATUS_STYLES[status] ?? "bg-zinc-700/40 text-zinc-300 border border-white/10";
}

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? "Registered";
}

function groupByDay(items: RegisteredEventItem[], view: TimelineView): DayGroup[] {
  const grouped = new Map<string, DayGroup>();

  for (const item of items) {
    const ms = item.dateMs;
    const key = Number.isNaN(ms)
      ? `tbd-${item.eventKey}`
      : `${new Date(ms).getFullYear()}-${new Date(ms).getMonth()}-${new Date(ms).getDate()}`;

    const existing = grouped.get(key);
    if (existing) {
      existing.items.push(item);
      continue;
    }

    grouped.set(key, {
      key,
      label: formatDay(ms),
      weekday: formatWeekday(ms),
      sortMs: Number.isNaN(ms)
        ? view === "upcoming"
          ? Number.MAX_SAFE_INTEGER
          : Number.MIN_SAFE_INTEGER
        : ms,
      items: [item],
    });
  }

  const groups = Array.from(grouped.values());
  groups.sort((a, b) => {
    if (view === "upcoming") return a.sortMs - b.sortMs;
    return b.sortMs - a.sortMs;
  });

  for (const group of groups) {
    group.items.sort((a, b) => {
      if (view === "upcoming") return a.dateMs - b.dateMs;
      return b.dateMs - a.dateMs;
    });
  }

  return groups;
}

export default function HomePage() {
  const [view, setView] = useState<TimelineView>("upcoming");
  const { address, isConnected, isCorrectChain } = useWallet();
  const {
    ticketEntities,
    isLoading: rsvpLoading,
    error: rsvpError,
  } = useMyTickets();

  const eventKeys = useMemo(
    () => ticketEntities.map(extractEventKey).filter((key): key is Hex => key !== null),
    [ticketEntities],
  );

  const registeredEventsQuery = useQuery({
    queryKey: ["home-registered-events", address, eventKeys.join("|")],
    enabled: isConnected && isCorrectChain && eventKeys.length > 0,
    queryFn: async () => {
      const uniqueKeys = Array.from(new Set(eventKeys));
      const lookups = await Promise.all(
        uniqueKeys.map(async (eventKey) => {
          const result = await getEventByKey(publicClient, eventKey);
          return { eventKey, result };
        }),
      );

      const eventMap = new Map<string, { eventEntity: Entity; event: Event }>();
      for (const lookup of lookups) {
        if (!lookup.result.success) continue;
        const eventEntity = lookup.result.data;
        eventMap.set(lookup.eventKey.toLowerCase(), {
          eventEntity,
          event: eventEntity.toJson() as Event,
        });
      }

      const items: RegisteredEventItem[] = [];
      for (const rsvpEntity of ticketEntities) {
        const eventKey = extractEventKey(rsvpEntity);
        if (!eventKey) continue;

        const match = eventMap.get(eventKey.toLowerCase());
        if (!match) continue;

        const status =
          String(rsvpEntity.attributes.find((attr) => attr.key === "status")?.value ?? "confirmed").toLowerCase();

        const organizerAttr = match.eventEntity.attributes.find((attr) => attr.key === "organizerName")?.value;
        const organizerName =
          typeof organizerAttr === "string" && organizerAttr.trim().length > 0
            ? organizerAttr
            : truncateAddress(match.eventEntity.owner);

        items.push({
          eventKey,
          eventEntity: match.eventEntity,
          event: match.event,
          rsvpStatus: status,
          organizerName,
          dateMs: toMs(match.event.date),
        });
      }

      return items;
    },
    staleTime: 30_000,
  });

  const filteredEvents = useMemo(() => {
    const source = registeredEventsQuery.data ?? [];

    const selected = source.filter((item) => {
      const isPast = item.event.status === "ended";
      return view === "upcoming" ? !isPast : isPast;
    });

    selected.sort((a, b) => {
      if (Number.isNaN(a.dateMs)) return 1;
      if (Number.isNaN(b.dateMs)) return -1;
      if (view === "upcoming") return a.dateMs - b.dateMs;
      return b.dateMs - a.dateMs;
    });

    return selected;
  }, [registeredEventsQuery.data, view]);

  const groupedEvents = useMemo(
    () => groupByDay(filteredEvents, view),
    [filteredEvents, view],
  );

  const isLoading = rsvpLoading || registeredEventsQuery.isLoading;
  const error = rsvpError || (registeredEventsQuery.error instanceof Error ? registeredEventsQuery.error.message : null);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#060912] text-white">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 18% 0%, rgba(37,99,235,0.28), transparent 36%), radial-gradient(circle at 80% 2%, rgba(99,102,241,0.22), transparent 30%), linear-gradient(180deg, #0a1120 0%, #060912 55%)",
        }}
      />

      <Navbar active="home" />

      <main className="relative mx-auto max-w-5xl px-4 pb-14 pt-10 sm:px-6">
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-300">
              <Sparkles size={12} className="text-violet-300" />
              Home timeline
            </span>
            <h1 className="mt-4 text-4xl font-bold tracking-tight">Events</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Registered events from your wallet.
            </p>
          </div>

          <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
            <button
              onClick={() => setView("upcoming")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                view === "upcoming"
                  ? "bg-white/10 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Upcoming
            </button>
            <button
              onClick={() => setView("past")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                view === "past" ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              Past
            </button>
          </div>
        </div>

        {!isConnected ? (
          <EmptyState
            title="No registered events"
            description="Connect your wallet, then discover events and RSVP to see them here."
            actions={
              <div className="flex flex-wrap justify-center gap-3">
                <ConnectButton />
                <Link
                  href="/events"
                  className="inline-flex items-center rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-zinc-200 hover:border-white/20 hover:text-white transition-colors"
                >
                  Discover events
                </Link>
              </div>
            }
          />
        ) : !isCorrectChain ? (
          <EmptyState
            title="Switch to Kaolin"
            description="Your wallet is connected on a different network."
            actions={<ConnectButton />}
          />
        ) : isLoading ? (
          <TimelineSkeleton />
        ) : error ? (
          <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-6">
            <div className="flex items-center gap-2 text-rose-300">
              <AlertTriangle size={16} />
              <p className="text-sm font-semibold">Could not load your events</p>
            </div>
            <p className="mt-2 break-all text-xs text-rose-200/80">{error}</p>
          </div>
        ) : groupedEvents.length === 0 ? (
          <EmptyState
            title={view === "upcoming" ? "No upcoming registrations" : "No past registrations"}
            description={
              view === "upcoming"
                ? "Discover events and RSVP to see them on your home timeline."
                : "You do not have past registered events yet."
            }
            actions={
              <Link
                href="/events"
                className="inline-flex items-center rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition-colors"
              >
                Discover events
              </Link>
            }
          />
        ) : (
          <div className="space-y-8">
            {groupedEvents.map((group) => (
              <section key={group.key} className="grid gap-4 md:grid-cols-[150px_1fr] md:gap-8">
                <div className="md:pt-4">
                  <p className="text-lg font-semibold text-zinc-100">{group.label}</p>
                  <p className="text-sm text-zinc-400">{group.weekday}</p>
                </div>

                <div className="relative md:pl-7">
                  <div className="absolute bottom-0 left-0 top-0 hidden w-px bg-gradient-to-b from-white/30 via-white/10 to-transparent md:block" />

                  <div className="space-y-4">
                    {group.items.map((item) => (
                      <Link
                        key={`${group.key}-${item.eventKey}`}
                        href={`/events/${item.eventEntity.key}`}
                        className="group relative block overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/[0.06]"
                      >
                        <div className="absolute -left-[28px] top-7 hidden h-3 w-3 rounded-full border border-white/25 bg-zinc-300 md:block" />

                        <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start sm:justify-between sm:p-3.5">
                          <div className="min-w-0 flex-1 space-y-2">
                            <p className="flex items-center gap-1.5 text-sm text-zinc-400">
                              <Clock3 size={14} className="shrink-0" />
                              {formatTime(item.event.date)}
                            </p>

                            <h2 className="text-lg font-semibold leading-tight text-white group-hover:text-violet-200 transition-colors">
                              {item.event.title}
                            </h2>

                            <p className="text-xs text-zinc-300">By {item.organizerName}</p>

                            <p className="flex items-center gap-1.5 text-xs text-zinc-400">
                              <MapPin size={14} className="shrink-0" />
                              <span className="truncate">{item.event.location || "Online"}</span>
                            </p>

                            <span
                              className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${statusClass(item.rsvpStatus)}`}
                            >
                              {statusLabel(item.rsvpStatus)}
                            </span>
                          </div>

                          <EventImage event={item.event} />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

function EventImage({ event }: { event: Event }) {
  const imgUrl = useEventImage(event.imageUrl);
  const [imgError, setImgError] = useState(false);

  const showImage = imgUrl && !imgError;

  return (
    <div className="relative aspect-square w-20 shrink-0 overflow-hidden rounded-lg border border-white/10 sm:w-28">
      {showImage ? (
        <img
          src={imgUrl}
          alt={event.title}
          className="h-full w-full aspect-square object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <div
          className="h-full w-full aspect-square"
          style={{ backgroundImage: "linear-gradient(140deg, rgba(59,130,246,0.35), rgba(124,58,237,0.35))" }}
        />
      )}
      <span className="absolute bottom-2 left-2 rounded-md bg-black/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-100 backdrop-blur-sm">
        {event.category || "Event"}
      </span>
    </div>
  );
}

function EmptyState({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-6 py-14 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/[0.04]">
        <CalendarDays size={22} className="text-zinc-400" />
      </div>
      <h2 className="mt-5 text-lg font-semibold text-white">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">{description}</p>
      <div className="mt-6">{actions}</div>
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="grid gap-4 md:grid-cols-[150px_1fr] md:gap-8">
          <div className="space-y-2">
            <div className="h-5 w-20 rounded bg-zinc-800" />
            <div className="h-4 w-28 rounded bg-zinc-800" />
          </div>
          <div className="space-y-3">
            <div className="h-24 rounded-xl border border-white/10 bg-white/[0.04]" />
          </div>
        </div>
      ))}
    </div>
  );
}
