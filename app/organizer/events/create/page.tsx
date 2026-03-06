"use client";

import { useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Space_Grotesk } from "next/font/google";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  AlignLeft,
  Check,
  ChevronsUpDown,
  ClipboardList,
  Globe,
  Image as ImageIcon,
  Lock,
  MapPin,
  Ticket,
  Users,
  WandSparkles,
  X,
} from "lucide-react";

import dynamic from "next/dynamic";
import { uploadEventImage } from "@/lib/imagedb";

const LocationPicker = dynamic(() => import("@/components/LocationPicker"), { ssr: false });
const AIImageGenerator = dynamic(
  () => import("@/components/AIImageGenerator"),
  { ssr: false },
);

import { DateTimePopover } from "@/components/DateTimePopover";
import { EventAppearancePanel } from "@/components/EventAppearancePanel";
import { TimeZonePopover } from "@/components/TimeZonePopover";
import { ConnectButton } from "@/components/ConnectButton";
import { Navbar } from "@/components/Navbar";
import { useOrganizer } from "@/hooks/useOrganizer";
import { useWallet } from "@/hooks/useWallet";
import { publicClient } from "@/lib/arkiv/client";
import { createHostEventEntity } from "@/lib/arkiv/entities/event";
import { EVENT_CATEGORIES, type Category } from "@/lib/arkiv/categories";
import type { Event } from "@/lib/arkiv/types";
import {
  DEFAULT_EMOJI_SYMBOL,
  DEFAULT_MINIMAL_THEME_COLOR,
  getEventFontFamily,
  resolveEventAppearance,
  type EventFontPreset,
  type EventThemeId,
} from "@/lib/eventAppearance";
import {
  browserTimeZone,
  getTimeZoneOffsetLabel,
  toCityName,
  toUtcMsFromZonedLocal,
  zonedLocalToUtcIso,
} from "@/lib/timezone";

const displayFont = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

type FormState = Omit<Event, "status" | "category"> & {
  category: Category | "";
  lat?: number;
  lng?: number;
};

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  category: "",
  date: "",
  endDate: "",
  location: "",
  virtualLink: "",
  capacity: 100,
  lat: undefined,
  lng: undefined,
  requiresRsvp: false,
  imageUrl: "",
};

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

export default function CreateEventPage() {
  const router = useRouter();
  const { isConnected, isCorrectChain, walletClient } = useWallet();
  const { isOrganizer, isLoading: profileLoading, entityKey: organizerKey, organizer } = useOrganizer();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [visibility, setVisibility] = useState<"public" | "draft">("public");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<EventThemeId>("minimal");
  const [selectedFont, setSelectedFont] = useState<EventFontPreset>("Default");
  const [selectedThemeColor, setSelectedThemeColor] = useState(DEFAULT_MINIMAL_THEME_COLOR);
  const [selectedEmojiSymbol, setSelectedEmojiSymbol] = useState(DEFAULT_EMOJI_SYMBOL);
  const [selectedTimeZone, setSelectedTimeZone] = useState<string>(() => browserTimeZone());
  const [appearancePanelOpen, setAppearancePanelOpen] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const validationError = useMemo(
    () => getValidationError(form, selectedTimeZone),
    [form, selectedTimeZone],
  );
  const valid = validationError === null;
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

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Image must be under 25 MB");
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setImagePreview(localPreview);
    const uploadToast = toast.loading("Uploading image...");

    try {
      const mediaId = await uploadEventImage(file);
      setField("imageUrl", mediaId);
      toast.success("Image uploaded ✓", { id: uploadToast });
    } catch (err) {
      toast.error(`Image upload failed: ${err instanceof Error ? err.message : String(err)}`, { id: uploadToast });
      setImagePreview(null);
      setField("imageUrl", "");
    }
  }

  async function handleSubmit() {
    if (!walletClient || submitting) return;
    if (!valid) {
      toast.error("Complete all required fields before creating the event.");
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

    const eventData: Event = {
      ...form,
      lat: form.lat,
      lng: form.lng,
      date: startIso,
      endDate: endIso,
      category: form.category as Category,
      virtualLink: form.virtualLink?.trim() || undefined,
      status: visibility === "public" ? "upcoming" : "draft",
      themeId: selectedTheme,
      fontPreset: selectedFont,
      themeColor: selectedThemeColor,
      emojiSymbol: selectedEmojiSymbol,
      timezone: selectedTimeZone,
    };

    const res = await createHostEventEntity(
      walletClient,
      publicClient,
      eventData,
      organizerKey ?? undefined,
      organizer?.name ?? undefined,
    );

    if (res.success) {
      toast.success(visibility === "public" ? "Event published ✓" : "Draft saved ✓");
      router.push("/organizer/dashboard");
      return;
    }

    setError(res.error);
    setSubmitting(false);
  }

  if (!isConnected || !isCorrectChain) {
    return (
      <div className={`flex min-h-screen items-center justify-center bg-[#2f0e34] p-6 ${displayFont.className}`}>
        <div className="max-w-sm space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-[#4a2850]">
            {isConnected ? <AlertTriangle size={24} className="text-amber-300" /> : <Lock size={24} className="text-fuchsia-200" />}
          </div>
          <h2 className="text-lg font-bold text-white">
            {isConnected ? "Wrong network" : "Sign in required"}
          </h2>
          <p className="text-sm text-[#ccb8cf]">
            {isConnected ? "Switch to Kaolin to create events." : "Sign in to create events."}
          </p>
          <div className="flex justify-center"><ConnectButton /></div>
        </div>
      </div>
    );
  }

  if (profileLoading) return <FullSkeleton />;

  if (!isOrganizer) {
    return (
      <div className={`flex min-h-screen items-center justify-center bg-[#2f0e34] p-6 ${displayFont.className}`}>
        <div className="max-w-sm space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-[#4a2850]">
            <ClipboardList size={24} className="text-fuchsia-200" />
          </div>
          <h2 className="text-lg font-bold text-white">Set up your profile first</h2>
          <p className="text-sm text-[#ccb8cf]">
            You need an organizer profile to create events.
          </p>
          <Link
            href="/organizer/onboard"
            className="inline-block rounded-lg bg-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-fuchsia-400"
          >
            Create Profile
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative min-h-screen overflow-hidden text-[#f3e8f4] ${displayFont.className}`}
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

        <main className="mx-auto max-w-[1040px] px-4 pb-10 pt-2 sm:px-6 lg:px-8">
          <div className="grid gap-4 xl:grid-cols-[270px_minmax(0,1fr)]">
          <aside className="space-y-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative block aspect-square w-full overflow-hidden rounded-2xl border border-white/15 bg-[#633566] shadow-[0_14px_44px_-28px_rgba(0,0,0,0.75)]"
            >
              {imagePreview ? (
                <img src={imagePreview} alt="Cover preview" className="h-full w-full aspect-square object-cover" />
              ) : (
                <div className="relative flex h-full w-full items-center justify-center p-5">
                  <div
                    className="absolute inset-0 opacity-95"
                    style={{ background: liveAppearance.theme.heroGradient }}
                  />
                  <p className="relative max-w-[200px] text-center text-[2rem] font-black uppercase leading-[0.9] text-black/85">
                    Party like it&apos;s the last one
                  </p>
                </div>
              )}
              <span className="absolute bottom-2.5 right-2.5 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/35 bg-black/55 text-white">
                <ImageIcon size={15} />
              </span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={handleImageUpload}
            />

            <div className="grid grid-cols-[1fr_46px] gap-1.5">
              <button
                type="button"
                onClick={() => setAppearancePanelOpen(true)}
                className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-[#69406d]/70 px-2.5 py-1 text-left"
              >
                <div
                  className="h-9 w-9 rounded-lg border border-white/25"
                  style={{ background: liveAppearance.theme.preview }}
                />
                <div className="min-w-0">
                  <p className="text-xs text-[#ceb8d0]">Theme</p>
                  <p className="truncate text-sm font-semibold leading-none text-white">
                    {liveAppearance.theme.label}
                  </p>
                </div>
                <ChevronsUpDown size={16} className="ml-auto text-[#cfb5d1]" />
              </button>

              <button
                type="button"
                onClick={() => setAiModalOpen(true)}
                title="Generate with AI"
                className="inline-flex h-full items-center justify-center rounded-xl border border-white/10 bg-[#69406d]/70 text-[#e3cae5] transition-colors hover:border-fuchsia-400/50 hover:bg-fuchsia-500/40 hover:text-white"
              >
                <WandSparkles size={14} />
              </button>
            </div>

            {imagePreview && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setImagePreview(null);
                    setField("imageUrl", "");
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-[#d8bedb] hover:text-white"
                >
                  <X size={12} /> Remove cover image
                </button>
                {form.imageUrl && (
                  <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[#b898bd]">Media ID</p>
                    <p className="break-all font-mono text-[11px] text-[#e2d0e4] select-all">{form.imageUrl}</p>
                  </div>
                )}
              </div>
            )}
          </aside>

          <section>
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <div className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#69406d]/65 px-2.5 py-1">
                <Globe size={14} className="text-[#dbc3dd]" />
                <select
                  value={form.category}
                  onChange={(event) => setField("category", event.target.value as Category | "")}
                  className="min-w-[170px] appearance-none bg-transparent text-xs font-semibold text-white outline-none"
                >
                  <option value="" className="bg-[#4f2953] text-white">Select category</option>
                  {EVENT_CATEGORIES.map((category) => (
                    <option key={category} value={category} className="bg-[#4f2953] text-white">
                      {category}
                    </option>
                  ))}
                </select>
                <ChevronsUpDown size={14} className="text-[#dbc3dd]" />
              </div>

              <div className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#69406d]/65 px-2.5 py-1">
                <Globe size={14} className="text-[#dbc3dd]" />
                <select
                  value={visibility}
                  onChange={(event) => setVisibility(event.target.value as "public" | "draft")}
                  className="appearance-none bg-transparent text-xs font-semibold text-white outline-none"
                >
                  <option value="public" className="bg-[#4f2953] text-white">Public</option>
                  <option value="draft" className="bg-[#4f2953] text-white">Draft</option>
                </select>
                <ChevronsUpDown size={14} className="text-[#dbc3dd]" />
              </div>
            </div>

            <input
              type="text"
              value={form.title}
              onChange={(event) => setField("title", event.target.value)}
              placeholder="Event Name"
              className="mt-1.5 w-full border-none bg-transparent text-2xl font-semibold tracking-tight text-[#dfcbe1] placeholder:text-[#b596b8] outline-none sm:text-[2.5rem]"
            />

            <div className="mt-1.5 grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="space-y-1 rounded-2xl border border-white/10 bg-[#6a406f]/70 p-2">
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

              <div className="rounded-2xl border border-white/10 bg-[#6a406f]/70 p-2">
                <TimeZonePopover value={selectedTimeZone} onChange={setSelectedTimeZone} />
                <p className="mt-2 text-xs text-[#dec9df]">
                  Event schedule timezone: {toCityName(selectedTimeZone)} ({getTimeZoneOffsetLabel(selectedTimeZone)})
                </p>
              </div>
            </div>

            {form.date && form.endDate && toUtcMsFromZonedLocal(form.date, selectedTimeZone) >= toUtcMsFromZonedLocal(form.endDate, selectedTimeZone) && (
              <p className="mt-2 text-xs text-rose-300">End time must be after start time.</p>
            )}

            <FieldBlock
              icon={<MapPin size={16} />}
              title="Add Event Location"
              subtitle="Offline location or virtual link"
              className="mt-1.5"
            >
              <LocationPicker
                value={form.location}
                onChange={(address) => setField("location", address)}
                onLocationChange={({ address, lat, lng }) => {
                  setField("location", address);
                  setField("lat", lat);
                  setField("lng", lng);
                }}
              />
              <input
                type="url"
                value={form.virtualLink}
                onChange={(event) => setField("virtualLink", event.target.value)}
                placeholder="https://meet.example.com/room (optional)"
                className={fieldInputCls}
              />
            </FieldBlock>

            <FieldBlock icon={<AlignLeft size={16} />} title="Add Description" className="mt-1.5">
              <textarea
                rows={3}
                value={form.description}
                onChange={(event) => setField("description", event.target.value)}
                placeholder="Tell attendees what they can expect."
                className={`${fieldInputCls} resize-none`}
              />
            </FieldBlock>

            {!form.location.trim() && !form.virtualLink?.trim() && (
              <p className="mt-2 text-xs text-amber-300">
                Add either a physical location or a virtual link.
              </p>
            )}

            <p className="mt-2 text-sm font-semibold text-[#dfcade]">Event Options</p>
            <div className="mt-1 overflow-hidden rounded-2xl border border-white/10 bg-[#6a406f]/70">
              <OptionRow icon={<Ticket size={15} />} label="Ticket Price">
                <span className="font-semibold text-[#dfc7e0]">Free</span>
              </OptionRow>

              <OptionRow icon={<Check size={15} />} label="Require Approval">
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.requiresRsvp}
                  onClick={() => setField("requiresRsvp", !form.requiresRsvp)}
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors ${
                    form.requiresRsvp ? "bg-fuchsia-400/80" : "bg-white/30"
                  }`}
                >
                  <span
                    className={`block h-6 w-6 rounded-full bg-white shadow transition-transform ${
                      form.requiresRsvp ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </OptionRow>

              <OptionRow icon={<Users size={15} />} label="Capacity" last>
                <input
                  type="number"
                  min={1}
                  max={100_000}
                  value={form.capacity}
                  onChange={(event) => setField("capacity", Number(event.target.value))}
                  className="w-24 rounded-lg border border-white/20 bg-black/20 px-3 py-1.5 text-right text-sm font-semibold text-white outline-none focus:border-fuchsia-300"
                />
              </OptionRow>
            </div>

            {error && (
              <div className="mt-2 rounded-lg border border-rose-200/25 bg-rose-900/30 px-3 py-2 text-xs text-rose-100">
                {error}
              </div>
            )}

            {!valid && validationError && (
              <p className="mt-2 rounded-lg border border-amber-300/20 bg-amber-900/25 px-3 py-2 text-xs text-amber-200">
                {validationError}
              </p>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!valid || submitting}
              className="mt-2 w-full rounded-xl bg-[#f4f2f6] py-2 text-xl font-semibold text-[#2f1733] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 sm:text-2xl"
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2 text-lg sm:text-xl">
                  <SpinnerIcon />
                  Creating Event...
                </span>
              ) : (
                "Create Event"
              )}
            </button>
          </section>
          </div>
        </main>
      </div>

      <EventAppearancePanel
        open={appearancePanelOpen}
        onClose={() => setAppearancePanelOpen(false)}
        selectedTheme={selectedTheme}
        selectedFont={selectedFont}
        selectedThemeColor={selectedThemeColor}
        selectedEmojiSymbol={selectedEmojiSymbol}
        onThemeChange={(theme) => setSelectedTheme(theme)}
        onFontChange={(font) => setSelectedFont(font)}
        onThemeColorChange={setSelectedThemeColor}
        onEmojiSymbolChange={setSelectedEmojiSymbol}
      />

      <AIImageGenerator
        eventTitle={form.title}
        eventCategory={form.category}
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        onSelectImage={async (dataUrl) => {
          setImagePreview(dataUrl);

          const uploadToast = toast.loading("Uploading AI image...");
          try {
            const blob = await fetch(dataUrl).then((response) => response.blob());
            const file = new File([blob], "ai-generated.png", { type: "image/png" });
            const mediaId = await uploadEventImage(file);
            setField("imageUrl", mediaId);
            toast.success("AI image uploaded ✓", { id: uploadToast });
          } catch {
            toast.error("Upload failed", { id: uploadToast });
            setImagePreview(null);
            setField("imageUrl", "");
          }
          setAiModalOpen(false);
        }}
      />
    </div>
  );
}

const fieldInputCls =
  "w-full rounded-lg border border-white/15 bg-[#7a527d]/45 px-2.5 py-1 text-sm text-[#f6ecf7] placeholder:text-[#ceb2d1] outline-none focus:border-fuchsia-200";

function FieldBlock({
  icon,
  title,
  subtitle,
  className,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`rounded-xl border border-white/10 bg-[#6a406f]/70 px-3 py-2 ${className ?? ""}`}>
      <div className="mb-1 flex items-center gap-1.5 text-[#e7d3e9]">
        <span className="text-[#d5bad8]">{icon}</span>
        <div>
          <p className="text-sm font-semibold leading-none">{title}</p>
          {subtitle && <p className="mt-0.5 text-xs text-[#cfb4d2]">{subtitle}</p>}
        </div>
      </div>
      <div className="space-y-1">{children}</div>
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
      <div className="flex items-center gap-1.5 text-base font-semibold text-[#e6d2e8]">
        <span className="text-[#d5bad8]">{icon}</span>
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}

function FullSkeleton() {
  return (
    <div className="min-h-screen animate-pulse bg-[#2f0e34]">
      <div className="h-14 border-b border-white/5 bg-[#3f2246]" />
      <div className="mx-auto max-w-[1120px] space-y-6 px-4 py-10 sm:px-6">
        <div className="h-8 w-56 rounded-lg bg-[#59335f]" />
        <div className="h-[460px] rounded-3xl bg-[#59335f]" />
      </div>
    </div>
  );
}

function SpinnerIcon() {
  return (
    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}
