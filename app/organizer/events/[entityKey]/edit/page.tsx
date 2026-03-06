"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import type { Hex } from "viem";
import {
  AlertTriangle,
  AlignLeft,
  ArrowLeft,
  Check,
  ChevronsUpDown,
  Lock,
  MapPin,
  ShieldOff,
  Ticket,
  Users,
} from "lucide-react";
import { useEvent } from "@/hooks/useEvent";
import { useWallet } from "@/hooks/useWallet";
import { DateTimePopover } from "@/components/DateTimePopover";
import { EventAppearancePanel } from "@/components/EventAppearancePanel";
import { TimeZonePopover } from "@/components/TimeZonePopover";
import { publicClient } from "@/lib/arkiv/client";
import { updateHostEventDetails } from "@/lib/arkiv/entities/event";
import { EVENT_CATEGORIES, type Category } from "@/lib/arkiv/categories";
import { Navbar } from "@/components/Navbar";
import { ConnectButton } from "@/components/ConnectButton";
import type { Event } from "@/lib/arkiv/types";
import {
  DEFAULT_EMOJI_SYMBOL,
  DEFAULT_MINIMAL_THEME_COLOR,
  getEventFontFamily,
  normalizeEventEmojiSymbol,
  normalizeEventFontPreset,
  normalizeEventThemeColor,
  normalizeEventThemeId,
  resolveEventAppearance,
  type EventFontPreset,
  type EventThemeId,
} from "@/lib/eventAppearance";
import {
  browserTimeZone,
  formatLocalDateTimeFromUtc,
  normalizeEventTimeZone,
  toUtcMsFromZonedLocal,
  zonedLocalToUtcIso,
} from "@/lib/timezone";

type FormState = Event;

const inputCls =
  "w-full rounded-lg border border-white/10 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition-colors";

function getValidationError(form: FormState, timeZone: string): string | null {
  if (!form.title.trim()) return "Event name is required.";
  if (!form.description.trim()) return "Description is required.";
  if (!form.category) return "Category is required.";
  if (!form.date) return "Start date is required.";
  if (!form.endDate) return "End date is required.";

  const startMs = toUtcMsFromZonedLocal(form.date, timeZone);
  const endMs = toUtcMsFromZonedLocal(form.endDate, timeZone);
  if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && startMs >= endMs) {
    return "End time must be after start time.";
  }

  if (!form.location.trim() && !form.virtualLink?.trim()) {
    return "Add a location or virtual link.";
  }
  if (!form.capacity || form.capacity < 1) return "Capacity must be at least 1.";
  return null;
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
  const [appearancePanelOpen, setAppearancePanelOpen] = useState(false);

  useEffect(() => {
    if (!event) return;

    const tz = normalizeEventTimeZone(event.timezone);
    const normalizedTheme = normalizeEventThemeId(event.themeId);
    const normalizedFont = normalizeEventFontPreset(event.fontPreset);
    const normalizedThemeColor = normalizeEventThemeColor(normalizedTheme, event.themeColor);

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      ...event,
      date: formatLocalDateTimeFromUtc(event.date, tz),
      endDate: formatLocalDateTimeFromUtc(event.endDate, tz),
      virtualLink: event.virtualLink ?? "",
      timezone: tz,
      themeId: normalizedTheme,
      fontPreset: normalizedFont,
      themeColor: normalizedThemeColor || DEFAULT_MINIMAL_THEME_COLOR,
      emojiSymbol: normalizeEventEmojiSymbol(normalizedTheme, event.emojiSymbol) || DEFAULT_EMOJI_SYMBOL,
    });
  }, [event]);

  const selectedTimeZone = useMemo(
    () => normalizeEventTimeZone(form?.timezone ?? browserTimeZone()),
    [form?.timezone],
  );
  const selectedTheme = useMemo<EventThemeId>(
    () => normalizeEventThemeId(form?.themeId),
    [form?.themeId],
  );
  const selectedFont = useMemo<EventFontPreset>(
    () => normalizeEventFontPreset(form?.fontPreset),
    [form?.fontPreset],
  );
  const selectedThemeColor = useMemo(
    () => normalizeEventThemeColor(selectedTheme, form?.themeColor) || DEFAULT_MINIMAL_THEME_COLOR,
    [selectedTheme, form?.themeColor],
  );
  const selectedEmojiSymbol = useMemo(
    () => normalizeEventEmojiSymbol(selectedTheme, form?.emojiSymbol) || DEFAULT_EMOJI_SYMBOL,
    [selectedTheme, form?.emojiSymbol],
  );

  const selectedFontFamily = useMemo(
    () => getEventFontFamily(selectedFont),
    [selectedFont],
  );
  const liveAppearance = useMemo(
    () =>
      resolveEventAppearance({
        themeId: selectedTheme,
        fontPreset: selectedFont,
        themeColor: selectedThemeColor,
        emojiSymbol: selectedEmojiSymbol,
      }),
    [selectedTheme, selectedFont, selectedThemeColor, selectedEmojiSymbol],
  );
  const validationError = useMemo(
    () => (form ? getValidationError(form, selectedTimeZone) : "Loading event..."),
    [form, selectedTimeZone],
  );

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
          <Link href="/organizer/dashboard" className="flex items-center justify-center gap-1.5 text-sm text-violet-400 hover:underline">
            <ArrowLeft size={14} /> Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (address && entity.owner && entity.owner.toLowerCase() !== address.toLowerCase()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6">
        <div className="text-center space-y-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 border border-white/10 mx-auto">
            <ShieldOff size={22} className="text-rose-400" />
          </div>
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
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleSubmit(eventSubmit: FormEvent) {
    eventSubmit.preventDefault();
    if (!walletClient || !form) return;
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const startIso = zonedLocalToUtcIso(form.date, selectedTimeZone);
    const endIso = zonedLocalToUtcIso(form.endDate, selectedTimeZone);
    if (!startIso || !endIso) {
      toast.error("Invalid date/time selected.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSaved(false);

    const updated: Event = {
      ...form,
      date: startIso,
      endDate: endIso,
      virtualLink: form.virtualLink?.trim() || undefined,
      timezone: selectedTimeZone,
      themeId: selectedTheme,
      fontPreset: selectedFont,
      themeColor: selectedThemeColor,
      emojiSymbol: selectedEmojiSymbol,
    };

    const res = await updateHostEventDetails(walletClient, publicClient, entityKey, updated);
    if (res.success) {
      toast.success("Event saved ✓");
      setSaved(true);
      setTimeout(() => router.push("/organizer/dashboard"), 1_000);
    } else {
      setError(res.error);
      setSubmitting(false);
    }
  }

  return (
    <div
      className="relative min-h-screen overflow-hidden text-white"
      style={{ fontFamily: selectedFontFamily, background: liveAppearance.theme.detailBackground }}
    >
      {liveAppearance.theme.detailOverlay && (
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            backgroundImage: liveAppearance.theme.detailOverlay,
            backgroundSize: liveAppearance.theme.detailOverlaySize ?? "280px 280px",
          }}
        />
      )}
      <div className="pointer-events-none absolute inset-0 opacity-15 [background-image:radial-gradient(rgba(255,255,255,0.18)_0.55px,transparent_0.55px)] [background-size:3px_3px]" />

      <div className="relative z-10">
        <Navbar active="dashboard" />

        <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="mb-8">
          <Link
            href="/organizer/dashboard"
            className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-white transition-colors"
          >
            <ArrowLeft size={14} /> Dashboard
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-white truncate">
            Edit: {event?.title}
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            Changes are saved on-chain and cannot be undone.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-2xl border border-white/5 bg-zinc-900 p-6 space-y-5">
            <button
              type="button"
              onClick={() => setAppearancePanelOpen(true)}
              className="flex w-full items-center gap-2.5 rounded-xl border border-white/10 bg-zinc-800/70 px-3 py-2 text-left"
            >
              <div className="h-10 w-10 rounded-lg border border-white/20" style={{ background: liveAppearance.theme.preview }} />
              <div className="min-w-0">
                <p className="text-xs text-zinc-400">Theme</p>
                <p className="truncate text-sm font-semibold text-white">{liveAppearance.theme.label}</p>
              </div>
              <ChevronsUpDown size={15} className="ml-auto text-zinc-400" />
            </button>

            <div>
              <label className={labelCls}>
                Title <span className="text-rose-400">*</span>
              </label>
              <input
                required
                type="text"
                value={form.title}
                onChange={(eventInput) => setField("title", eventInput.target.value)}
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
                value={form.description}
                onChange={(eventInput) => setField("description", eventInput.target.value)}
                className={`${inputCls} resize-none`}
              />
            </div>

            <div>
              <label className={labelCls}>Category</label>
              <div className="relative">
                <select
                  value={form.category}
                  onChange={(eventInput) => setField("category", eventInput.target.value as Category)}
                  className={`${inputCls} appearance-none pr-9`}
                >
                  {EVENT_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <ChevronsUpDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-zinc-800/55 p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <DateTimePopover
                  label="Start"
                  value={form.date}
                  onChange={(value) => setField("date", value)}
                  timeZone={selectedTimeZone}
                />
                <DateTimePopover
                  label="End"
                  value={form.endDate}
                  min={form.date}
                  onChange={(value) => setField("endDate", value)}
                  timeZone={selectedTimeZone}
                />
              </div>
              <div className="mt-2">
                <TimeZonePopover
                  value={selectedTimeZone}
                  onChange={(timeZone) => setField("timezone", timeZone)}
                  buttonClassName="w-full rounded-xl border border-white/10 bg-zinc-800 px-3 py-2 text-left"
                />
              </div>
            </div>

            <FieldBlock icon={<MapPin size={16} />} title="Add Event Location" className="mt-1.5">
              <input
                type="text"
                value={form.location}
                onChange={(eventInput) => setField("location", eventInput.target.value)}
                className={fieldInputCls}
              />
              <input
                type="url"
                placeholder="https://..."
                value={form.virtualLink ?? ""}
                onChange={(eventInput) => setField("virtualLink", eventInput.target.value)}
                className={fieldInputCls}
              />
            </FieldBlock>

            <FieldBlock icon={<AlignLeft size={16} />} title="Notes" className="mt-1.5">
              <p className="text-xs text-zinc-400">Appearance and text style will apply on the event page only.</p>
            </FieldBlock>

            <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-800/70">
              <OptionRow icon={<Ticket size={15} />} label="Ticket Price">
                <span className="font-semibold text-zinc-200">Free</span>
              </OptionRow>
              <OptionRow icon={<Check size={15} />} label="Require Approval">
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(form.requiresRsvp)}
                  onClick={() => setField("requiresRsvp", !form.requiresRsvp)}
                  className={`relative h-7 w-12 rounded-full transition-colors ${
                    form.requiresRsvp ? "bg-violet-500" : "bg-zinc-700"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                      form.requiresRsvp ? "translate-x-[23px]" : "translate-x-[2px]"
                    }`}
                  />
                </button>
              </OptionRow>
              <OptionRow icon={<Users size={15} />} label="Capacity" last>
                <input
                  required
                  type="number"
                  min={1}
                  value={form.capacity}
                  onChange={(eventInput) => setField("capacity", Number(eventInput.target.value))}
                  className="w-24 rounded-lg border border-white/20 bg-black/20 px-3 py-1.5 text-right text-sm font-semibold text-white outline-none focus:border-violet-400"
                />
              </OptionRow>
            </div>
          </div>

          <div className="rounded-lg border border-amber-700/20 bg-amber-950/10 px-4 py-3 text-xs text-amber-400">
            Current status: <strong className="text-white">{form.status}</strong>.
            {" "}To change status, use the dashboard controls.
          </div>

          {validationError && (
            <div className="rounded-lg border border-amber-700/20 bg-amber-950/10 px-4 py-3 text-xs text-amber-300">
              {validationError}
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-800/40 bg-red-950/20 px-4 py-3">
              <p className="text-xs text-red-400 font-mono">{error}</p>
            </div>
          )}

          {saved && (
            <div className="rounded-lg border border-emerald-700/30 bg-emerald-950/20 px-4 py-3">
              <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                <Check size={12} /> Saved. Redirecting to dashboard...
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
              disabled={submitting || saved || Boolean(validationError)}
              className="flex-1 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <SpinnerIcon />
                  Saving...
                </span>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>
        </main>
      </div>

      <EventAppearancePanel
        open={appearancePanelOpen}
        onClose={() => setAppearancePanelOpen(false)}
        selectedTheme={selectedTheme}
        selectedFont={selectedFont}
        selectedThemeColor={selectedThemeColor}
        selectedEmojiSymbol={selectedEmojiSymbol}
        onThemeChange={(themeId) => setField("themeId", themeId)}
        onFontChange={(fontPreset) => setField("fontPreset", fontPreset)}
        onThemeColorChange={(themeColor) => setField("themeColor", themeColor)}
        onEmojiSymbolChange={(emojiSymbol) => setField("emojiSymbol", emojiSymbol)}
      />
    </div>
  );
}

function FieldBlock({
  icon,
  title,
  className,
  children,
}: {
  icon: ReactNode;
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`rounded-xl border border-white/10 bg-zinc-800/70 px-3 py-2 ${className ?? ""}`}>
      <div className="mb-1 flex items-center gap-1.5 text-zinc-100">
        <span className="text-zinc-300">{icon}</span>
        <p className="text-sm font-semibold leading-none">{title}</p>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function OptionRow({
  icon,
  label,
  children,
  last = false,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-2.5 px-3 py-2 ${last ? "" : "border-b border-white/10"}`}>
      <div className="flex items-center gap-1.5 text-base font-semibold text-zinc-200">
        <span className="text-zinc-300">{icon}</span>
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}

const fieldInputCls =
  "w-full rounded-lg border border-white/10 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition-colors";
const labelCls = "mb-1.5 block text-xs font-medium text-zinc-400";

function FullSkeleton() {
  return (
    <div className="min-h-screen animate-pulse bg-zinc-950">
      <div className="h-14 border-b border-white/5 bg-zinc-900" />
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-10 sm:px-6">
        <div className="h-8 w-56 rounded-lg bg-zinc-800" />
        <div className="h-[520px] rounded-3xl bg-zinc-800" />
      </div>
    </div>
  );
}

function SpinnerIcon() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}
