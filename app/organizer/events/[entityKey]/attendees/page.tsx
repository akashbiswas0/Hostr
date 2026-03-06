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
import { confirmRsvp, rejectRsvp } from "@/lib/arkiv/entities/rsvp";
import { autoPromoteCapacityStatus } from "@/lib/arkiv/entities/event";
import { getRsvpsByEvent, getApprovalsByEvent, getRejectionsByEvent, getApprovalForRsvp, getRejectionForRsvp } from "@/lib/arkiv/queries/rsvps";
import { createCheckinEntity } from "@/lib/arkiv/entities/checkin";
import { getCheckinsByEvent, hasAttendeeCheckedIn } from "@/lib/arkiv/queries/checkins";
import { createPoAEntity } from "@/lib/arkiv/entities/attendance";
import { OrganizerNav } from "@/components/OrganizerNav";
import { ConnectButton } from "@/components/ConnectButton";
import { ConfirmModal } from "@/components/ConfirmModal";
import { friendlyError } from "@/lib/arkiv/errors";
import type { RSVP, RSVPStatus } from "@/lib/arkiv/types";

type EffectiveStatus = RSVPStatus | "rejected" | "not-going";

interface AttendeeRow {
  entity: Entity;
  rsvpKey: Hex;
  ownerAddress: Hex;
  data: RSVP;
  status: EffectiveStatus;
}

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
    pending: "bg-violet-900/50 text-violet-300 border-violet-700/30",
    confirmed: "bg-emerald-900/50 text-emerald-300 border-emerald-700/30",
    waitlisted: "bg-amber-900/50 text-amber-300 border-amber-700/30",
    "checked-in": "bg-blue-900/50 text-blue-300 border-blue-700/30",
    rejected: "bg-rose-900/50 text-rose-300 border-rose-700/30",
    "not-going": "bg-zinc-800 text-zinc-400 border-zinc-700/30",
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
      const res = await getRsvpsByEvent(publicClient, entityKey);
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

  // Approval entities (owned by organizer, one per approved pending RSVP)
  const {
    data: approvalEntities,
    refetch: refetchApprovals,
  } = useQuery<Entity[]>({
    queryKey: ["rsvp-approvals", entityKey],
    queryFn: async () => {
      const res = await getApprovalsByEvent(publicClient, entityKey);
      return res.success ? res.data : [];
    },
    enabled: !!entityKey,
  });

  // Rejection entities (owned by organizer, one per rejected pending RSVP)
  const {
    data: rejectionEntities,
    refetch: refetchRejections,
  } = useQuery<Entity[]>({
    queryKey: ["rsvp-rejections", entityKey],
    queryFn: async () => {
      const res = await getRejectionsByEvent(publicClient, entityKey);
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

  // Set of rsvpKeys that have been approved by the organizer
  const approvedRsvpKeys = useMemo(() => {
    return new Set(
      (approvalEntities ?? []).map((e) => {
        const attr = e.attributes.find((a) => a.key === "rsvpKey");
        return ((attr?.value as string) ?? "").toLowerCase();
      }),
    );
  }, [approvalEntities]);

  // Set of rsvpKeys that have been rejected by the organizer
  const rejectedRsvpKeys = useMemo(() => {
    return new Set(
      (rejectionEntities ?? []).map((e) => {
        const attr = e.attributes.find((a) => a.key === "rsvpKey");
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
      // Prevent duplicate check-in
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

      // Mint proof-of-attendance (non-fatal)
      try {
        await createPoAEntity(
          walletClient,
          publicClient,
          entityKey,
          vars.rsvpKey,
          vars.ownerAddress,
          checkinRes.data.entityKey,
          event?.title ?? "",
        );
      } catch { /* PoA is best-effort */ }
    },
    onSuccess: () => {
      toast.success("Attendee checked in ✓");
      refetchRsvps();
      refetchCheckins();
    },
    onError: (e) => toast.error(friendlyError(e instanceof Error ? e.message : "Check-in failed")),
  });

  // Approve a pending RSVP request — creates an organizer-owned approval entity
  const approveMutation = useMutation({
    mutationFn: async (vars: { rsvpKey: Hex; ownerAddress: Hex }) => {
      if (!walletClient || !event?.endDate) throw new Error("Wallet or event data missing");
      // Prevent approving a rejected RSVP
      const rejRes = await getRejectionForRsvp(publicClient, vars.rsvpKey);
      if (rejRes.success && rejRes.data) throw new Error("Cannot approve — this RSVP was already rejected");
      const ms = toMs(event.endDate);
      const endDateSeconds = isNaN(ms)
        ? Math.floor(Date.now() / 1_000) + 86_400
        : Math.floor(ms / 1_000);
      const res = await confirmRsvp(
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
      // Capacity-status promotion is now handled here (not on RSVP submission)
      autoPromoteCapacityStatus(walletClient!, publicClient, entityKey).catch(() => {});
    },
    onError: (e) => toast.error(friendlyError(e instanceof Error ? e.message : "Approval failed")),
  });

  // Reject a pending RSVP request — creates an organizer-owned rejection entity
  const rejectMutation = useMutation({
    mutationFn: async (vars: { rsvpKey: Hex; ownerAddress: Hex }) => {
      if (!walletClient || !event?.endDate) throw new Error("Wallet or event data missing");
      // Prevent rejecting an approved RSVP
      const appRes = await getApprovalForRsvp(publicClient, vars.rsvpKey);
      if (appRes.success && appRes.data) throw new Error("Cannot reject — this RSVP was already approved");
      const ms = toMs(event.endDate);
      const endDateSeconds = isNaN(ms)
        ? Math.floor(Date.now() / 1_000) + 86_400
        : Math.floor(ms / 1_000);
      const res = await rejectRsvp(
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
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6">
        <div className="text-center space-y-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 border border-white/10 mx-auto">
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
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6">
        <div className="text-center space-y-3">
          <p className="text-white font-bold">Event not found</p>
          <Link href="/organizer/dashboard" className="flex items-center justify-center gap-1.5 text-sm text-violet-400 hover:underline">
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
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6">
        <div className="text-center space-y-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 border border-white/10 mx-auto">
            <ShieldOff size={22} className="text-rose-400" />
          </div>
          <p className="text-white font-bold">Not authorized</p>
          <p className="text-sm text-zinc-400">
            Only the event owner can manage attendees.
          </p>
          <Link href="/organizer/dashboard" className="flex items-center justify-center gap-1.5 text-sm text-violet-400 hover:underline">
            <ArrowLeft size={14} /> Dashboard
          </Link>
        </div>
      </div>
    );
  }

  
  
  
  
  const allRows: AttendeeRow[] = (rsvpEntities ?? []).map((ent) => {
    const data = ent.toJson() as RSVP;
    const ownerAddress = (ent.owner ?? "") as Hex;
    const isCheckedIn = checkedInWallets.has(ownerAddress.toLowerCase());
    const rsvpKeyLower = (ent.key as string).toLowerCase();

    const statusAttr = ent.attributes.find((a) => a.key === "status");
    const rsvpAttrStatus = (statusAttr?.value as RSVPStatus) ?? "confirmed";

    // Derive effective status: checkin > rejection > approval > raw status
    let status: EffectiveStatus;
    if (isCheckedIn) {
      status = "checked-in";    } else if (rsvpAttrStatus === "not-going") {
      status = "not-going";    } else if (rsvpAttrStatus === "pending" && rejectedRsvpKeys.has(rsvpKeyLower)) {
      status = "rejected";
    } else if (rsvpAttrStatus === "pending" && approvedRsvpKeys.has(rsvpKeyLower)) {
      // Organizer approved this pending request
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

  // Pending = status still "pending" AND not yet approved or rejected
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
    <div className="min-h-screen bg-zinc-950 text-white">
      <OrganizerNav crumb="Manage Attendees" />

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 space-y-8">
        {}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/organizer/dashboard"
              className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-white transition-colors"
            >
              <ArrowLeft size={14} /> Dashboard
            </Link>
            <h1 className="mt-2 text-2xl font-bold truncate">
              {event?.title ?? "Attendees"}
            </h1>
            {event?.date && (
              <p className="mt-0.5 text-xs text-zinc-500">{formatDate(event.date)}</p>
            )}
          </div>

          {}
          <div className="flex items-center gap-3 self-start">
            {pending.length > 0 && (
              <div className="rounded-lg border border-violet-700/30 bg-violet-950/30 px-4 py-2 text-center text-xs text-violet-300">
                <p className="text-xl font-bold text-white">{pending.length}</p>
                <p>Pending</p>
              </div>
            )}
            <div className="rounded-lg border border-white/5 bg-zinc-900 px-4 py-2 text-center text-xs text-zinc-400">
              <p className="text-xl font-bold text-white">{confirmed.length}</p>
              <p>Confirmed</p>
            </div>
            <div className="rounded-lg border border-white/5 bg-zinc-900 px-4 py-2 text-center text-xs text-zinc-400">
              <p className="text-xl font-bold text-white">{checkedIn.length}</p>
              <p>Checked In</p>
            </div>
            <div className="rounded-lg border border-white/5 bg-zinc-900 px-4 py-2 text-center text-xs text-zinc-400">
              <p className="text-xl font-bold text-white">{waitlisted.length}</p>
              <p>Waitlisted</p>
            </div>
            {rejected.length > 0 && (
              <div className="rounded-lg border border-rose-700/30 bg-rose-950/20 px-4 py-2 text-center text-xs text-rose-300">
                <p className="text-xl font-bold text-white">{rejected.length}</p>
                <p>Rejected</p>
              </div>
            )}
            {notGoing.length > 0 && (
              <div className="rounded-lg border border-zinc-700/30 bg-zinc-800/30 px-4 py-2 text-center text-xs text-zinc-400">
                <p className="text-xl font-bold text-white">{notGoing.length}</p>
                <p>Not Going</p>
              </div>
            )}
            <button
              onClick={handleExport}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-zinc-300 hover:border-white/20 hover:text-white transition-colors flex items-center gap-1.5"
            >
              <Download size={13} /> Export CSV
            </button>
            <Link
              href={`/organizer/events/${entityKey}/checkin`}
              className="rounded-lg border border-violet-700/40 bg-violet-950/30 px-3 py-2 text-xs font-medium text-violet-300 hover:bg-violet-900/40 hover:text-white transition-colors flex items-center gap-1.5"
            >
              <ScanLine size={13} /> Check-in Scanner
            </Link>
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
                    <p className="text-xs text-zinc-600 italic truncate">&quot;{row.data.message}&quot;</p>
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
                    <p className="text-xs text-zinc-600 italic truncate">&quot;{row.data.message}&quot;</p>
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
          <div className="rounded-lg border border-red-800/40 bg-red-950/20 px-4 py-3">
            <p className="text-xs text-red-400 font-mono">
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
        <h2 className="text-sm font-semibold text-zinc-300">{title}</h2>
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
          {count}
        </span>
      </div>

      <div className="rounded-2xl border border-white/5 bg-zinc-900 divide-y divide-white/5">
        {loading ? (
          <>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                <div className="h-3 w-32 rounded bg-zinc-800" />
                <div className="h-3 w-24 rounded bg-zinc-800 ml-auto" />
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
          <p className="text-xs text-zinc-600 italic truncate">&quot;{row.data.message}&quot;</p>
        )}
      </div>

      {}
      <div className="flex shrink-0 items-center gap-3">
        <Chip status={row.status} />
        {canCheckIn ? (
          <button
            onClick={onCheckIn}
            disabled={isCheckingIn}
            className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
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
          <p className="text-xs text-zinc-600 italic truncate">&quot;{row.data.message}&quot;</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Chip status="pending" />
        <button
          onClick={onApprove}
          disabled={isApproving || isRejecting}
          className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isApproving ? "Approving…" : "Approve"}
        </button>
        <button
          onClick={onReject}
          disabled={isApproving || isRejecting}
          className="rounded-lg border border-rose-800/40 bg-rose-950/20 px-3 py-1.5 text-xs font-semibold text-rose-400 hover:bg-rose-950/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isRejecting ? "Rejecting…" : "Reject"}
        </button>
      </div>
    </div>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <div className="px-5 py-8 text-center text-sm text-zinc-600">{message}</div>
  );
}

function FullSkeleton() {
  return (
    <div className="min-h-screen bg-zinc-950 animate-pulse">
      <div className="h-14 bg-zinc-900 border-b border-white/5" />
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 space-y-6">
        <div className="h-8 w-64 rounded bg-zinc-800" />
        <div className="h-64 rounded-2xl bg-zinc-900" />
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
