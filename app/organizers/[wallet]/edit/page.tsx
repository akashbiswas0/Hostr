"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";

import { useOrganizer } from "@/hooks/useOrganizer";
import { useWallet } from "@/hooks/useWallet";
import { updateOrganizerEntity } from "@/lib/arkiv/entities/organizer";
import { ConnectButton } from "@/components/ConnectButton";
import type { OrganizerProfile } from "@/lib/arkiv/types";

const inputCls =
  "w-full rounded-lg border border-white/10 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition-colors";
const labelCls = "mb-1.5 block text-xs font-medium text-zinc-400";

const EMPTY: OrganizerProfile = {
  name: "",
  bio: "",
  avatarUrl: "",
  website: "",
  twitter: "",
};

export default function EditOrganizerPage() {
  const params = useParams();
  const profileWallet = (params.wallet as string).toLowerCase();
  const router = useRouter();

  const { address, isConnected, isCorrectChain, walletClient } = useWallet();
  const { organizer, entityKey, isLoading } = useOrganizer();

  const [form, setForm] = useState<OrganizerProfile>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  
  useEffect(() => {
    if (organizer) {
      setForm({
        name: organizer.name ?? "",
        bio: organizer.bio ?? "",
        avatarUrl: organizer.avatarUrl ?? "",
        website: organizer.website ?? "",
        twitter: organizer.twitter ?? "",
      });
    }
  }, [organizer]);

  function set<K extends keyof OrganizerProfile>(key: K, value: OrganizerProfile[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  

  if (!isConnected || !isCorrectChain) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="text-4xl">{isConnected ? "⚠️" : "🔐"}</div>
          <h2 className="text-lg font-bold text-white">
            {isConnected ? "Wrong network" : "Wallet required"}
          </h2>
          <p className="text-sm text-zinc-500">
            Connect to the Kaolin testnet to edit your profile.
          </p>
          <div className="flex justify-center">
            <ConnectButton />
          </div>
        </div>
      </div>
    );
  }

  
  if (
    address &&
    address.toLowerCase() !== profileWallet
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="text-4xl">🚫</div>
          <h2 className="text-lg font-bold text-white">Not authorized</h2>
          <p className="text-sm text-zinc-500">
            You can only edit your own organizer profile.
          </p>
          <Link
            href={`/organizers/${profileWallet}`}
            className="block text-sm text-violet-400 hover:underline"
          >
            ← View profile
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) return <PageSkeleton />;

  

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!walletClient || !entityKey) return;
    setSubmitting(true);
    setError("");
    setSaved(false);

    const payload: OrganizerProfile = {
      ...form,
      twitter: form.twitter.replace(/^@/, ""),
      website: form.website.trim(),
    };

    const res = await updateOrganizerEntity(walletClient, entityKey, payload);
    if (res.success) {
      toast.success("Profile saved ✓");
      setSaved(true);
      setTimeout(() => router.push(`/organizers/${address?.toLowerCase()}`), 1_200);
    } else {
      setError(res.error);
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {}
      <nav className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/5 bg-zinc-950/90 px-4 backdrop-blur-sm sm:px-6">
        <Link
          href="/"
          className="text-sm font-semibold text-violet-400 hover:text-violet-300 transition-colors"
        >
          OnChain Events
        </Link>
        <Link
          href={`/organizers/${profileWallet}`}
          className="text-xs text-zinc-500 hover:text-white transition-colors"
        >
          ← Profile
        </Link>
      </nav>

      <main className="mx-auto max-w-lg px-4 py-10 sm:px-6">
        {}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Edit Profile</h1>
          <p className="mt-1 text-xs text-zinc-500">
            Updates are stored on-chain via Arkiv.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-2xl border border-white/5 bg-zinc-900 p-6 space-y-5">
            {}
            <div>
              <label className={labelCls}>
                Display name <span className="text-rose-400">*</span>
              </label>
              <input
                required
                type="text"
                placeholder="Satoshi Events"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className={inputCls}
              />
            </div>

            {}
            <div>
              <label className={labelCls}>Bio</label>
              <textarea
                rows={4}
                placeholder="A short bio about yourself or your organization…"
                value={form.bio}
                onChange={(e) => set("bio", e.target.value)}
                className={`${inputCls} resize-none`}
              />
            </div>

            {}
            <div>
              <label className={labelCls}>Avatar URL</label>
              <input
                type="url"
                placeholder="https://example.com/avatar.png"
                value={form.avatarUrl}
                onChange={(e) => set("avatarUrl", e.target.value)}
                className={inputCls}
              />
              {form.avatarUrl && (
                <div className="mt-2 flex items-center gap-2">
                  <img
                    src={form.avatarUrl}
                    alt="preview"
                    className="h-10 w-10 rounded-full object-cover ring-2 ring-white/10"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.opacity = "0.3";
                    }}
                  />
                  <span className="text-xs text-zinc-500">Preview</span>
                </div>
              )}
            </div>

            {}
            <div>
              <label className={labelCls}>Website</label>
              <input
                type="text"
                placeholder="https://yoursite.xyz"
                value={form.website}
                onChange={(e) => set("website", e.target.value)}
                className={inputCls}
              />
            </div>

            {}
            <div>
              <label className={labelCls}>Twitter / X handle</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
                  @
                </span>
                <input
                  type="text"
                  placeholder="yourhandle"
                  value={form.twitter.replace(/^@/, "")}
                  onChange={(e) => set("twitter", e.target.value.replace(/^@/, ""))}
                  className={`${inputCls} pl-7`}
                />
              </div>
            </div>
          </div>

          {}
          {error && (
            <div className="rounded-lg border border-red-800/40 bg-red-950/20 px-4 py-3">
              <p className="text-xs text-red-400 font-mono">{error}</p>
            </div>
          )}

          {}
          {saved && (
            <div className="rounded-lg border border-emerald-700/30 bg-emerald-950/20 px-4 py-3">
              <p className="text-xs text-emerald-400">
                ✓ Profile saved on-chain. Redirecting…
              </p>
            </div>
          )}

          {}
          <div className="flex gap-3">
            <Link
              href={`/organizers/${profileWallet}`}
              className="flex-1 rounded-xl border border-white/10 py-3 text-center text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting || saved || !form.name.trim()}
              className="flex-1 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <SpinnerIcon />
                  Saving to blockchain…
                </span>
              ) : (
                "Save Profile"
              )}
            </button>
          </div>

          {}
          <p className="text-center text-xs text-zinc-600">
            <Link
              href="/organizer/dashboard"
              className="text-violet-500 hover:underline"
            >
              → Go to Organizer Dashboard
            </Link>
          </p>
        </form>
      </main>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="min-h-screen bg-zinc-950 animate-pulse">
      <div className="h-14 bg-zinc-900 border-b border-white/5" />
      <div className="mx-auto max-w-lg px-4 py-10 sm:px-6 space-y-4">
        <div className="h-6 w-36 rounded bg-zinc-800" />
        <div className="h-80 rounded-2xl bg-zinc-900" />
      </div>
    </div>
  );
}

function SpinnerIcon() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v8H4z"
      />
    </svg>
  );
}
