"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { AlertTriangle, Lock, ShieldOff, ArrowLeft, ArrowRight, Check, Camera, X } from "lucide-react";

import { useOrganizer } from "@/hooks/useOrganizer";
import { useWallet } from "@/hooks/useWallet";
import { updateOrganizerEntity } from "@/lib/arkiv/entities/organizer";
import { Navbar } from "@/components/Navbar";
import { ConnectButton } from "@/components/ConnectButton";
import { uploadEventImage } from "@/lib/imagedb";
import type { OrganizerProfile } from "@/lib/arkiv/types";

const inputCls =
  "w-full rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2.5 text-sm text-white placeholder-zinc-400 focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400/40 transition-colors";
const labelCls = "mb-1.5 block text-xs font-medium text-zinc-300";
const ORGANIZER_GLASS_BG =
  "radial-gradient(circle at 18% 0%, rgba(37,99,235,0.28), transparent 36%), radial-gradient(circle at 80% 2%, rgba(99,102,241,0.22), transparent 30%), linear-gradient(180deg, #0a1120 0%, #060912 55%)";

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

  const [form, setForm] = useState<OrganizerProfile | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const organizerForm: OrganizerProfile = organizer
    ? {
        name: organizer.name ?? "",
        bio: organizer.bio ?? "",
        avatarUrl: organizer.avatarUrl ?? "",
        website: organizer.website ?? "",
        twitter: organizer.twitter ?? "",
      }
    : EMPTY;
  const formValue = form ?? organizerForm;

  function set<K extends keyof OrganizerProfile>(key: K, value: OrganizerProfile[K]) {
    setForm((prev) => ({ ...(prev ?? organizerForm), [key]: value }));
  }

  /** Resolve a media_id or URL to a displayable src. */
  function resolveAvatarSrc(url: string): string {
    if (!url) return "";
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(url)) {
      return `/api/imagedb/media/${url}`;
    }
    return url;
  }

  async function handleAvatarUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Image must be under 25 MB");
      return;
    }
    setImageUploading(true);
    const t = toast.loading("Uploading avatar…");
    try {
      const mediaId = await uploadEventImage(file);
      set("avatarUrl", mediaId);
      toast.success("Avatar uploaded ✓", { id: t });
    } catch (err) {
      toast.error(`Upload failed: ${err instanceof Error ? err.message : String(err)}`, { id: t });
    } finally {
      setImageUploading(false);
    }
  }

  if (!isConnected || !isCorrectChain) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#060912] p-6 text-white">
        <div className="pointer-events-none absolute inset-0" style={{ background: ORGANIZER_GLASS_BG }} />
        <div className="relative max-w-sm space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-white/[0.05] backdrop-blur-sm">
            {isConnected ? <AlertTriangle size={24} className="text-amber-400" /> : <Lock size={24} className="text-violet-400" />}
          </div>
          <h2 className="text-lg font-bold text-white">
            {isConnected ? "Wrong network" : "Sign in required"}
          </h2>
          <p className="text-sm text-zinc-300">
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
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#060912] p-6 text-white">
        <div className="pointer-events-none absolute inset-0" style={{ background: ORGANIZER_GLASS_BG }} />
        <div className="relative max-w-sm space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-white/[0.05] backdrop-blur-sm">
            <ShieldOff size={24} className="text-rose-400" />
          </div>
          <h2 className="text-lg font-bold text-white">Not authorized</h2>
          <p className="text-sm text-zinc-300">
            You can only edit your own organizer profile.
          </p>
          <Link
            href={`/organizers/${profileWallet}`}
            className="inline-flex items-center gap-1.5 text-sm text-violet-300 transition-colors hover:text-white"
          >
            <ArrowLeft size={14} /> View profile
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
      ...formValue,
      twitter: formValue.twitter.replace(/^@/, ""),
      website: formValue.website.trim(),
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
    <div className="relative min-h-screen overflow-hidden bg-[#060912] text-white">
      <div className="pointer-events-none absolute inset-0" style={{ background: ORGANIZER_GLASS_BG }} />
      <div className="relative z-10">
        <Navbar active="dashboard" />

        <main className="mx-auto max-w-lg px-4 py-10 sm:px-6">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">Edit Profile</h1>
            <p className="mt-1 text-xs text-zinc-300">
              Updates are saved securely via Arkiv.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-5 rounded-2xl border border-white/12 bg-white/[0.04] p-6 backdrop-blur-sm">
              <div>
                <label className={labelCls}>
                  Display name <span className="text-rose-400">*</span>
                </label>
                <input
                  required
                  type="text"
                  placeholder="Satoshi Events"
                  value={formValue.name}
                  onChange={(e) => set("name", e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Bio</label>
                <textarea
                  rows={4}
                  placeholder="A short bio about yourself or your organization…"
                  value={formValue.bio}
                  onChange={(e) => set("bio", e.target.value)}
                  className={`${inputCls} resize-none`}
                />
              </div>

            {/* Profile Photo */}
            <div>
              <label className={labelCls}>Profile Photo</label>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={imageUploading}
                  className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-dashed border-white/20 bg-white/[0.06] transition-colors hover:border-violet-400 disabled:opacity-60"
                >
                  {formValue.avatarUrl ? (
                    <img
                      src={resolveAvatarSrc(formValue.avatarUrl)}
                      alt="avatar"
                      className="h-full w-full aspect-square object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "0.3"; }}
                    />
                  ) : (
                    <Camera size={22} className="absolute inset-0 m-auto text-zinc-500" />
                  )}
                  {imageUploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                      <SpinnerIcon />
                    </div>
                  )}
                  <span className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-zinc-700">
                    <Camera size={11} className="text-zinc-300" />
                  </span>
                </button>
                <div className="flex-1">
                  <p className="text-xs text-zinc-300">
                    {formValue.avatarUrl ? "Click photo to change" : "Click to upload a profile photo"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-500">PNG, JPG, WebP or GIF · max 25 MB</p>
                  {formValue.avatarUrl && (
                    <button
                      type="button"
                      onClick={() => set("avatarUrl", "")}
                      className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-rose-400 transition-colors"
                    >
                      <X size={11} /> Remove photo
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
            </div>

            {/* Website */}
            <div>
              <label className={labelCls}>Website</label>
              <input
                type="text"
                placeholder="https://yoursite.xyz"
                value={formValue.website}
                onChange={(e) => set("website", e.target.value)}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Twitter / X handle</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
                  @
                </span>
                <input
                  type="text"
                  placeholder="yourhandle"
                  value={formValue.twitter.replace(/^@/, "")}
                  onChange={(e) => set("twitter", e.target.value.replace(/^@/, ""))}
                  className={`${inputCls} pl-7`}
                />
              </div>
            </div>
            </div>

            {error && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 backdrop-blur-sm">
                <p className="text-xs font-mono text-rose-200">{error}</p>
              </div>
            )}

            {saved && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 backdrop-blur-sm">
                <p className="flex items-center gap-1.5 text-xs text-emerald-200">
                  <Check size={12} /> Profile saved. Redirecting…
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <Link
                href={`/organizers/${profileWallet}`}
                className="flex-1 rounded-xl border border-white/15 bg-white/[0.03] py-3 text-center text-sm text-zinc-300 transition-colors hover:border-white/25 hover:text-white"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting || saved || !formValue.name.trim()}
                className="flex-1 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(99,102,241,0.35)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <SpinnerIcon />
                    Saving…
                  </span>
                ) : (
                  "Save Profile"
                )}
              </button>
            </div>

            <p className="text-center text-xs text-zinc-400">
              <Link
                href="/organizer/dashboard"
                className="inline-flex items-center justify-center gap-1 text-violet-300 transition-colors hover:text-white"
              >
                <ArrowRight size={12} /> Go to Organizer Dashboard
              </Link>
            </p>
          </form>
        </main>
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
        <div className="mx-auto max-w-lg space-y-4 px-4 py-10 sm:px-6">
          <div className="h-6 w-36 rounded bg-white/[0.08]" />
          <div className="h-80 rounded-2xl border border-white/10 bg-white/[0.05]" />
        </div>
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
