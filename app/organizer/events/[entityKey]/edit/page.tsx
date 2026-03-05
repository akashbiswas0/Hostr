"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import type { Hex } from "viem";
import { useEvent } from "@/hooks/useEvent";
import { useWallet } from "@/hooks/useWallet";
import { publicClient } from "@/lib/arkiv/client";
import { updateEventDetails } from "@/lib/arkiv/entities/event";
import { OrganizerNav } from "@/components/OrganizerNav";
import { ConnectButton } from "@/components/ConnectButton";
import type { Event } from "@/lib/arkiv/types";

type FormState = Event;

const CATEGORIES = [
  "DeFi", "NFT", "Gaming", "IRL", "Virtual",
  "Infrastructure", "DAO", "Education", "Other",
];

const inputCls =
  "w-full rounded-lg border border-white/10 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition-colors";
const labelCls = "mb-1.5 block text-xs font-medium text-zinc-400";

function toLocalInput(value: unknown): string {
  if (!value) return "";
  const str = String(value);
  
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str)) return str.slice(0, 16);
  
  if (/^\d+$/.test(str)) {
    const ms = Number(str) * 1_000;
    return new Date(ms - new Date(ms).getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 16);
  }
  
  const d = new Date(str);
  if (isNaN(d.getTime())) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

export default function EditEventPage() {
  const params = useParams();
  const router = useRouter();
  const entityKey = params.entityKey as Hex;

  const { event, entity, isLoading } = useEvent(entityKey);
  const { address, isConnected, isCorrectChain, walletClient } = useWallet();

  const [form, setForm] = useState<FormState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  
  useEffect(() => {
    if (event) {
      setForm({
        ...event,
        date: toLocalInput(event.date),
        endDate: toLocalInput(event.endDate),
        virtualLink: event.virtualLink ?? "",
      });
    }
  }, [event]);

  
  if (!isConnected || !isCorrectChain) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="text-4xl">{isConnected ? "⚠️" : "🔐"}</div>
          <h2 className="text-lg font-bold text-white">
            {isConnected ? "Wrong network" : "Wallet required"}
          </h2>
          <div className="flex justify-center"><ConnectButton /></div>
        </div>
      </div>
    );
  }

  if (isLoading || !form) return <FullSkeleton />;

  if (!entity) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6">
        <div className="text-center space-y-3">
          <p className="text-white font-bold">Event not found</p>
          <Link href="/organizer/dashboard" className="text-sm text-violet-400 hover:underline">
            ← Dashboard
          </Link>
        </div>
      </div>
    );
  }

  
  if (
    address &&
    entity.owner &&
    entity.owner.toLowerCase() !== address.toLowerCase()
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6">
        <div className="text-center space-y-3">
          <div className="text-4xl">🚫</div>
          <p className="text-white font-bold">Not authorized</p>
          <p className="text-sm text-zinc-400">
            Only the event owner can edit this event.
          </p>
          <Link href="/organizer/dashboard" className="text-sm text-violet-400 hover:underline">
            ← Dashboard
          </Link>
        </div>
      </div>
    );
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => prev ? { ...prev, [key]: value } : prev);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!walletClient || !form) return;
    setSubmitting(true);
    setError("");
    setSaved(false);

    const updated: Event = {
      ...form,
      virtualLink: form.virtualLink?.trim() || undefined,
    };

    const res = await updateEventDetails(walletClient, publicClient, entityKey, updated);
    if (res.success) {
      toast.success("Event saved on-chain ✓");
      setSaved(true);
      setTimeout(() => router.push(`/organizer/dashboard`), 1_000);
    } else {
      setError(res.error);
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <OrganizerNav crumb="Edit Event" />

      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="mb-8">
          <Link
            href="/organizer/dashboard"
            className="text-sm text-zinc-500 hover:text-white transition-colors"
          >
            ← Dashboard
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-white truncate">
            Edit: {event?.title}
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            Changes are recorded on-chain and cannot be undone.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-2xl border border-white/5 bg-zinc-900 p-6 space-y-5">
            {}
            <div>
              <label className={labelCls}>
                Title <span className="text-rose-400">*</span>
              </label>
              <input
                required
                type="text"
                value={form.title}
                onChange={(e) => setField("title", e.target.value)}
                className={inputCls}
              />
            </div>

            {}
            <div>
              <label className={labelCls}>
                Description <span className="text-rose-400">*</span>
              </label>
              <textarea
                required
                rows={5}
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                className={`${inputCls} resize-none`}
              />
            </div>

            {}
            <div>
              <label className={labelCls}>Category</label>
              <select
                value={form.category}
                onChange={(e) => setField("category", e.target.value)}
                className={inputCls}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>
                  Start <span className="text-rose-400">*</span>
                </label>
                <input
                  required
                  type="datetime-local"
                  value={form.date}
                  onChange={(e) => setField("date", e.target.value)}
                  className={`${inputCls} [color-scheme:dark]`}
                />
              </div>
              <div>
                <label className={labelCls}>
                  End <span className="text-rose-400">*</span>
                </label>
                <input
                  required
                  type="datetime-local"
                  value={form.endDate}
                  min={form.date}
                  onChange={(e) => setField("endDate", e.target.value)}
                  className={`${inputCls} [color-scheme:dark]`}
                />
              </div>
            </div>

            {}
            <div>
              <label className={labelCls}>Location</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setField("location", e.target.value)}
                className={inputCls}
              />
            </div>

            {}
            <div>
              <label className={labelCls}>Virtual link (optional)</label>
              <input
                type="url"
                placeholder="https://…"
                value={form.virtualLink ?? ""}
                onChange={(e) => setField("virtualLink", e.target.value)}
                className={inputCls}
              />
            </div>

            {}
            <div>
              <label className={labelCls}>
                Capacity <span className="text-rose-400">*</span>
              </label>
              <input
                required
                type="number"
                min={1}
                value={form.capacity}
                onChange={(e) => setField("capacity", Number(e.target.value))}
                className={inputCls}
              />
            </div>
          </div>

          {}
          <div className="rounded-lg border border-amber-700/20 bg-amber-950/10 px-4 py-3 text-xs text-amber-400">
            Current status: <strong className="text-white">{form.status}</strong>.
            {" "}To change the status, use the dashboard controls.
          </div>

          {error && (
            <div className="rounded-lg border border-red-800/40 bg-red-950/20 px-4 py-3">
              <p className="text-xs text-red-400 font-mono">{error}</p>
            </div>
          )}

          {saved && (
            <div className="rounded-lg border border-emerald-700/30 bg-emerald-950/20 px-4 py-3">
              <p className="text-xs text-emerald-400">
                ✓ Saved on-chain. Redirecting to dashboard…
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <Link
              href="/organizer/dashboard"
              className="flex-1 rounded-xl border border-white/10 py-3 text-center text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting || saved}
              className="flex-1 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <SpinnerIcon />
                  Saving to blockchain…
                </span>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

function FullSkeleton() {
  return (
    <div className="min-h-screen bg-zinc-950 animate-pulse">
      <div className="h-14 bg-zinc-900 border-b border-white/5" />
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 space-y-4">
        <div className="h-6 w-48 rounded bg-zinc-800" />
        <div className="h-96 rounded-2xl bg-zinc-900" />
      </div>
    </div>
  );
}

function SpinnerIcon() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}
