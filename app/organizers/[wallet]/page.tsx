"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Hex } from "viem";
import type { Entity } from "@arkiv-network/sdk";
import { getAddress } from "viem";
import { SearchX, Globe, Pencil, ArrowLeft, ArrowRight, MapPin, Users } from "lucide-react";
import { publicClient } from "@/lib/arkiv/client";
import { getOrganizerByWallet } from "@/lib/arkiv/queries/profiles";
import { getHostEventsByOrganizer } from "@/lib/arkiv/queries/events";
import { useWallet } from "@/hooks/useWallet";
import { useEventImage } from "@/hooks/useEventImage";
import { Navbar } from "@/components/Navbar";
import { resolveEventAppearance } from "@/lib/eventAppearance";
import type { OrganizerProfile, Event } from "@/lib/arkiv/types";

function toMs(value: unknown): number {
  if (!value && value !== 0) return NaN;
  const str = String(value);
  if (!str.trim()) return NaN;
  if (/^\d+$/.test(str)) return Number(str) * 1_000;
  return Date.parse(str);
}

function isPast(dateValue: unknown): boolean {
  const ms = toMs(dateValue);
  return !isNaN(ms) && ms < Date.now();
}

function formatDay(ms: number): string {
  if (isNaN(ms)) return "Date TBD";
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short" }).format(new Date(ms));
}

function formatWeekday(ms: number): string {
  if (isNaN(ms)) return "";
  return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date(ms));
}

function formatTime(ms: number): string {
  if (isNaN(ms)) return "Time TBD";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ms));
}

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** Supports both plain https:// URLs and imagedb media_ids (UUID). */
function resolveAvatarSrc(url: string): string {
  if (!url) return "";
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(url)) {
    return `/api/imagedb/media/${url}`;
  }
  return url;
}

function AvatarPlaceholder({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-violet-700 to-violet-900 text-2xl font-bold text-white ring-4 ring-white/10 sm:h-28 sm:w-28">
      {initials || "?"}
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex gap-5 items-start">
        <div className="h-24 w-24 rounded-full bg-zinc-800 sm:h-28 sm:w-28 shrink-0" />
        <div className="flex-1 space-y-3 pt-2">
          <div className="h-6 w-48 rounded bg-zinc-800" />
          <div className="h-3 w-32 rounded bg-zinc-800" />
          <div className="h-4 w-64 rounded bg-zinc-800" />
        </div>
      </div>
      <div className="h-24 rounded-2xl bg-zinc-900" />
    </div>
  );
}

type Tab = "upcoming" | "past";
type EventDayGroup = {
  key: string;
  dayLabel: string;
  weekday: string;
  items: Array<{ entity: Entity; event: Event; startMs: number }>;
};

function groupByDay(entities: Entity[], tab: Tab): EventDayGroup[] {
  const grouped = new Map<string, EventDayGroup>();

  for (const entity of entities) {
    const event = entity.toJson() as Event;
    const startMs = toMs(event.date);
    const date = isNaN(startMs) ? new Date(0) : new Date(startMs);
    const dayKey = isNaN(startMs)
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
    const aMs = a.items[0]?.startMs ?? (tab === "upcoming" ? Number.MAX_SAFE_INTEGER : Number.MIN_SAFE_INTEGER);
    const bMs = b.items[0]?.startMs ?? (tab === "upcoming" ? Number.MAX_SAFE_INTEGER : Number.MIN_SAFE_INTEGER);
    return tab === "upcoming" ? aMs - bMs : bMs - aMs;
  });

  for (const group of sorted) {
    group.items.sort((a, b) => (tab === "upcoming" ? a.startMs - b.startMs : b.startMs - a.startMs));
  }

  return sorted;
}

export default function OrganizerProfilePage() {
  const params = useParams();
  const walletRaw = params.wallet as string;
  const wallet = (() => { try { return getAddress(walletRaw); } catch { return walletRaw.toLowerCase() as Hex; } })() as Hex;
  const { address: connectedAddress } = useWallet();
  const [tab, setTab] = useState<Tab>("upcoming");

  const isOwner =
    !!connectedAddress &&
    connectedAddress.toLowerCase() === wallet.toLowerCase();

  const {
    data: profileResult,
    isLoading: isProfileLoading,
  } = useQuery({
    queryKey: ["organizer-profile", wallet],
    queryFn: () => getOrganizerByWallet(publicClient, wallet),
    enabled: !!wallet,
  });

  const profileEntity =
    profileResult?.success ? profileResult.data : null;
  const profile: OrganizerProfile | null = profileEntity
    ? (profileEntity.toJson() as OrganizerProfile)
    : null;

  const {
    data: eventsResult,
    isLoading: isEventsLoading,
  } = useQuery({
    queryKey: ["organizer-events-public", wallet],
    queryFn: () => getHostEventsByOrganizer(publicClient, wallet),
    enabled: !!wallet,
  });

  const allEventEntities: Entity[] =
    eventsResult?.success ? eventsResult.data : [];

  const publicEntities = allEventEntities.filter((ent) => {
    const ev = ent.toJson() as Event;
    return ev.status !== "draft";
  });

  const upcomingEntities = publicEntities.filter((ent) => {
    const ev = ent.toJson() as Event;
    return !isPast(ev.endDate ?? ev.date);
  });

  const pastEntities = publicEntities.filter((ent) => {
    const ev = ent.toJson() as Event;
    return isPast(ev.endDate ?? ev.date);
  });

  const tabEntities = tab === "upcoming" ? upcomingEntities : pastEntities;
  const groupedEvents = useMemo(() => groupByDay(tabEntities, tab), [tabEntities, tab]);

  if (!isProfileLoading && !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-24">
        <div className="text-center space-y-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 border border-white/10 mx-auto">
            <SearchX size={24} className="text-zinc-500" />
          </div>
          <h2 className="text-xl font-bold text-white">No organizer found</h2>
          <p className="text-sm text-zinc-500">
            {truncateAddress(wallet)} hasn&apos;t created a profile yet.
          </p>
          <Link
            href="/events"
            className="inline-flex items-center gap-1.5 mt-2 text-sm text-violet-400 hover:underline"
          >
            <ArrowLeft size={14} /> Browse events
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 space-y-10">
        {/* Profile card */}
        {isProfileLoading ? (
          <ProfileSkeleton />
        ) : (
          <div className="space-y-6">
            {/* Header row */}
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              {/* Avatar */}
              <div className="shrink-0">
                {profile?.avatarUrl ? (
                  <img
                    src={resolveAvatarSrc(profile.avatarUrl)}
                    alt={profile.name}
                    className="h-24 w-24 aspect-square rounded-full object-cover ring-4 ring-white/10 sm:h-28 sm:w-28"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display =
                        "none";
                    }}
                  />
                ) : (
                  <AvatarPlaceholder name={profile?.name ?? ""} />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold truncate">
                    {profile?.name}
                  </h1>
                  
                </div>

                {/* Wallet address */}
                <p className="font-mono text-xs text-zinc-500">
                  {truncateAddress(wallet)}
                </p>

                {/* Links */}
                <div className="flex flex-wrap gap-3">
                  {profile?.website && (
                    <a
                      href={
                        profile.website.startsWith("http")
                          ? profile.website
                          : `https://${profile.website}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-zinc-400 hover:text-violet-400 transition-colors"
                    >
                      <Globe size={12} /> {profile.website.replace(/^https?:\/\//, "")}
                    </a>
                  )}
                  {profile?.twitter && (
                    <a
                      href={`https://x.com/${profile.twitter.replace(/^@/, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-zinc-400 hover:text-violet-400 transition-colors"
                    >
                      𝕏 @{profile.twitter.replace(/^@/, "")}
                    </a>
                  )}
                </div>
              </div>

              {/* Edit button (visible on larger screen next to profile) */}
              {isOwner && (
                <Link
                  href={`/organizers/${wallet}/edit`}
                  className="hidden sm:inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 px-4 py-2 text-xs font-medium text-zinc-300 hover:text-white hover:border-white/20 transition-colors"
                >
                  <Pencil size={12} /> Edit Profile
                </Link>
              )}
            </div>

            {/* Bio */}
            {profile?.bio && (
              <div className="rounded-2xl border border-white/5 bg-zinc-900 px-5 py-4">
                <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                  {profile.bio}
                </p>
              </div>
            )}

            {/* Dashboard link for owner */}
            {isOwner && (
              <div className="flex gap-3">
                <Link
                  href="/organizer/dashboard"
                  className="flex items-center gap-1 text-xs text-violet-400 hover:underline"
                >
                  <ArrowRight size={12} /> Organizer Dashboard
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Events section */}
        <div>
          {/* Tab header */}
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-200">Events</h2>
            <div className="flex overflow-hidden rounded-lg border border-white/5 bg-zinc-900 text-xs font-medium">
              {(["upcoming", "past"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2 capitalize transition-colors ${
                    tab === t
                      ? "bg-violet-700 text-white"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {t}
                  {t === "upcoming" && (
                    <span className="ml-1.5 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px]">
                      {upcomingEntities.length}
                    </span>
                  )}
                  {t === "past" && (
                    <span className="ml-1.5 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px]">
                      {pastEntities.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Timeline */}
          {isEventsLoading ? (
            <div className="space-y-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-28 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />
              ))}
            </div>
          ) : tabEntities.length === 0 ? (
            <div className="rounded-2xl border border-white/5 bg-zinc-900 px-6 py-12 text-center text-sm text-zinc-600">
              {tab === "upcoming"
                ? "No upcoming events"
                : "No past events yet"}
            </div>
          ) : (
            <div className="space-y-6">
              {groupedEvents.map((group) => (
                <section key={group.key} className="relative pl-7">
                  <span className="absolute left-[5px] top-3 h-2.5 w-2.5 rounded-full bg-zinc-400" />
                  <div className="mb-3 flex items-baseline gap-2">
                    <h3 className="text-xl font-bold text-white">{group.dayLabel}</h3>
                    <p className="text-lg text-zinc-400">{group.weekday}</p>
                  </div>

                  <div className="space-y-3 border-l border-dashed border-white/15 pl-6">
                    {group.items.map((item) => (
                      <OrganizerTimelineCard
                        key={item.entity.key as string}
                        entity={item.entity}
                        event={item.event}
                        startMs={item.startMs}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function OrganizerTimelineCard({
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
  const capacity = Number(event.capacity ?? 0);
  const isSoldOut = capacity > 0 && rsvpCount >= capacity;
  const organizerNameAttr = entity.attributes.find((a) => a.key === "organizerName")?.value as string | undefined;
  const organizer = organizerNameAttr || "Community";

  return (
    <Link
      href={`/events/${entity.key}`}
      className="block rounded-xl border border-white/10 p-2.5 transition-colors hover:border-white/20"
      style={{
        background: "linear-gradient(120deg, rgba(33,33,33,0.86), rgba(38,38,38,0.86))",
        fontFamily: appearance.fontFamily,
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
              {rsvpCount} / {capacity || 0} attending
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
