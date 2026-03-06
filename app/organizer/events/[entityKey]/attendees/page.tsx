"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { Hex } from "viem";
import { useQuery, useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import type { Entity } from "@arkiv-network/sdk";
import { AlertTriangle, Lock, ShieldOff, ArrowLeft, Download, Check, ScanLine, XCircle, BanIcon } from "lucide-react";
import { useEvent } from "@/hooks/useEvent";
import { useWallet } from "@/hooks/useWallet";
import { publicClient } from "@/lib/arkiv/client";
import { approveTicket, rejectTicket } from "@/lib/arkiv/entities/ticket";
import {
  getTicketsByEvent,
  getDecisionsByEvent,
  getApprovalForTicket,
  getRejectionForTicket,
} from "@/lib/arkiv/queries/tickets";
import { createCheckinEntity } from "@/lib/arkiv/entities/checkin";
import { getCheckinsByEvent, hasAttendeeCheckedIn } from "@/lib/arkiv/queries/checkins";
import { createPoAEntity } from "@/lib/arkiv/entities/attendance";
import { Navbar } from "@/components/Navbar";
import { ConnectButton } from "@/components/ConnectButton";
import { ConfirmModal } from "@/components/ConfirmModal";
import { friendlyError } from "@/lib/arkiv/errors";
import type { Ticket, TicketStatus } from "@/lib/arkiv/types";

type EffectiveStatus = TicketStatus | "rejected" | "not-going";

interface AttendeeRow {
  entity: Entity;
  rsvpKey: Hex;
  ownerAddress: Hex;
  data: Ticket;
  status: EffectiveStatus;
}

const ORGANIZER_GLASS_BG =
  "radial-gradient(circle at 18% 0%, rgba(37,99,235,0.28), transparent 36%), radial-gradient(circle at 80% 2%, rgba(99,102,241,0.22), transparent 30%), linear-gradient(180deg, #0a1120 0%, #060912 55%)";

function truncateAddress(addr: string) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function toMs(value: unknown): number {
  if (!value && value !== 0) return NaN;
  const str = String(value);
  if (!str.trim()) return NaN;
  if (/^\d+$/.test(str)) return Number(str) * 1_000;
  const ms = Date.parse(str);
  return ms;
}

function formatDate(value: unknown): string {
  const ms = toMs(value);
  if (isNaN(ms)) return "—";
  return new Date(ms).toLocaleString();
}

function buildCsv(rows: AttendeeRow[]): string {
  const header = ["Wallet", "Name", "Email", "Status", "Message"];
  const body = rows.map((r) => [
    r.ownerAddress,
    r.data.attendeeName ?? "",
    r.data.attendeeEmail ?? "",
    r.status,
    (r.data.message ?? "").replace(/,/g, " "),
  ]);
  return [header, ...body].map((row) => row.join(",")).join("\n");
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function Chip({ status }: { status: EffectiveStatus }) {
  const map: Record<EffectiveStatus, string> = {
    pending: "border-violet-300/35 bg-violet-500/15 text-violet-100",
    confirmed: "border-emerald-300/35 bg-emerald-500/15 text-emerald-100",
    waitlisted: "border-amber-300/35 bg-amber-500/15 text-amber-100",
    "checked-in": "border-blue-300/35 bg-blue-500/15 text-blue-100",
    rejected: "border-rose-300/35 bg-rose-500/15 text-rose-100",
    "not-going": "border-white/20 bg-white/[0.08] text-zinc-200",
  };
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${map[status]}`}
    >
      {status}
    </span>
  );
}

export default function AttendeesPage() {
  const params = useParams();
  const entityKey = params.entityKey as Hex;

  const { event, entity: eventEntity, isLoading: isEventLoading } = useEvent(entityKey);
  const { address, isConnected, isCorrectChain, walletClient } = useWallet();

  const {
    data: rsvpEntities,
    isLoading: isRsvpLoading,
    refetch: refetchRsvps,
  } = useQuery<Entity[]>({
    queryKey: ["attendees", entityKey],
    queryFn: async () => {
      const res = await getTicketsByEvent(publicClient, entityKey);
      return res.success ? res.data : [];
    },
    enabled: !!entityKey,
  });

  const {
    data: checkinEntities,
    refetch: refetchCheckins,
  } = useQuery<Entity[]>({
    queryKey: ["checkins", entityKey],
    queryFn: async () => {
      const res = await getCheckinsByEvent(publicClient, entityKey);
      return res.success ? res.data : [];
    },
    enabled: !!entityKey,
  });

  const [rejectTarget, setRejectTarget] = useState<AttendeeRow | null>(null);

  const {
    data: approvalEntities,
    refetch: refetchApprovals,
  } = useQuery<Entity[]>({
    queryKey: ["rsvp-approvals", entityKey],
    queryFn: async () => {
      const res = await getDecisionsByEvent(publicClient, entityKey, "approved");
      return res.success ? res.data : [];
    },
    enabled: !!entityKey,
  });

  const {
    data: rejectionEntities,
    refetch: refetchRejections,
  } = useQuery<Entity[]>({
    queryKey: ["rsvp-rejections", entityKey],
    queryFn: async () => {
      const res = await getDecisionsByEvent(publicClient, entityKey, "rejected");
      return res.success ? res.data : [];
    },
    enabled: !!entityKey,
  });

  const checkedInWallets = useMemo(() => {
    return new Set(
      (checkinEntities ?? []).map((e) => {
        const attr = e.attributes.find((a) => a.key === "attendeeWallet");
        return ((attr?.value as string) ?? "").toLowerCase();
      }),
    );
  }, [checkinEntities]);

  const approvedRsvpKeys = useMemo(() => {
    return new Set(
      (approvalEntities ?? []).map((e) => {
        const attr = e.attributes.find((a) => a.key === "ticketKey");
        return ((attr?.value as string) ?? "").toLowerCase();
      }),
    );
  }, [approvalEntities]);

  const rejectedRsvpKeys = useMemo(() => {
    return new Set(
      (rejectionEntities ?? []).map((e) => {
        const attr = e.attributes.find((a) => a.key === "ticketKey");
        return ((attr?.value as string) ?? "").toLowerCase();
      }),
    );
  }, [rejectionEntities]);

  const checkInMutation = useMutation({
    mutationFn: async (vars: {
      rsvpKey: Hex;
      ownerAddress: Hex;
    }) => {
      if (!walletClient || !event?.endDate) {
        throw new Error("Missing walletClient or event data");
      }
      if (!vars.ownerAddress) {
        throw new Error("Missing attendee wallet on ticket.");
      }

      const alreadyRes = await hasAttendeeCheckedIn(publicClient, entityKey, vars.ownerAddress);
      if (alreadyRes.success && alreadyRes.data) {
        throw new Error("This attendee has already been checked in");
      }
      const ms = toMs(event.endDate);
      const endDateSeconds = isNaN(ms)
        ? Math.floor(Date.now() / 1_000) + 3_600
        : Math.floor(ms / 1_000);
      const checkinRes = await createCheckinEntity(
        walletClient,
        publicClient,
        entityKey,
        vars.ownerAddress,
        endDateSeconds,
        vars.rsvpKey,
        "manual",
      );
      if (!checkinRes.success) throw new Error(checkinRes.error);

      try {
        await createPoAEntity(
          walletClient,
          publicClient,
          entityKey,
          vars.rsvpKey,
          vars.ownerAddress,
          checkinRes.data.entityKey,
        );
      } catch {  }
    },
    onSuccess: () => {
      toast.success("Attendee checked in ✓");
      refetchRsvps();
      refetchCheckins();
    },
    onError: (e) => toast.error(friendlyError(e instanceof Error ? e.message : "Check-in failed")),
  });

  const approveMutation = useMutation({
    mutationFn: async (vars: { rsvpKey: Hex; ownerAddress: Hex }) => {
      if (!walletClient || !event?.endDate) throw new Error("Wallet or event data missing");
      if (!vars.ownerAddress) throw new Error("Missing attendee wallet on ticket.");

      const rejRes = await getRejectionForTicket(publicClient, vars.rsvpKey);
      if (rejRes.success && rejRes.data) throw new Error("Cannot approve — this RSVP was already rejected");
      const ms = toMs(event.endDate);
      const endDateSeconds = isNaN(ms)
        ? Math.floor(Date.now() / 1_000) + 86_400
        : Math.floor(ms / 1_000);
      const res = await approveTicket(
        walletClient,
        publicClient,
        vars.rsvpKey,
        entityKey,
        vars.ownerAddress,
        endDateSeconds,
      );
      if (!res.success) throw new Error(res.error);
    },
    onSuccess: () => {
      toast.success("Request approved ✓");
      refetchApprovals();
      refetchRsvps();
    },
    onError: (e) => toast.error(friendlyError(e instanceof Error ? e.message : "Approval failed")),
  });

  const rejectMutation = useMutation({
    mutationFn: async (vars: { rsvpKey: Hex; ownerAddress: Hex }) => {
      if (!walletClient || !event?.endDate) throw new Error("Wallet or event data missing");
      if (!vars.ownerAddress) throw new Error("Missing attendee wallet on ticket.");

      const appRes = await getApprovalForTicket(publicClient, vars.rsvpKey);
      if (appRes.success && appRes.data) throw new Error("Cannot reject — this RSVP was already approved");
      const ms = toMs(event.endDate);
      const endDateSeconds = isNaN(ms)
        ? Math.floor(Date.now() / 1_000) + 86_400
        : Math.floor(ms / 1_000);
      const res = await rejectTicket(
        walletClient,
        publicClient,
        vars.rsvpKey,
        entityKey,
        vars.ownerAddress,
        endDateSeconds,
      );
      if (!res.success) throw new Error(res.error);
    },
    onSuccess: () => {
      toast.success("Request rejected");
      refetchRejections();
      refetchRsvps();
    },
    onError: (e) => toast.error(friendlyError(e instanceof Error ? e.message : "Rejection failed")),
  });

  if (!isConnected || !isCorrectChain) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#060912] p-6 text-white">
        <div className="pointer-events-none absolute inset-0" style={{ background: ORGANIZER_GLASS_BG }} />
        <div className="relative space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-white/[0.05] backdrop-blur-sm">
            {isConnected ? <AlertTriangle size={24} className="text-amber-400" /> : <Lock size={24} className="text-violet-400" />}
          </div>
          <h2 className="text-lg font-bold text-white">
            {isConnected ? "Wrong network" : "Sign in required"}
          </h2>
          <div className="flex justify-center"><ConnectButton /></div>
        </div>
      </div>
    );
  }

  if (isEventLoading) return <FullSkeleton />;

  if (!eventEntity) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#060912] p-6 text-white">
        <div className="pointer-events-none absolute inset-0" style={{ background: ORGANIZER_GLASS_BG }} />
        <div className="relative space-y-3 text-center">
          <p className="text-white font-bold">Event not found</p>
          <Link href="/organizer/dashboard" className="flex items-center justify-center gap-1.5 text-sm text-violet-300 transition-colors hover:text-white">
            <ArrowLeft size={14} /> Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (
    address &&
    eventEntity.owner &&
    eventEntity.owner.toLowerCase() !== address.toLowerCase()
  ) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#060912] p-6 text-white">
        <div className="pointer-events-none absolute inset-0" style={{ background: ORGANIZER_GLASS_BG }} />
        <div className="relative space-y-3 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/[0.05] backdrop-blur-sm">
            <ShieldOff size={22} className="text-rose-400" />
          </div>
          <p className="text-white font-bold">Not authorized</p>
          <p className="text-sm text-zinc-300">
            Only the event owner can manage attendees.
          </p>
          <Link href="/organizer/dashboard" className="flex items-center justify-center gap-1.5 text-sm text-violet-300 transition-colors hover:text-white">
            <ArrowLeft size={14} /> Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const allRows: AttendeeRow[] = (rsvpEntities ?? []).map((ent) => {
    const data = ent.toJson() as Ticket;
    const ownerAddress = String(
      ent.attributes.find((a) => a.key === "attendeeWallet")?.value ?? ent.owner ?? "",
    ) as Hex;
    const isCheckedIn = checkedInWallets.has(ownerAddress.toLowerCase());
    const rsvpKeyLower = (ent.key as string).toLowerCase();

    const statusAttr = ent.attributes.find((a) => a.key === "status");
    const rsvpAttrStatus = (statusAttr?.value as TicketStatus) ?? "pending";

    let status: EffectiveStatus;
    if (isCheckedIn) {
      status = "checked-in";    } else if (rsvpAttrStatus === "not-going") {
      status = "not-going";    } else if (rsvpAttrStatus === "pending" && rejectedRsvpKeys.has(rsvpKeyLower)) {
      status = "rejected";
    } else if (rsvpAttrStatus === "pending" && approvedRsvpKeys.has(rsvpKeyLower)) {

      status = "confirmed";
    } else {
      status = rsvpAttrStatus;
    }

    return {
      entity: ent,
      rsvpKey: ent.key as Hex,
      ownerAddress,
      data,
      status,
    };
  });

  const pending = allRows.filter((r) => r.status === "pending");
  const confirmed = allRows.filter(
    (r) => r.status === "confirmed" || r.status === "checked-in",
  );
  const waitlisted = allRows.filter((r) => r.status === "waitlisted");
  const checkedIn = allRows.filter((r) => r.status === "checked-in");
  const rejected = allRows.filter((r) => r.status === "rejected");
  const notGoing = allRows.filter((r) => r.status === "not-going");

  function handleExport() {
    const csv = buildCsv(confirmed);
    const slug = (event?.title ?? entityKey).toLowerCase().replace(/\s+/g, "-");
    downloadCsv(`${slug}-attendees.csv`, csv);
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#060912] text-white">
      <div className="pointer-events-none absolute inset-0" style={{ background: ORGANIZER_GLASS_BG }} />
      <Navbar active="dashboard" />

      <main className="relative mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6">
        {}
        <div className="space-y-4">
          <div>
            <Link
              href="/organizer/dashboard"
              className="flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-white"
            >
              <ArrowLeft size={14} /> Dashboard
            </Link>
            <h1 className="mt-2 text-2xl font-bold truncate">
              {event?.title ?? "Attendees"}
            </h1>
            {event?.date && (
              <p className="mt-0.5 text-xs text-zinc-400">{formatDate(event.date)}</p>
            )}
          </div>

          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="grid w-full grid-cols-2 gap-3 sm:w-auto sm:grid-cols-4">
              <HeaderStat label="Pending" value={pending.length} tone="violet" />
              <HeaderStat label="Confirmed" value={confirmed.length} />
              <HeaderStat label="Checked In" value={checkedIn.length} />
              <HeaderStat label="Waitlisted" value={waitlisted.length} />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {rejected.length > 0 && (
                <div className="rounded-lg border border-rose-300/35 bg-rose-500/15 px-3 py-2 text-center text-xs text-rose-100 backdrop-blur-sm">
                  <p className="text-base font-bold text-white">{rejected.length}</p>
                  <p>Rejected</p>
                </div>
              )}
              {notGoing.length > 0 && (
                <div className="rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-center text-xs text-zinc-300 backdrop-blur-sm">
                  <p className="text-base font-bold text-white">{notGoing.length}</p>
                  <p>Not Going</p>
                </div>
              )}
              
              <Link
                href={`/organizer/events/${entityKey}/checkin`}
                className="flex items-center gap-1.5 rounded-lg border border-violet-300/35 bg-violet-500/15 px-3 py-2 text-xs font-medium text-violet-100 transition-colors hover:bg-violet-500/25 hover:text-white"
              >
                <ScanLine size={13} /> Check-in Scanner
              </Link>
            </div>
          </div>
        </div>

        {}
        {pending.length > 0 && (
          <Section
            title="Pending Requests"
            count={pending.length}
            loading={isRsvpLoading}
          >
            {pending.map((row) => (
              <PendingRowItem
                key={row.rsvpKey}
                row={row}
                onApprove={() => approveMutation.mutate({ rsvpKey: row.rsvpKey, ownerAddress: row.ownerAddress })}
                onReject={() => setRejectTarget(row)}
                isApproving={approveMutation.isPending && (approveMutation.variables as { rsvpKey: Hex })?.rsvpKey === row.rsvpKey}
                isRejecting={rejectMutation.isPending && (rejectMutation.variables as { rsvpKey: Hex })?.rsvpKey === row.rsvpKey}
              />
            ))}
          </Section>
        )}

        {}
        <Section
          title="Confirmed Attendees"
          count={confirmed.length}
          loading={isRsvpLoading}
        >
          {confirmed.length === 0 ? (
            <EmptyRow message="No confirmed attendees yet" />
          ) : (
            confirmed.map((row) => (
              <AttendeeRowItem
                key={row.rsvpKey}
                row={row}
                eventStatus={event?.status ?? "draft"}
                onCheckIn={() =>
                  checkInMutation.mutate({
                    rsvpKey: row.rsvpKey,
                    ownerAddress: row.ownerAddress,
                  })
                }
                isCheckingIn={
                  checkInMutation.isPending &&
                  (checkInMutation.variables as { rsvpKey: Hex })?.rsvpKey ===
                    row.rsvpKey
                }
              />
            ))
          )}
        </Section>

        {}
        {waitlisted.length > 0 && (
          <Section title="Waitlist" count={waitlisted.length} loading={isRsvpLoading}>
            {waitlisted.map((row) => (
              <AttendeeRowItem
                key={row.rsvpKey}
                row={row}
                eventStatus={event?.status ?? "draft"}
                onCheckIn={() => {}}
                isCheckingIn={false}
                disableCheckin
              />
            ))}
          </Section>
        )}

        {}
        {rejected.length > 0 && (
          <Section title="Rejected" count={rejected.length} loading={isRsvpLoading}>
            {rejected.map((row) => (
              <div
                key={row.rsvpKey}
                className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:gap-6 opacity-60"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="font-mono text-xs text-violet-400 truncate">
                    {row.ownerAddress ? truncateAddress(row.ownerAddress) : "—"}
                  </p>
                  <p className="text-sm font-medium text-white truncate">
                    {row.data.attendeeName || "Anonymous"}
                  </p>
                  {row.data.attendeeEmail && (
                    <p className="text-xs text-zinc-500 truncate">{row.data.attendeeEmail}</p>
                  )}
                  {row.data.message && (
                    <p className="text-xs text-zinc-500 italic truncate">&quot;{row.data.message}&quot;</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Chip status="rejected" />
                  <XCircle size={14} className="text-rose-500" />
                </div>
              </div>
            ))}
          </Section>
        )}

        {}
        {notGoing.length > 0 && (
          <Section title="Not Going" count={notGoing.length} loading={isRsvpLoading}>
            {notGoing.map((row) => (
              <div
                key={row.rsvpKey}
                className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:gap-6 opacity-50"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="font-mono text-xs text-violet-400 truncate">
                    {row.ownerAddress ? truncateAddress(row.ownerAddress) : "—"}
                  </p>
                  <p className="text-sm font-medium text-white truncate">
                    {row.data.attendeeName || "Anonymous"}
                  </p>
                  {row.data.attendeeEmail && (
                    <p className="text-xs text-zinc-500 truncate">{row.data.attendeeEmail}</p>
                  )}
                  {row.data.message && (
                    <p className="text-xs text-zinc-500 italic truncate">&quot;{row.data.message}&quot;</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Chip status="not-going" />
                  <BanIcon size={13} className="text-zinc-500" />
                </div>
              </div>
            ))}
          </Section>
        )}

        {}
        {checkInMutation.isError && (
          <div className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 backdrop-blur-sm">
            <p className="font-mono text-xs text-rose-200">
              {(checkInMutation.error as Error)?.message ?? "Check-in failed"}
            </p>
          </div>
        )}
      </main>

      <ConfirmModal
        open={!!rejectTarget}
        title={`Reject ${rejectTarget?.data.attendeeName || "this request"}?`}
        message="The attendee's request will be declined. This cannot be undone."
        confirmLabel="Reject"
        destructive
        onConfirm={() => {
          if (rejectTarget)
            rejectMutation.mutate({ rsvpKey: rejectTarget.rsvpKey, ownerAddress: rejectTarget.ownerAddress });
        }}
        onClose={() => setRejectTarget(null)}
      />
    </div>
  );
}

function Section({
  title,
  count,
  loading,
  children,
}: {
  title: string;
  count: number;
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-zinc-200">{title}</h2>
        <span className="rounded-full border border-white/12 bg-white/[0.05] px-2 py-0.5 text-xs text-zinc-300">
          {count}
        </span>
      </div>

      <div className="divide-y divide-white/10 rounded-2xl border border-white/12 bg-white/[0.04] backdrop-blur-sm">
        {loading ? (
          <>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                <div className="h-3 w-32 rounded bg-white/[0.08]" />
                <div className="ml-auto h-3 w-24 rounded bg-white/[0.08]" />
              </div>
            ))}
          </>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function AttendeeRowItem({
  row,
  eventStatus,
  onCheckIn,
  isCheckingIn,
  disableCheckin = false,
}: {
  row: AttendeeRow;
  eventStatus: string;
  onCheckIn: () => void;
  isCheckingIn: boolean;
  disableCheckin?: boolean;
}) {
  const isCheckedIn = row.status === "checked-in";
  const canCheckIn = eventStatus === "live" && !isCheckedIn && !disableCheckin;

  return (
    <div className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:gap-6">
      {}
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="font-mono text-xs text-violet-300 truncate">
          {row.ownerAddress ? truncateAddress(row.ownerAddress) : "—"}
        </p>
        <p className="text-sm font-medium text-white truncate">
          {row.data.attendeeName || "Anonymous"}
        </p>
        {row.data.attendeeEmail && (
          <p className="text-xs text-zinc-400 truncate">{row.data.attendeeEmail}</p>
        )}
        {row.data.message && (
          <p className="text-xs text-zinc-500 italic truncate">&quot;{row.data.message}&quot;</p>
        )}
      </div>

      {}
      <div className="flex shrink-0 items-center gap-3">
        <Chip status={row.status} />
        {canCheckIn ? (
          <button
            onClick={onCheckIn}
            disabled={isCheckingIn}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-500/90 px-3 py-1.5 text-xs font-semibold text-emerald-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isCheckingIn ? (
              <>
                <SpinnerIcon />
                Checking in…
              </>
            ) : (
              "Check In"
            )}
          </button>
        ) : isCheckedIn ? (
          <span className="flex items-center gap-1 text-xs text-blue-400"><Check size={12} /> checked in</span>
        ) : null}
      </div>
    </div>
  );
}

function PendingRowItem({
  row,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
}: {
  row: AttendeeRow;
  onApprove: () => void;
  onReject: () => void;
  isApproving: boolean;
  isRejecting: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="font-mono text-xs text-violet-300 truncate">
          {row.ownerAddress ? truncateAddress(row.ownerAddress) : "—"}
        </p>
        <p className="text-sm font-medium text-white truncate">
          {row.data.attendeeName || "Anonymous"}
        </p>
        {row.data.attendeeEmail && (
          <p className="text-xs text-zinc-400 truncate">{row.data.attendeeEmail}</p>
        )}
        {row.data.message && (
          <p className="text-xs text-zinc-500 italic truncate">&quot;{row.data.message}&quot;</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Chip status="pending" />
        <button
          onClick={onApprove}
          disabled={isApproving || isRejecting}
          className="rounded-lg bg-emerald-500/90 px-3 py-1.5 text-xs font-semibold text-emerald-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isApproving ? "Approving…" : "Approve"}
        </button>
        <button
          onClick={onReject}
          disabled={isApproving || isRejecting}
          className="rounded-lg border border-rose-300/35 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-100 transition-colors hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isRejecting ? "Rejecting…" : "Reject"}
        </button>
      </div>
    </div>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <div className="px-5 py-8 text-center text-sm text-zinc-400">{message}</div>
  );
}

function HeaderStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "violet";
}) {
  const cls =
    tone === "violet"
      ? "border-violet-300/35 bg-violet-500/15 text-violet-100"
      : "border-white/12 bg-white/[0.04] text-zinc-300";

  return (
    <div className={`rounded-lg border px-4 py-2 text-center text-xs backdrop-blur-sm ${cls}`}>
      <p className="text-xl font-bold text-white">{value}</p>
      <p>{label}</p>
    </div>
  );
}

function FullSkeleton() {
  return (
    <div className="relative min-h-screen animate-pulse overflow-hidden bg-[#060912] text-white">
      <div className="pointer-events-none absolute inset-0" style={{ background: ORGANIZER_GLASS_BG }} />
      <div className="h-14 border-b border-white/10 bg-white/[0.03] backdrop-blur-sm" />
      <div className="relative mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6">
        <div className="h-8 w-64 rounded bg-white/[0.08]" />
        <div className="h-64 rounded-2xl border border-white/12 bg-white/[0.04]" />
      </div>
    </div>
  );
}

function SpinnerIcon() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}
