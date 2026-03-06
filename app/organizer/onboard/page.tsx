"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { AlertTriangle, Lock, ArrowRight, Camera, X } from "lucide-react";
import { useOrganizer } from "@/hooks/useOrganizer";
import { useWallet } from "@/hooks/useWallet";
import { createOrganizerEntity } from "@/lib/arkiv/entities/organizer";
import { Navbar } from "@/components/Navbar";
import { ConnectButton } from "@/components/ConnectButton";
import { uploadEventImage } from "@/lib/imagedb";
import type { OrganizerProfile } from "@/lib/arkiv/types";

const EMPTY: OrganizerProfile = {
  name: "",
  bio: "",
  avatarUrl: "",
  website: "",
  twitter: "",
};

const inputCls =
  "w-full rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2.5 text-sm text-white placeholder-zinc-400 focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400/40 transition-colors";
const ORGANIZER_GLASS_BG =
  "radial-gradient(circle at 18% 0%, rgba(37,99,235,0.28), transparent 36%), radial-gradient(circle at 80% 2%, rgba(99,102,241,0.22), transparent 30%), linear-gradient(180deg, #0a1120 0%, #060912 55%)";

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
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function set(key: keyof OrganizerProfile, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleAvatarUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Image must be under 25 MB");
      return;
    }
    setImagePreview(URL.createObjectURL(file));
    setImageUploading(true);
    const t = toast.loading("Uploading avatar…");
    try {
      const mediaId = await uploadEventImage(file);
      set("avatarUrl", mediaId);
      toast.success("Avatar uploaded ✓", { id: t });
    } catch (err) {
      toast.error(`Upload failed: ${err instanceof Error ? err.message : String(err)}`, { id: t });
      setImagePreview(null);
      set("avatarUrl", "");
    } finally {
      setImageUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!walletClient) return;
    setSubmitting(true);
    setError("");

    const res = await createOrganizerEntity(walletClient, form);
    if (res.success) {
      toast.success("Profile saved ✓");
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
      />
    );
  }

  if (profileLoading) {
    return <PageSkeleton />;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#060912] text-white">
      <div className="pointer-events-none absolute inset-0" style={{ background: ORGANIZER_GLASS_BG }} />
      <div className="relative z-10">
        <Navbar active="dashboard" />

        <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
          <div className="mb-8">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-3 py-1 text-xs font-medium text-zinc-200 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-300" />
              One-time setup
            </div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">
              Create your organizer profile
            </h1>
            <p className="mt-2 text-sm text-zinc-300">
              Your profile is securely stored and owned by{" "}
              <span className="font-mono text-zinc-200">
                {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "—"}
              </span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-5 rounded-2xl border border-white/12 bg-white/[0.04] p-6 backdrop-blur-sm">
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

            <Field label="Profile Photo">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={imageUploading}
                  className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-dashed border-white/20 bg-white/[0.06] transition-colors hover:border-violet-400 disabled:opacity-60"
                >
                  {imagePreview ? (
                    <img src={imagePreview} alt="avatar preview" className="h-full w-full aspect-square object-cover" />
                  ) : (
                    <Camera size={22} className="absolute inset-0 m-auto text-zinc-500" />
                  )}
                  {imageUploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                      <SpinnerIcon />
                    </div>
                  )}
                </button>
                <div className="flex-1">
                  <p className="text-xs text-zinc-300">
                    {imagePreview ? "Click photo to change" : "Click to upload a profile photo"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-500">PNG, JPG, WebP or GIF · max 25 MB</p>
                  {imagePreview && (
                    <button
                      type="button"
                      onClick={() => { setImagePreview(null); set("avatarUrl", ""); }}
                      className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-rose-400 transition-colors"
                    >
                      <X size={11} /> Remove
                    </button>
                  )}
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
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
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 backdrop-blur-sm">
                <p className="text-xs font-mono text-rose-200">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !form.name}
              className="w-full rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(99,102,241,0.35)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <SpinnerIcon />
                  Saving…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">Create Profile &amp; Continue <ArrowRight size={14} /></span>
              )}
            </button>
          </form>
        </main>
      </div>
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
}: {
  isConnected: boolean;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#060912] p-6 text-white">
      <div className="pointer-events-none absolute inset-0" style={{ background: ORGANIZER_GLASS_BG }} />
      <div className="relative max-w-sm space-y-4 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-white/[0.05] backdrop-blur-sm">
          {isConnected ? <AlertTriangle size={24} className="text-amber-400" /> : <Lock size={24} className="text-violet-400" />}
        </div>
        <h2 className="text-lg font-bold text-white">
          {isConnected ? "Wrong network" : "Connect your wallet"}
        </h2>
        <p className="text-sm text-zinc-300">
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
    <div className="relative min-h-screen animate-pulse overflow-hidden bg-[#060912] text-white">
      <div className="pointer-events-none absolute inset-0" style={{ background: ORGANIZER_GLASS_BG }} />
      <div className="relative">
        <div className="h-16 border-b border-white/10 bg-white/[0.04]" />
        <div className="mx-auto max-w-2xl space-y-6 px-4 py-12 sm:px-6">
          <div className="h-8 w-48 rounded bg-white/[0.08]" />
          <div className="h-64 rounded-2xl border border-white/10 bg-white/[0.05]" />
        </div>
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
