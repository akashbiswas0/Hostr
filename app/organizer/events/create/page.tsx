"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { AlertTriangle, Lock, ClipboardList, Image as ImageIcon, ArrowLeft, ArrowRight, Check } from "lucide-react";

import { useOrganizer } from "@/hooks/useOrganizer";
import { useWallet } from "@/hooks/useWallet";
import { createEventEntity } from "@/lib/arkiv/entities/event";
import { OrganizerNav } from "@/components/OrganizerNav";
import { ConnectButton } from "@/components/ConnectButton";
import type { Event } from "@/lib/arkiv/types";

const CATEGORIES = [
  "DeFi",
  "NFT",
  "Gaming",
  "IRL",
  "Virtual",
  "Infrastructure",
  "DAO",
  "Education",
  "Other",
];

const EMPTY_FORM: Omit<Event, "status"> = {
  title: "",
  description: "",
  category: "",
  date: "",
  endDate: "",
  location: "",
  virtualLink: "",
  capacity: 100,
  requiresRsvp: false,
  imageUrl: "",
};

type FormState = typeof EMPTY_FORM;

const inputCls =
  "w-full rounded-lg border border-white/10 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition-colors";
const labelCls = "mb-1.5 block text-xs font-medium text-zinc-400";

function step1Valid(f: FormState) {
  return f.title.trim() !== "" && f.description.trim() !== "" && f.category !== "";
}

function step2Valid(f: FormState) {
  if (!f.date || !f.endDate) return false;
  if (f.date >= f.endDate) return false;
  if (!f.location.trim() && !f.virtualLink?.trim()) return false;
  if (f.capacity < 1) return false;
  return true;
}

function toMs(value: unknown): number {
  if (!value) return NaN;
  const str = String(value);
  if (/^\d+$/.test(str)) return Number(str) * 1_000;
  const t = Date.parse(str);
  return isNaN(t) ? NaN : t;
}

function formatReview(value: string) {
  const ms = toMs(value);
  if (isNaN(ms)) return "—";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ms));
}

export default function CreateEventPage() {
  const router = useRouter();
  const { isConnected, isCorrectChain, walletClient } = useWallet();
  const { isOrganizer, isLoading: profileLoading, entityKey: organizerKey, organizer } = useOrganizer();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [publishNow, setPublishNow] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setImagePreview(dataUrl);
      set("imageUrl", dataUrl);
    };
    reader.readAsDataURL(file);
  }

  
  if (!isConnected || !isCorrectChain) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 border border-white/10 mx-auto">
            {isConnected ? <AlertTriangle size={24} className="text-amber-400" /> : <Lock size={24} className="text-violet-400" />}
          </div>
          <h2 className="text-lg font-bold text-white">
            {isConnected ? "Wrong network" : "Sign in required"}
          </h2>
          <p className="text-sm text-zinc-400">
            {isConnected
              ? "Switch to Kaolin to create events."
              : "Sign in to create events."}
          </p>
          <div className="flex justify-center"><ConnectButton /></div>
        </div>
      </div>
    );
  }

  if (profileLoading) return <FullSkeleton />;

  if (!isOrganizer) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 border border-white/10 mx-auto">
            <ClipboardList size={24} className="text-violet-400" />
          </div>
          <h2 className="text-lg font-bold text-white">Set up your profile first</h2>
          <p className="text-sm text-zinc-400">
            You need an organizer profile to create events.
          </p>
          <Link
            href="/organizer/onboard"
            className="inline-block rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition-colors"
          >
            Create Profile <ArrowRight size={14} className="inline" />
          </Link>
        </div>
      </div>
    );
  }

  
  async function handleSubmit() {
    if (!walletClient) return;
    setSubmitting(true);
    setError("");

    const eventData: Event = {
      ...form,
      
      virtualLink: form.virtualLink?.trim() || undefined,
      status: publishNow ? "upcoming" : "draft",
    };

    const res = await createEventEntity(
      walletClient,
      eventData,
      organizerKey ?? undefined,
      organizer?.name ?? undefined,
    );
    if (res.success) {
      toast.success(publishNow ? "Event published ✓" : "Event saved as draft ✓");
      router.push(`/organizer/dashboard`);
    } else {
      setError(res.error);
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <OrganizerNav crumb="Create Event" />

      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        {}
        <StepIndicator current={step} />

        {}
        {step === 1 && (
          <Step1
            form={form}
            set={set}
            onNext={() => setStep(2)}
            valid={step1Valid(form)}
            imagePreview={imagePreview}
            onImageUpload={handleImageUpload}
            onImageClear={() => { setImagePreview(null); set("imageUrl", ""); }}
          />
        )}

        {step === 2 && (
          <Step2
            form={form}
            set={set}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
            valid={step2Valid(form)}
          />
        )}

        {step === 3 && (
          <Step3
            form={form}
            onBack={() => setStep(2)}
            onSubmit={handleSubmit}
            submitting={submitting}
            error={error}
            publishNow={publishNow}
            onPublishToggle={() => setPublishNow((v) => !v)}
            imagePreview={imagePreview}
          />
        )}
      </main>
    </div>
  );
}

function StepIndicator({ current }: { current: number }) {
  const steps = ["Basic Info", "When & Where", "Review"];
  return (
    <div className="flex items-center gap-0 mb-10">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <div key={n} className="flex flex-1 items-center">
            <div className="flex items-center gap-2 shrink-0">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  done ? "bg-emerald-600 text-white"
                  : active
                    ? "bg-violet-600 text-white"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                {done ? <Check size={12} /> : n}
              </div>
              <span
                className={`text-xs font-medium hidden sm:block ${
                  active ? "text-white" : done ? "text-zinc-400" : "text-zinc-600"
                }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 mx-3 h-px transition-colors ${
                  done ? "bg-emerald-700" : "bg-zinc-800"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Step1({
  form,
  set,
  onNext,
  valid,
  imagePreview,
  onImageUpload,
  onImageClear,
}: {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  onNext: () => void;
  valid: boolean;
  imagePreview: string | null;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImageClear: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Basic Info</h2>
        <p className="text-sm text-zinc-500 mt-1">Tell people what your event is about.</p>
      </div>

      <div className="rounded-2xl border border-white/5 bg-zinc-900 p-6 space-y-5">
        {/* Cover image */}
        <div>
          <label className={labelCls}>Cover image <span className="text-zinc-600">(optional, max 2 MB)</span></label>
          {imagePreview ? (
            <div className="relative rounded-xl overflow-hidden border border-white/10 h-36">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreview} alt="Cover preview" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={onImageClear}
                className="absolute top-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-zinc-300 hover:text-white"
              >
                Remove
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/10 py-8 text-zinc-500 hover:border-violet-600/50 hover:text-zinc-400 transition-colors"
            >
              <ImageIcon size={24} className="text-zinc-600" />
              <span className="text-sm">Click to upload cover image</span>
              <span className="text-xs">PNG, JPG, WebP — max 2 MB</span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={onImageUpload}
          />
        </div>

        <div>
          <label className={labelCls}>
            Event title <span className="text-rose-400">*</span>
          </label>
          <input
            required
            type="text"
            placeholder="e.g. DeFi Summit 2026"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>
            Description <span className="text-rose-400">*</span>
          </label>
          <textarea
            required
            rows={5}
            placeholder="What will attendees experience? Include agenda, speakers, requirements…"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            className={`${inputCls} resize-none`}
          />
        </div>

        <div>
          <label className={labelCls}>
            Category <span className="text-rose-400">*</span>
          </label>
          <select
            value={form.category}
            onChange={(e) => set("category", e.target.value)}
            className={inputCls}
          >
            <option value="">Select a category…</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* RSVP approval toggle */}
        <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-zinc-800/60 p-4">
          <button
            type="button"
            role="switch"
            aria-checked={form.requiresRsvp}
            onClick={() => set("requiresRsvp", !form.requiresRsvp)}
            className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors ${
              form.requiresRsvp ? "bg-violet-600" : "bg-zinc-700"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                form.requiresRsvp ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
          <div>
            <p className="text-sm font-medium text-white">Require RSVP approval</p>
            <p className="mt-0.5 text-xs text-zinc-500">
              When enabled, attendee requests go into a "pending" queue that only you can approve from your dashboard.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onNext}
          disabled={!valid}
          className="rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next: When &amp; Where <ArrowRight size={14} className="inline" />
        </button>
      </div>
    </div>
  );
}

function Step2({
  form,
  set,
  onBack,
  onNext,
  valid,
}: {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  onBack: () => void;
  onNext: () => void;
  valid: boolean;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">When & Where</h2>
        <p className="text-sm text-zinc-500 mt-1">
          Set the date, location, and capacity.
        </p>
      </div>

      <div className="rounded-2xl border border-white/5 bg-zinc-900 p-6 space-y-5">
        {}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>
              Start date & time <span className="text-rose-400">*</span>
            </label>
            <input
              required
              type="datetime-local"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
              className={`${inputCls} [color-scheme:dark]`}
            />
          </div>
          <div>
            <label className={labelCls}>
              End date & time <span className="text-rose-400">*</span>
            </label>
            <input
              required
              type="datetime-local"
              value={form.endDate}
              min={form.date}
              onChange={(e) => set("endDate", e.target.value)}
              className={`${inputCls} [color-scheme:dark]`}
            />
          </div>
        </div>
        {form.date && form.endDate && form.date >= form.endDate && (
          <p className="text-xs text-rose-400">End time must be after start time.</p>
        )}

        {}
        <div>
          <label className={labelCls}>
            Location{" "}
            <span className="text-zinc-600">(required if no virtual link)</span>
          </label>
          <input
            type="text"
            placeholder="e.g. San Francisco, CA  or  ETH Denver Convention Center"
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
            className={inputCls}
          />
        </div>

        {}
        <div>
          <label className={labelCls}>
            Virtual link{" "}
            <span className="text-zinc-600">(optional – for online or hybrid)</span>
          </label>
          <input
            type="url"
            placeholder="https://meet.example.com/my-event"
            value={form.virtualLink}
            onChange={(e) => set("virtualLink", e.target.value)}
            className={inputCls}
          />
        </div>
        {!form.location.trim() && !form.virtualLink?.trim() && (
          <p className="text-xs text-amber-400">
            Provide a physical location or a virtual link (or both).
          </p>
        )}

        {}
        <div>
          <label className={labelCls}>
            Capacity <span className="text-rose-400">*</span>
          </label>
          <input
            required
            type="number"
            min={1}
            max={100_000}
            value={form.capacity}
            onChange={(e) => set("capacity", Number(e.target.value))}
            className={inputCls}
          />
          <p className="mt-1 text-xs text-zinc-600">
            Max number of confirmed RSVPs (waitlist applies after this).
          </p>
        </div>
      </div>

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="rounded-xl border border-white/10 px-5 py-2.5 text-sm text-zinc-400 hover:text-white transition-colors"
        >
          <span className="flex items-center gap-1.5"><ArrowLeft size={14} /> Back</span>
        </button>
        <button
          onClick={onNext}
          disabled={!valid}
          className="rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <span className="flex items-center gap-1.5">Review <ArrowRight size={14} /></span>
        </button>
      </div>
    </div>
  );
}

function Step3({
  form,
  onBack,
  onSubmit,
  submitting,
  error,
  publishNow,
  onPublishToggle,
  imagePreview,
}: {
  form: FormState;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
  error: string;
  publishNow: boolean;
  onPublishToggle: () => void;
  imagePreview: string | null;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Review & Submit</h2>
        <p className="text-sm text-zinc-500 mt-1">
          Review your event details before creating it.
        </p>
      </div>

      {imagePreview && (
        <div className="rounded-2xl overflow-hidden border border-white/5 h-40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imagePreview} alt="Cover" className="w-full h-full object-cover" />
        </div>
      )}

      <div className="rounded-2xl border border-white/5 bg-zinc-900 divide-y divide-white/5 overflow-hidden">
        <ReviewRow label="Title">{form.title}</ReviewRow>
        <ReviewRow label="Category">{form.category}</ReviewRow>
        <ReviewRow label="Start">{formatReview(form.date)}</ReviewRow>
        <ReviewRow label="End">{formatReview(form.endDate)}</ReviewRow>
        <ReviewRow label="Location">
          {form.location || <span className="text-zinc-600">—</span>}
        </ReviewRow>
        {form.virtualLink && (
          <ReviewRow label="Virtual link">
            <a
              href={form.virtualLink}
              className="text-violet-400 text-xs hover:underline break-all"
              target="_blank"
              rel="noopener noreferrer"
            >
              {form.virtualLink}
            </a>
          </ReviewRow>
        )}
        <ReviewRow label="Capacity">{form.capacity} attendees</ReviewRow>
        <ReviewRow label="RSVP mode">
          <span className={form.requiresRsvp ? "text-violet-300" : "text-zinc-400"}>
            {form.requiresRsvp ? "Approval required" : "Open (auto-confirm)"}
          </span>
        </ReviewRow>
        <ReviewRow label="Status">
          <button
            type="button"
            onClick={onPublishToggle}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
              publishNow
                ? "border-emerald-700/40 bg-emerald-950/30 text-emerald-300"
                : "border-amber-700/40 bg-amber-950/20 text-amber-300"
            }`}
          >
            {publishNow ? <><Check size={12} className="inline" /> Publish immediately (Upcoming)</> : "Save as Draft"}
            <span className="text-zinc-500">(click to toggle)</span>
          </button>
        </ReviewRow>
        <div className="px-5 py-4">
          <p className="text-xs font-medium text-zinc-400 mb-2">Description</p>
          <p className="text-sm text-zinc-300 whitespace-pre-wrap line-clamp-6">
            {form.description}
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-800/40 bg-red-950/20 px-4 py-3">
          <p className="text-xs text-red-400 font-mono">{error}</p>
        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={onBack}
          disabled={submitting}
          className="rounded-xl border border-white/10 px-5 py-2.5 text-sm text-zinc-400 hover:text-white transition-colors disabled:opacity-40"
        >
          <span className="flex items-center gap-1.5"><ArrowLeft size={14} /> Back</span>
        </button>
        <button
          onClick={onSubmit}
          disabled={submitting}
          className="rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-lg shadow-violet-900/30"
        >
          {submitting ? (
            <span className="flex items-center gap-2"><SpinnerIcon />Saving…</span>
          ) : publishNow ? (
            <span className="flex items-center gap-1.5">Publish Event <ArrowRight size={14} /></span>
          ) : (
            <span className="flex items-center gap-1.5">Save as Draft <ArrowRight size={14} /></span>
          )}
        </button>
      </div>
    </div>
  );
}

function ReviewRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-3">
      <span className="text-xs text-zinc-500 shrink-0 w-24">{label}</span>
      <span className="text-sm text-white text-right">{children}</span>
    </div>
  );
}

function FullSkeleton() {
  return (
    <div className="min-h-screen bg-zinc-950 animate-pulse">
      <div className="h-14 bg-zinc-900 border-b border-white/5" />
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 space-y-6">
        <div className="h-6 w-64 rounded bg-zinc-800" />
        <div className="h-80 rounded-2xl bg-zinc-900" />
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
