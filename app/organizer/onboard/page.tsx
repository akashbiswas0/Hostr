"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { AlertTriangle, Lock, ArrowLeft, ArrowRight } from "lucide-react";
import { useOrganizer } from "@/hooks/useOrganizer";
import { useWallet } from "@/hooks/useWallet";
import { createOrganizerEntity } from "@/lib/arkiv/entities/organizer";
import { ConnectButton } from "@/components/ConnectButton";
import type { OrganizerProfile } from "@/lib/arkiv/types";

const EMPTY: OrganizerProfile = {
  name: "",
  bio: "",
  avatarUrl: "",
  website: "",
  twitter: "",
};

const inputCls =
  "w-full rounded-lg border border-white/10 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition-colors";

export default function OnboardPage() {
  const router = useRouter();
  const { address, isConnected, isCorrectChain, walletClient } = useWallet();
  const { organizer, isLoading: profileLoading, refetch } = useOrganizer();

  
  useEffect(() => {
    if (!profileLoading && organizer) {
      router.push("/organizer/dashboard");
    }
  }, [organizer, profileLoading, router]);

  const [form, setForm] = useState<OrganizerProfile>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function set(key: keyof OrganizerProfile, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!walletClient) return;
    setSubmitting(true);
    setError("");

    const res = await createOrganizerEntity(walletClient, form);
    if (res.success) {
      toast.success("Profile saved on-chain ✓");
      await refetch();
      router.push("/organizer/dashboard");
    } else {
      setError(res.error);
      setSubmitting(false);
    }
  }

  
  if (!isConnected || !isCorrectChain) {
    return (
      <WalletGate
        isConnected={isConnected}
        isCorrectChain={isCorrectChain}
      />
    );
  }

  if (profileLoading) {
    return <PageSkeleton />;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {}
      <nav className="border-b border-white/5 bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors">
            <ArrowLeft size={14} /> Back
          </Link>
          <ConnectButton />
        </div>
      </nav>

      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        {}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-700/30 bg-violet-950/20 px-3 py-1 text-xs font-medium text-violet-300 mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
            One-time setup
          </div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">
            Create your organizer profile
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Your profile is stored on-chain and owned by{" "}
            <span className="font-mono text-zinc-300">
              {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "—"}
            </span>
          </p>
        </div>

        {}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-2xl border border-white/5 bg-zinc-900 p-6 space-y-5">
            <Field label="Display name" required>
              <input
                required
                type="text"
                placeholder="Your name or organization"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className={inputCls}
              />
            </Field>

            <Field label="Bio">
              <textarea
                rows={3}
                placeholder="Tell attendees a bit about yourself or your organization…"
                value={form.bio}
                onChange={(e) => set("bio", e.target.value)}
                className={`${inputCls} resize-none`}
              />
            </Field>

            <Field label="Avatar URL">
              <input
                type="url"
                placeholder="https://example.com/avatar.jpg"
                value={form.avatarUrl}
                onChange={(e) => set("avatarUrl", e.target.value)}
                className={inputCls}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Website">
                <input
                  type="url"
                  placeholder="https://yoursite.com"
                  value={form.website}
                  onChange={(e) => set("website", e.target.value)}
                  className={inputCls}
                />
              </Field>

              <Field label="Twitter / X handle">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">@</span>
                  <input
                    type="text"
                    placeholder="handle"
                    value={form.twitter}
                    onChange={(e) => set("twitter", e.target.value.replace(/^@/, ""))}
                    className={`${inputCls} pl-7`}
                  />
                </div>
              </Field>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-800/40 bg-red-950/20 px-4 py-3">
              <p className="text-xs text-red-400 font-mono">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !form.name}
            className="w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-lg shadow-violet-900/30"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <SpinnerIcon />
                Saving to blockchain…
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">Create Profile &amp; Continue <ArrowRight size={14} /></span>
            )}
          </button>
        </form>
      </main>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-zinc-400">
        {label}
        {required && <span className="ml-0.5 text-rose-400"> *</span>}
      </label>
      {children}
    </div>
  );
}

function WalletGate({
  isConnected,
  isCorrectChain,
}: {
  isConnected: boolean;
  isCorrectChain: boolean;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6">
      <div className="text-center space-y-4 max-w-sm">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 border border-white/10 mx-auto">
            {isConnected ? <AlertTriangle size={24} className="text-amber-400" /> : <Lock size={24} className="text-violet-400" />}
          </div>
        <h2 className="text-lg font-bold text-white">
          {isConnected ? "Wrong network" : "Connect your wallet"}
        </h2>
        <p className="text-sm text-zinc-400">
          {isConnected
            ? "Switch to Kaolin to create your organizer profile."
            : "You need a connected wallet to create an organizer profile."}
        </p>
        <div className="flex justify-center">
          <ConnectButton />
        </div>
      </div>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="min-h-screen bg-zinc-950 animate-pulse">
      <div className="h-14 border-b border-white/5 bg-zinc-900" />
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 space-y-6">
        <div className="h-8 w-48 rounded bg-zinc-800" />
        <div className="h-64 rounded-2xl bg-zinc-900" />
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
