"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Hex } from "viem";
import type { Entity } from "@arkiv-network/sdk";
import { getAddress } from "viem";
import { SearchX, Globe, Pencil, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { publicClient } from "@/lib/arkiv/client";
import { getOrganizerByWallet } from "@/lib/arkiv/entities/organizer";
import { getEventsByOrganizer } from "@/lib/arkiv/entities/event";
import { useWallet } from "@/hooks/useWallet";
import { EventCard, EventCardSkeleton } from "@/components/EventCard";
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

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
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
    error: profileError,
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
    queryFn: () => getEventsByOrganizer(publicClient, wallet),
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

  
  if (!isProfileLoading && !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-24">
        <div className="text-center space-y-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 border border-white/10 mx-auto">
            <SearchX size={24} className="text-zinc-500" />
          </div>
          <h2 className="text-xl font-bold text-white">No organizer found</h2>
          <p className="text-sm text-zinc-500">
            {truncateAddress(wallet)} hasn't created a profile yet.
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
      {/* Top nav strip */}
      <nav className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/10 bg-transparent px-4 backdrop-blur-xl supports-[backdrop-filter]:bg-zinc-950/20 sm:px-6">
        <Link
          href="/"
          className="text-sm font-semibold text-violet-400 hover:text-violet-300 transition-colors"
        >
          Hostr
        </Link>
        {isOwner && (
          <Link
            href={`/organizers/${wallet}/edit`}
            className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
          >
            Edit Profile
          </Link>
        )}
      </nav>

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
                    src={profile.avatarUrl}
                    alt={profile.name}
                    className="h-24 w-24 rounded-full object-cover ring-4 ring-white/10 sm:h-28 sm:w-28"
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
                  {/* Verified badge */}
                  <span className="inline-flex items-center gap-1 rounded-full border border-violet-700/40 bg-violet-900/30 px-2.5 py-0.5 text-xs font-medium text-violet-300">
                    <Check size={10} /> Verified organizer on Arkiv
                  </span>
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

          {/* Grid */}
          {isEventsLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[0, 1, 2].map((i) => (
                <EventCardSkeleton key={i} />
              ))}
            </div>
          ) : tabEntities.length === 0 ? (
            <div className="rounded-2xl border border-white/5 bg-zinc-900 px-6 py-12 text-center text-sm text-zinc-600">
              {tab === "upcoming"
                ? "No upcoming events"
                : "No past events yet"}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {tabEntities.map((ent) => (
                <EventCard
                  key={ent.key}
                  entity={ent}
                  event={ent.toJson() as Event}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
