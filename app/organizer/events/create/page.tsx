"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
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
  Palette,
  Sparkles,
  Ticket,
  Type,
  Users,
  WandSparkles,
  X,
} from "lucide-react";

import dynamic from "next/dynamic";
import { uploadEventImage } from "@/lib/imagedb";

const LocationPicker = dynamic(() => import("@/components/LocationPicker"), { ssr: false });

import { ConnectButton } from "@/components/ConnectButton";
import { OrganizerNav } from "@/components/OrganizerNav";
import { useOrganizer } from "@/hooks/useOrganizer";
import { useWallet } from "@/hooks/useWallet";
import { publicClient } from "@/lib/arkiv/client";
import { createHostEventEntity } from "@/lib/arkiv/entities/event";
import { EVENT_CATEGORIES, type Category } from "@/lib/arkiv/categories";
import type { Event } from "@/lib/arkiv/types";
import {
  EVENT_FONT_PRESETS,
  EVENT_THEME_OPTIONS,
  getEventFontFamily,
  type EventFontPreset,
  type EventThemeId,
} from "@/lib/eventAppearance";

const displayFont = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const THEME_OPTIONS = [
  { id: "minimal", label: "Minimal", preview: "linear-gradient(145deg, #ece6f2 0%, #b7b1c5 100%)" },
  { id: "quantum", label: "Quantum", preview: "linear-gradient(145deg, #7cdbff 0%, #d078ff 50%, #6f83ff 100%)" },
  { id: "warp", label: "Warp", preview: "radial-gradient(circle at 50% 50%, #320337 0%, #0f0a1a 42%, #6de2ff 100%)" },
  { id: "emoji", label: "Emoji", preview: "linear-gradient(145deg, #ffd4f6 0%, #c8a1ff 100%)" },
  { id: "confetti", label: "Confetti", preview: "linear-gradient(145deg, #7f17f0 0%, #c64ffd 45%, #ff79d7 100%)" },
  { id: "pattern", label: "Pattern", preview: "linear-gradient(145deg, #6f54ff 0%, #5f8fff 50%, #95a1ff 100%)" },
  { id: "seasonal", label: "Seasonal", preview: "linear-gradient(145deg, #63c2ff 0%, #4d8fff 50%, #0f4f86 100%)" },
] as const;

const FONT_PRESETS = [
  "Default",
  "Museo",
  "Factoria",
  "Ivy Presto",
  "Ivy Mode",
  "Google",
  "Roc",
  "Nunito",
  "Degular",
  "Pearl",
  "Geist Mono",
  "New Spirit",
  "Departure",
  "Garamond",
  "Futura",
  "Alternate",
] as const;

type FormState = Omit<Event, "status" | "category"> & {
  category: Category | ""
  lat?: number
  lng?: number
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

function isFormValid(form: FormState): boolean {
  if (!form.title.trim() || !form.description.trim() || !form.category) return false;
  if (!form.date || !form.endDate || form.date >= form.endDate) return false;
  if (!form.location.trim() && !form.virtualLink?.trim()) return false;
  if (form.capacity < 1) return false;
  return true;
}

function getUtcOffsetLabel(date = new Date()): string {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetMinutes);
  const hh = String(Math.floor(absolute / 60)).padStart(2, "0");
  const mm = String(absolute % 60).padStart(2, "0");
  return `GMT${sign}${hh}:${mm}`;
}

function toCityName(timeZone: string): string {
  const city = timeZone.split("/").at(-1) ?? timeZone;
  return city.replaceAll("_", " ");
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
  const [fontMenuOpen, setFontMenuOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fontMenuRef = useRef<HTMLDivElement>(null);

  const timeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
    [],
  );
  const utcOffset = useMemo(() => getUtcOffsetLabel(), []);
  const valid = useMemo(() => isFormValid(form), [form]);
  const selectedThemeMeta = useMemo(
    () => EVENT_THEME_OPTIONS.find((theme) => theme.id === selectedTheme) ?? EVENT_THEME_OPTIONS[0],
    [selectedTheme],
  );
  const selectedFontFamily = useMemo(
    () => getEventFontFamily(selectedFont),
    [selectedFont],
  );

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      if (!fontMenuRef.current?.contains(event.target as Node)) {
        setFontMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, []);

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
    console.log("[imageUpload] starting upload", { name: file.name, size: file.size, type: file.type });
    const uploadToast = toast.loading("Uploading image...");
    try {
      const mediaId = await uploadEventImage(file);
      console.log("[imageUpload] success, media_id:", mediaId);
      setField("imageUrl", mediaId);
      toast.success("Image uploaded ✓", { id: uploadToast });
    } catch (err) {
      console.error("[imageUpload] failed:", err);
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

    setSubmitting(true);
    setError("");

    const eventData: Event = {
      ...form,
      lat: form.lat,
      lng: form.lng,
      category: form.category as Category,
      virtualLink: form.virtualLink?.trim() || undefined,
      status: visibility === "public" ? "upcoming" : "draft",
      themeId: selectedTheme,
      fontPreset: selectedFont,
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
      className={`min-h-screen bg-[#47174d] text-[#f3e8f4] ${displayFont.className}`}
      style={{ fontFamily: selectedFontFamily }}
    >
      <OrganizerNav crumb="Create Event" />

      <main className="mx-auto max-w-[1120px] px-4 pb-52 pt-8 sm:px-6 lg:px-8">
        <div className="grid gap-7 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative block aspect-square w-full overflow-hidden rounded-2xl border border-white/15 bg-[#633566] shadow-[0_18px_60px_-30px_rgba(0,0,0,0.75)]"
            >
              {imagePreview ? (

                <img src={imagePreview} alt="Cover preview" className="h-full w-full object-cover" />
              ) : (
                <div className="relative flex h-full w-full items-center justify-center p-6">
                  <div
                    className="absolute inset-0 opacity-95"
                    style={{ background: selectedThemeMeta.preview }}
                  />
                  <p className="relative max-w-[220px] text-center text-[2.3rem] font-black uppercase leading-[0.9] text-black/85">
                    Party like it&apos;s the last one
                  </p>
                </div>
              )}
              <span className="absolute bottom-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/35 bg-black/55 text-white">
                <ImageIcon size={16} />
              </span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={handleImageUpload}
            />

            <div className="grid grid-cols-[1fr_54px] gap-2">
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#69406d]/70 px-3 py-2">
                <div
                  className="h-10 w-10 rounded-lg border border-white/25"
                  style={{ background: selectedThemeMeta.preview }}
                />
                <div className="min-w-0">
                  <p className="text-xs text-[#ceb8d0]">Theme</p>
                  <p className="truncate text-lg font-semibold leading-none text-white">{selectedThemeMeta.label}</p>
                </div>
                <ChevronsUpDown size={16} className="ml-auto text-[#cfb5d1]" />
              </div>

              <button
                type="button"
                className="inline-flex h-full items-center justify-center rounded-xl border border-white/10 bg-[#69406d]/70 text-[#e3cae5] transition-colors hover:bg-[#7a4a7f]"
              >
                <WandSparkles size={18} />
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#69406d]/65 px-3 py-2">
                <Globe size={14} className="text-[#dbc3dd]" />
                <select
                  value={form.category}
                  onChange={(event) => setField("category", event.target.value as Category | "")}
                  className="min-w-[180px] appearance-none bg-transparent text-sm font-semibold text-white outline-none"
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

              <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#69406d]/65 px-3 py-2">
                <Globe size={14} className="text-[#dbc3dd]" />
                <select
                  value={visibility}
                  onChange={(event) => setVisibility(event.target.value as "public" | "draft")}
                  className="appearance-none bg-transparent text-sm font-semibold text-white outline-none"
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
              className="mt-4 w-full border-none bg-transparent text-4xl font-semibold tracking-tight text-[#dfcbe1] placeholder:text-[#b596b8] outline-none sm:text-6xl"
            />

            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_170px]">
              <div className="space-y-2 rounded-2xl border border-white/10 bg-[#6a406f]/70 p-3">
                <TimeRow
                  label="Start"
                  value={form.date}
                  onChange={(value) => setField("date", value)}
                />
                <TimeRow
                  label="End"
                  value={form.endDate}
                  min={form.date}
                  onChange={(value) => setField("endDate", value)}
                />
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#6a406f]/70 p-4">
                <p className="flex items-center gap-2 text-sm text-[#ceb8d0]">
                  <Globe size={14} />
                  Timezone
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">{utcOffset}</p>
                <p className="text-sm text-[#dec9df]">{toCityName(timeZone)}</p>
              </div>
            </div>

            {form.date && form.endDate && form.date >= form.endDate && (
              <p className="mt-2 text-xs text-rose-300">End time must be after start time.</p>
            )}

            <FieldBlock
              icon={<MapPin size={16} />}
              title="Add Event Location"
              subtitle="Offline location or virtual link"
              className="mt-3"
            >
              <LocationPicker
                value={form.location}
                onChange={(address) => setField("location", address)}
                onLocationChange={({ address, lat, lng }) => {
                  setField("location", address)
                  setField("lat", lat)
                  setField("lng", lng)
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

            <FieldBlock icon={<AlignLeft size={16} />} title="Add Description" className="mt-3">
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

            <p className="mt-4 text-sm font-semibold text-[#dfcade]">Event Options</p>
            <div className="mt-2 overflow-hidden rounded-2xl border border-white/10 bg-[#6a406f]/70">
              <OptionRow icon={<Ticket size={15} />} label="Ticket Price">
                <span className="font-semibold text-[#dfc7e0]">Free</span>
              </OptionRow>

              <OptionRow icon={<Check size={15} />} label="Require Approval">
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.requiresRsvp}
                  onClick={() => setField("requiresRsvp", !form.requiresRsvp)}
                  className={`relative h-7 w-12 rounded-full transition-colors ${
                    form.requiresRsvp ? "bg-fuchsia-400/80" : "bg-white/30"
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
                  type="number"
                  min={1}
                  max={100_000}
                  value={form.capacity}
                  onChange={(event) => setField("capacity", Number(event.target.value))}
                  className="w-28 rounded-lg border border-white/20 bg-black/20 px-3 py-1.5 text-right text-sm font-semibold text-white outline-none focus:border-fuchsia-300"
                />
              </OptionRow>
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-rose-200/25 bg-rose-900/30 px-4 py-3 text-xs text-rose-100">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!valid || submitting}
              className="mt-9 w-full rounded-xl bg-[#f4f2f6] py-3.5 text-3xl font-semibold text-[#2f1733] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 sm:text-[2rem]"
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

      <ThemeDock
        selectedTheme={selectedTheme}
        selectedFont={selectedFont}
        fontMenuOpen={fontMenuOpen}
        fontMenuRef={fontMenuRef}
        onThemeChange={setSelectedTheme}
        onFontChange={(font) => {
          setSelectedFont(font);
          setFontMenuOpen(false);
        }}
        onFontToggle={() => setFontMenuOpen((prev) => !prev)}
      />
    </div>
  );
}

function TimeRow({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: string;
  min?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-[58px_minmax(0,1fr)] items-center gap-3">
      <p className="text-lg font-semibold text-[#e9d7ea]">{label}</p>
      <input
        type="datetime-local"
        min={min}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-white/15 bg-[#7a527d]/70 px-3 py-2 text-sm font-semibold text-white outline-none [color-scheme:dark] focus:border-fuchsia-200"
      />
    </div>
  );
}

const fieldInputCls =
  "w-full rounded-lg border border-white/15 bg-[#7a527d]/45 px-3 py-2 text-sm text-[#f6ecf7] placeholder:text-[#ceb2d1] outline-none focus:border-fuchsia-200";

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
    <div className={`rounded-xl border border-white/10 bg-[#6a406f]/70 px-4 py-3 ${className ?? ""}`}>
      <div className="mb-2 flex items-center gap-2 text-[#e7d3e9]">
        <span className="text-[#d5bad8]">{icon}</span>
        <div>
          <p className="text-lg font-semibold leading-none">{title}</p>
          {subtitle && <p className="mt-1 text-sm text-[#cfb4d2]">{subtitle}</p>}
        </div>
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
    <div className={`flex items-center justify-between gap-3 px-4 py-3 ${last ? "" : "border-b border-white/10"}`}>
      <div className="flex items-center gap-2 text-xl font-semibold text-[#e6d2e8]">
        <span className="text-[#d5bad8]">{icon}</span>
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}

function ThemeDock({
  selectedTheme,
  selectedFont,
  fontMenuOpen,
  fontMenuRef,
  onThemeChange,
  onFontChange,
  onFontToggle,
}: {
  selectedTheme: EventThemeId;
  selectedFont: EventFontPreset;
  fontMenuOpen: boolean;
  fontMenuRef: React.RefObject<HTMLDivElement | null>;
  onThemeChange: (themeId: EventThemeId) => void;
  onFontChange: (font: EventFontPreset) => void;
  onFontToggle: () => void;
}) {
  return (
    <aside className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#2b1231]/95 backdrop-blur-md">
      <div className="mx-auto max-w-[1120px] px-4 pb-4 pt-3 sm:px-6 lg:px-8">
        <div className="mb-3 flex items-start gap-3 overflow-x-auto pb-1">
          {EVENT_THEME_OPTIONS.map((theme) => (
            <button
              key={theme.id}
              type="button"
              onClick={() => onThemeChange(theme.id)}
              className="flex shrink-0 flex-col items-center gap-1"
            >
              <span
                className={`h-14 w-20 rounded-xl border ${
                  theme.id === selectedTheme ? "border-white shadow-[0_0_0_2px_rgba(255,255,255,0.15)]" : "border-white/20"
                }`}
                style={{ background: theme.preview }}
              />
              <span className={`text-xs font-semibold ${theme.id === selectedTheme ? "text-white" : "text-[#b898bd]"}`}>
                {theme.label}
              </span>
            </button>
          ))}
        </div>

        <div className="grid gap-2 md:grid-cols-4">
          <DockChip icon={<Palette size={14} />} label="Colour" value="Custom" />
          <DockChip icon={<Sparkles size={14} />} label="Style" value="Auto" />

          <div ref={fontMenuRef} className="relative">
            <DockChip
              asButton
              icon={<Type size={14} />}
              label="Font"
              value={selectedFont}
              onClick={onFontToggle}
            />
            {fontMenuOpen && (
              <div className="absolute bottom-[calc(100%+0.55rem)] left-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl border border-white/15 bg-[#261729]/95 p-3 shadow-2xl backdrop-blur md:left-0 md:translate-x-0">
                <div className="grid grid-cols-4 gap-2">
                  {EVENT_FONT_PRESETS.map((font) => (
                    <button
                      key={font}
                      type="button"
                      onClick={() => onFontChange(font)}
                      className={`rounded-lg border px-2 py-2 text-left transition-colors ${
                        selectedFont === font
                          ? "border-white/70 bg-white/12 text-white"
                          : "border-white/15 bg-white/5 text-[#cab2cd] hover:bg-white/10"
                      }`}
                    >
                      <span className="block text-xl leading-none" style={{ fontFamily: getEventFontFamily(font) }}>
                        Ag
                      </span>
                      <span className="mt-1 block truncate text-xs font-semibold">{font}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DockChip icon={<Globe size={14} />} label="Display" value="Auto" />
        </div>
      </div>
    </aside>
  );
}

function DockChip({
  icon,
  label,
  value,
  asButton = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  asButton?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <span className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-2">
        <span className="text-[#ddc6df]">{icon}</span>
        <span className="text-lg font-semibold text-[#e4d2e7]">{label}</span>
      </span>
      <span className="text-lg font-semibold text-[#bba0bf]">{value}</span>
    </span>
  );

  const cls = "w-full rounded-xl border border-white/10 bg-[#5d3763]/70 px-4 py-2 text-left";

  if (asButton) {
    return (
      <button type="button" className={cls} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className={cls}>{content}</div>;
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
