"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import type { Hex } from "viem";
import { AlertTriangle, Lock, Calendar, MapPin, Users, Tag, FileText, Flag, Radio, ArrowRight, Plus } from "lucide-react";
import { useOrganizer } from "@/hooks/useOrganizer";
import { useOrganizerEvents } from "@/hooks/useEvent";
import { useWallet } from "@/hooks/useWallet";
import { publicClient } from "@/lib/arkiv/client";
import {
  updateHostEventStatus,
  archiveHostEvent,
} from "@/lib/arkiv/entities/event";
import { Navbar } from "@/components/Navbar";
import { StatusBadge } from "@/components/StatusBadge";
import { ConnectButton } from "@/components/ConnectButton";
import { ConfirmModal } from "@/components/ConfirmModal";
import type { Event, EventStatus } from "@/lib/arkiv/types";

function toMs(value: unknown): number {
  if (value == null || value === "") return NaN;
  if (typeof value === "number") return isFinite(value) ? value * 1_000 : NaN;
  const str = String(value);
  if (/^\d+$/.test(str)) return Number(str) * 1_000;
  const t = Date.parse(str);
  return isNaN(t) ? NaN : t;
}

function formatDate(value: unknown) {
  const ms = toMs(value);
  if (isNaN(ms)) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ms));
}

function isToday(value: unknown) {
  const ms = toMs(value);
  if (isNaN(ms)) return false;
  const d = new Date(ms);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const TABS: EventStatus[] = ["draft", "upcoming", "live", "ended", "archived"];

const TAB_LABEL: Record<EventStatus, string> = {
  draft: "Draft",
  upcoming: "Upcoming",
  live: "Live",
  ended: "Ended",
  archived: "Archived",
};

const ORGANIZER_GLASS_BG =
  "radial-gradient(circle at 18% 0%, rgba(37,99,235,0.28), transparent 36%), radial-gradient(circle at 80% 2%, rgba(99,102,241,0.22), transparent 30%), linear-gradient(180deg, #0a1120 0%, #060912 55%)";

export default function DashboardPage() {
  const router = useRouter();
  const { address, isConnected, isCorrectChain } = useWallet();
  const { organizer, isLoading: profileLoading } = useOrganizer();
  const { events, isLoading: eventsLoading, refetch } = useOrganizerEvents();
  const { walletClient } = useWallet();

  const [tab, setTab] = useState<EventStatus>("upcoming");
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<{ key: Hex; title: string } | null>(null);

  useEffect(() => {
    if (!profileLoading && isConnected && isCorrectChain && !organizer) {
      router.push("/organizer/onboard");
    }
  }, [organizer, profileLoading, isConnected, isCorrectChain, router]);

  const statusMutation = useMutation({
    mutationFn: async ({
      entityKey,
      newStatus,
      payload,
    }: {
      entityKey: Hex;
      newStatus: EventStatus;
      payload: Event;
    }) => {
      if (!walletClient) throw new Error("Wallet not connected");
      const res = await updateHostEventStatus(walletClient, publicClient, entityKey, newStatus, payload);
      if (!res.success) throw new Error(res.error);
    },
    onSuccess: () => {
      toast.success("Event status updated ✓");
      refetch();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Status update failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (eventKey: Hex) => {
      if (!walletClient) throw new Error("Wallet not connected");
      setDeletingKey(eventKey);
      const res = await archiveHostEvent(walletClient, publicClient, eventKey);
      if (!res.success) throw new Error(res.error);
    },
    onSuccess: () => {
      toast.success("Hostevent archived");
      setDeletingKey(null);
      refetch();
    },
    onError: () => setDeletingKey(null),
  });

  if (!isConnected || !isCorrectChain) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#060912] p-6 text-white">
        <div className="pointer-events-none absolute inset-0" style={{ background: ORGANIZER_GLASS_BG }} />
        <div className="relative max-w-sm space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-white/[0.05] backdrop-blur-sm">
            {isConnected
              ? <AlertTriangle size={24} className="text-amber-400" />
              : <Lock size={24} className="text-violet-400" />}
          </div>
          <h2 className="text-lg font-bold text-white">
            {isConnected ? "Wrong network" : "Connect your wallet"}
          </h2>
          <p className="text-sm text-zinc-300">
            {isConnected
              ? "Switch to Kaolin to access the dashboard."
              : "Connect your wallet to manage your events."}
          </p>
          <div className="flex justify-center">
            <ConnectButton />
          </div>
        </div>
      </div>
    );
  }

  if (profileLoading || eventsLoading) return <DashboardSkeleton />;

  const tabEvents = events.filter((e) => {
    const ev = e.toJson() as Event;
    return ev.status === tab;
  });

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#060912] text-white">
      <div className="pointer-events-none absolute inset-0" style={{ background: ORGANIZER_GLASS_BG }} />
      <Navbar active="dashboard" />

      <main className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {organizer?.name ?? "Dashboard"}
            </h1>
            {address && (
              <p className="mt-0.5 font-mono text-sm text-zinc-400">
                {truncate(address)}
              </p>
            )}
          </div>
          <Link
            href="/organizer/events/create"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(99,102,241,0.35)] transition hover:brightness-110"
          >
            <Plus size={16} />
            Create Event
          </Link>
        </div>

        {}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {TABS.map((t) => {
            const count = events.filter((e) => (e.toJson() as Event).status === t).length;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-xl border p-4 text-left transition-all ${
                  tab === t
                    ? "border-violet-300/35 bg-violet-500/15 backdrop-blur-sm"
                    : "border-white/12 bg-white/[0.04] backdrop-blur-sm hover:border-white/20 hover:bg-white/[0.06]"
                }`}
              >
                <p className="text-2xl font-bold text-white">{count}</p>
                <p className="mt-0.5 text-xs text-zinc-400">{TAB_LABEL[t]}</p>
              </button>
            );
          })}
        </div>

        {}
        <div className="mb-5 flex w-fit gap-1 rounded-xl border border-white/12 bg-white/[0.04] p-1 backdrop-blur-sm">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t
                  ? "border border-white/20 bg-white/[0.12] text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>

        {}
        {(statusMutation.isError || deleteMutation.isError) && (
          <div className="mb-4 rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 backdrop-blur-sm">
            <p className="font-mono text-xs text-rose-200">
              {statusMutation.error instanceof Error
                ? statusMutation.error.message
                : deleteMutation.error instanceof Error
                  ? deleteMutation.error.message
                  : "Operation failed"}
            </p>
          </div>
        )}

        {}
        {tabEvents.length === 0 ? (
          <EmptyTab status={tab} />
        ) : (
          <div className="space-y-3">
            {tabEvents.map((entity) => {
              const ev = entity.toJson() as Event;
              const entityKey = entity.key as Hex;
              const rsvpCount = Number(
                entity.attributes.find((a) => a.key === "rsvpCount")?.value ?? 0,
              );
              const isPendingStatus =
                statusMutation.isPending &&
                (statusMutation.variables as { entityKey: Hex } | undefined)
                  ?.entityKey === entityKey;
              const isDeleting = deletingKey === entityKey;

              return (
                <div
                  key={entityKey}
                  className={`rounded-2xl border bg-white/[0.04] p-5 backdrop-blur-sm transition-opacity ${
                    isDeleting ? "pointer-events-none opacity-40" : "border-white/12"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/events/${entityKey}`}
                          className="font-semibold text-white hover:text-violet-300 transition-colors truncate"
                        >
                          {ev.title}
                        </Link>
                        <StatusBadge status={ev.status} />
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
                        <span className="flex items-center gap-1"><Calendar size={11} />{formatDate(ev.date)}</span>
                        <span className="flex items-center gap-1"><MapPin size={11} />{ev.location}</span>
                        <span className="flex items-center gap-1">
                          <Users size={11} />{rsvpCount} / {ev.capacity} tickets
                        </span>
                        <span className="flex items-center gap-1"><Tag size={11} />{ev.category}</span>
                      </div>
                    </div>

                    {}
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      {}
                      {ev.status === "draft" && (
                        <ActionBtn
                          label="Publish"
                          onClick={() =>
                            statusMutation.mutate({
                              entityKey,
                              newStatus: "upcoming",
                              payload: ev,
                            })
                          }
                          loading={isPendingStatus}
                          variant="violet"
                        />
                      )}
                      {ev.status === "upcoming" && (
                        <ActionBtn
                          label="Start Event"
                          onClick={() =>
                            statusMutation.mutate({
                              entityKey,
                              newStatus: "live",
                              payload: ev,
                            })
                          }
                          loading={isPendingStatus}
                          disabled={!isToday(ev.date)}
                          title={
                            isToday(ev.date)
                              ? "Mark as live"
                              : "Only available on event day"
                          }
                          variant="emerald"
                        />
                      )}
                      {ev.status === "live" && (
                        <ActionBtn
                          label="End Event"
                          onClick={() =>
                            statusMutation.mutate({
                              entityKey,
                              newStatus: "ended",
                              payload: ev,
                            })
                          }
                          loading={isPendingStatus}
                          variant="zinc"
                        />
                      )}

                      {}
                      <Link
                        href={`/organizer/events/${entityKey}/attendees`}
                        className="rounded-lg border border-white/20 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-white/30 hover:bg-white/[0.09] hover:text-white"
                      >
                        Attendees
                      </Link>
                      <Link
                        href={`/organizer/events/${entityKey}/edit`}
                        className="rounded-lg border border-white/20 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-white/30 hover:bg-white/[0.09] hover:text-white"
                      >
                        Edit
                      </Link>

                      {}
                      <button
                        onClick={() =>
                          setConfirmDeleteKey({ key: entityKey, title: ev.title })
                        }
                        disabled={deleteMutation.isPending}
                        className="rounded-lg border border-rose-400/35 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-200 transition-colors hover:bg-rose-500/20 disabled:opacity-40"
                      >
                        Archive
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <ConfirmModal
        open={!!confirmDeleteKey}
        title={`Archive "${confirmDeleteKey?.title ?? "this event"}"?`}
        message="This hostevent will be hidden from public discovery and moved to archived."
        confirmLabel="Archive"
        destructive
        onConfirm={() => {
          if (confirmDeleteKey) deleteMutation.mutate(confirmDeleteKey.key);
        }}
        onClose={() => setConfirmDeleteKey(null)}
      />
    </div>
  );
}

function ActionBtn({
  label,
  onClick,
  loading,
  disabled,
  title,
  variant,
}: {
  label: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  title?: string;
  variant: "violet" | "emerald" | "zinc";
}) {
  const colors = {
    violet: "bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-[0_8px_24px_rgba(99,102,241,0.35)] hover:brightness-110",
    emerald: "bg-emerald-500/90 text-emerald-950 hover:bg-emerald-400",
    zinc: "border border-white/20 bg-white/[0.08] text-white hover:bg-white/[0.14]",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${colors[variant]}`}
    >
      {loading ? "…" : label}
    </button>
  );
}

function EmptyTab({ status }: { status: EventStatus }) {
  const config: Record<EventStatus, { icon: React.ReactNode; title: string; msg: string; cta?: string; ctaLabel?: string }> = {
    draft: {
      icon: <FileText size={24} className="text-zinc-500" />,
      title: "No drafts",
      msg: "Create an event and save it as a draft to review before publishing.",
      cta: "/organizer/events/create",
      ctaLabel: "Create Event",
    },
    upcoming: {
      icon: <Calendar size={24} className="text-zinc-500" />,
      title: "No upcoming events",
      msg: "Publish a draft event or create a new one to see it here.",
      cta: "/organizer/events/create",
      ctaLabel: "Create Event",
    },
    live: {
      icon: <Radio size={24} className="text-zinc-500" />,
      title: "No live events",
      msg: "Transition an upcoming event to Live when it starts.",
    },
    ended: {
      icon: <Flag size={24} className="text-zinc-500" />,
      title: "No ended events",
      msg: "Completed events will appear here after they end.",
    },
    archived: {
      icon: <Flag size={24} className="text-zinc-500" />,
      title: "No archived events",
      msg: "Archived hostevents appear here and stay hidden from public discovery.",
    },
  };

  const { icon, title, msg, cta, ctaLabel } = config[status];

  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-6 py-16 text-center backdrop-blur-sm">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-white/12 bg-white/[0.04]">{icon}</div>
      <p className="text-sm font-semibold text-zinc-200">{title}</p>
      <p className="mx-auto mt-1.5 max-w-xs text-xs text-zinc-400">{msg}</p>
      {cta && ctaLabel && (
        <Link
          href={cta}
          className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-4 py-2 text-xs font-semibold text-white shadow-[0_8px_26px_rgba(99,102,241,0.35)] transition hover:brightness-110"
        >
          {ctaLabel} <ArrowRight size={12} />
        </Link>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="relative min-h-screen animate-pulse overflow-hidden bg-[#060912] text-white">
      <div className="pointer-events-none absolute inset-0" style={{ background: ORGANIZER_GLASS_BG }} />
      <div className="h-14 border-b border-white/10 bg-white/[0.03] backdrop-blur-sm" />
      <div className="relative mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        <div className="h-8 w-48 rounded bg-white/[0.08]" />
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-xl border border-white/10 bg-white/[0.05]" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-2xl border border-white/10 bg-white/[0.05]" />
          ))}
        </div>
      </div>
    </div>
  );
}
