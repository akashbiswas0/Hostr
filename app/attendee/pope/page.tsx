"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Entity } from "@arkiv-network/sdk";
import type { Hex } from "viem";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarDays,
  Clock3,
  MapPin,
} from "lucide-react";

import { ConnectButton } from "@/components/ConnectButton";
import { Navbar } from "@/components/Navbar";
import { useEventImage } from "@/hooks/useEventImage";
import { useWallet } from "@/hooks/useWallet";
import { publicClient } from "@/lib/arkiv/client";
import { getPoAsByAttendee } from "@/lib/arkiv/queries/attendance";
import { getEventByKey } from "@/lib/arkiv/queries/events";
import type { Event, ProofOfAttendance } from "@/lib/arkiv/types";
import { resolveEventAppearance } from "@/lib/eventAppearance";

const EXPLORER = "https://explorer.kaolin.hoodi.arkiv.network";

interface PopeTimelineItem {
  poaEntity: Entity;
  poa: ProofOfAttendance;
  eventEntity: Entity | null;
  event: Event | null;
  organizerName: string;
  startMs: number;
}

type TimelineGroup = {
  key: string;
  dayLabel: string;
  weekday: string;
  items: PopeTimelineItem[];
};

function toMs(value: unknown): number {
  if (value == null || value === "") return NaN;
  if (typeof value === "number") return Number.isFinite(value) ? value * 1_000 : NaN;
  const text = String(value);
  if (/^\d+$/.test(text)) return Number(text) * 1_000;
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? NaN : parsed;
}

function formatDay(ms: number): string {
  if (Number.isNaN(ms)) return "Date TBD";
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
  }).format(new Date(ms));
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

function formatCheckinTime(value: unknown): string {
  const ms = toMs(value);
  if (Number.isNaN(ms)) return "Checked in time unavailable";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ms));
}

function extractEventKey(entity: Entity): Hex | null {
  const fromAttrs = entity.attributes.find((attr) => attr.key === "eventKey")?.value;
  if (typeof fromAttrs === "string" && fromAttrs.startsWith("0x")) return fromAttrs as Hex;

  const payload = entity.toJson() as Partial<ProofOfAttendance>;
  if (typeof payload.eventKey === "string" && payload.eventKey.startsWith("0x")) return payload.eventKey as Hex;
  return null;
}

function truncateAddress(value?: string): string {
  if (!value) return "Unknown organizer";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function groupByDay(items: PopeTimelineItem[]): TimelineGroup[] {
  const grouped = new Map<string, TimelineGroup>();

  for (const item of items) {
    const startMs = item.startMs;
    const day = Number.isNaN(startMs) ? new Date(0) : new Date(startMs);
    const dayKey = Number.isNaN(startMs)
      ? `tbd-${item.poaEntity.key}`
      : `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;

    const existing = grouped.get(dayKey);
    if (existing) {
      existing.items.push(item);
      continue;
    }

    grouped.set(dayKey, {
      key: dayKey,
      dayLabel: formatDay(startMs),
      weekday: formatWeekday(startMs),
      items: [item],
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

export default function PopePage() {
  const { address, isConnected, isCorrectChain } = useWallet();
  const defaultAppearance = resolveEventAppearance(null);

  const popeQuery = useQuery({
    queryKey: ["attendee-pope", address],
    enabled: isConnected && isCorrectChain && !!address,
    queryFn: async () => {
      if (!address) return [];

      const poaResult = await getPoAsByAttendee(publicClient, address as Hex);
      if (!poaResult.success) throw new Error(poaResult.error);

      const poaEntities = poaResult.data;
      const eventKeys = Array.from(
        new Set(poaEntities.map(extractEventKey).filter((key): key is Hex => key !== null)),
      );

      const eventLookups = await Promise.all(
        eventKeys.map(async (eventKey) => {
          const result = await getEventByKey(publicClient, eventKey);
          return { eventKey, result };
        }),
      );

      const eventMap = new Map<string, { eventEntity: Entity; event: Event }>();
      for (const lookup of eventLookups) {
        if (!lookup.result.success) continue;
        const eventEntity = lookup.result.data;
        eventMap.set(lookup.eventKey.toLowerCase(), {
          eventEntity,
          event: eventEntity.toJson() as Event,
        });
      }

      const items: PopeTimelineItem[] = poaEntities.map((poaEntity) => {
        const poa = poaEntity.toJson() as ProofOfAttendance;
        const eventKey = extractEventKey(poaEntity);
        const eventMatch = eventKey ? eventMap.get(eventKey.toLowerCase()) : undefined;
        const organizerRaw = eventMatch?.eventEntity.attributes.find((attr) => attr.key === "organizerName")?.value;
        const organizerName =
          typeof organizerRaw === "string" && organizerRaw.trim().length > 0
            ? organizerRaw
            : truncateAddress(eventMatch?.eventEntity.owner);

        const startMs = toMs(eventMatch?.event.date ?? poa.checkedInAt ?? poa.issuedAt);
        return {
          poaEntity,
          poa,
          eventEntity: eventMatch?.eventEntity ?? null,
          event: eventMatch?.event ?? null,
          organizerName,
          startMs,
        };
      });

      items.sort((a, b) => {
        if (Number.isNaN(a.startMs)) return 1;
        if (Number.isNaN(b.startMs)) return -1;
        return a.startMs - b.startMs;
      });

      return items;
    },
    staleTime: 30_000,
  });

  const groups = useMemo(() => groupByDay(popeQuery.data ?? []), [popeQuery.data]);
  const error = popeQuery.error instanceof Error ? popeQuery.error.message : null;

  return (
    <div
      className="min-h-screen text-white"
      style={{ background: defaultAppearance.theme.pageBackground }}
    >
      <Navbar active="home" />

      <main
        className="mx-auto max-w-4xl px-4 pb-16 pt-8 sm:px-6"
        style={{ fontFamily: defaultAppearance.fontFamily }}
      >
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">POP</h1>
          <p className="mt-1 text-sm text-zinc-400">
            All POP items held by your connected wallet.
          </p>
        </div>

        {!isConnected ? (
          <EmptyState
            title="Connect your wallet"
            description="Connect to load your POP collection."
            action={<ConnectButton />}
          />
        ) : !isCorrectChain ? (
          <EmptyState
            title="Switch to Kaolin"
            description="Your wallet is connected on a different network."
            action={<ConnectButton />}
          />
        ) : error ? (
          <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-5">
            <div className="flex items-center gap-2 text-rose-300">
              <AlertTriangle size={15} />
              <p className="text-sm font-semibold">Could not load POP items</p>
            </div>
            <p className="mt-2 text-xs text-rose-200/80 break-all">{error}</p>
          </div>
        ) : popeQuery.isLoading ? (
          <TimelineSkeleton />
        ) : groups.length === 0 ? (
          <EmptyState
            title="No POP items yet"
            description="Check in to events and your POP collection will appear here."
            action={
              <Link
                href="/events"
                className="inline-flex items-center rounded-xl border border-white/15 bg-white/[0.08] px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-white/[0.12]"
              >
                Browse events
              </Link>
            }
          />
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
                    <PopeCard key={String(item.poaEntity.key)} item={item} />
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

function PopeCard({ item }: { item: PopeTimelineItem }) {
  const event = item.event;
  const popExplorerUrl = `${EXPLORER}/entity/${String(item.poaEntity.key)}`;
  const title = item.poa.eventTitle?.trim() || event?.title || "Untitled event";
  const location = event?.location?.trim() || "Location unavailable";
  const image = item.poa.poapImageUrl || event?.poapImageUrl || event?.imageUrl || event?.coverImageUrl;
  const imgUrl = useEventImage(image);
  const cardContent = (
    <>
      <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_100px]">
        <div className="min-w-0">
          <p className="text-base font-medium text-zinc-300">{formatTime(item.startMs)}</p>
          <h3 className="mt-1 line-clamp-2 text-xl font-semibold leading-tight text-white">{title}</h3>

          <p className="mt-1 text-sm text-zinc-300">By {item.organizerName}</p>
          <p className="mt-1 flex items-center gap-1 text-sm text-zinc-400">
            <MapPin size={14} className="shrink-0" />
            <span className="truncate">{location}</span>
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-violet-500/20 px-2 py-1 text-xs font-semibold text-violet-200">
              <BadgeCheck size={12} />
              POP
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
              <Clock3 size={12} />
              Checked in {formatCheckinTime(item.poa.checkedInAt || item.poa.issuedAt)}
            </span>
          </div>
        </div>

        <div className="aspect-square w-full overflow-hidden rounded-xl border border-white/15 bg-zinc-900">
          {imgUrl ? (
            <img src={imgUrl} alt={title} className="h-full w-full aspect-square object-cover" />
          ) : (
            <div className="h-full w-full aspect-square bg-gradient-to-br from-zinc-700/50 via-zinc-800/70 to-zinc-900" />
          )}
        </div>
      </div>
    </>
  );

  return (
    <a
      href={popExplorerUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-xl border border-white/10 p-2.5 transition-colors hover:border-white/20"
      style={{ background: "linear-gradient(120deg, rgba(33,33,33,0.86), rgba(38,38,38,0.86))" }}
    >
      {cardContent}
    </a>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-6 py-12 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/[0.04]">
        <CalendarDays size={22} className="text-zinc-400" />
      </div>
      <h2 className="mt-5 text-lg font-semibold text-white">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">{description}</p>
      <div className="mt-6">{action}</div>
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-28 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />
      ))}
    </div>
  );
}
