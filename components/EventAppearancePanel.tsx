"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Palette, Type, X } from "lucide-react";
import {
  EVENT_EMOJI_OPTIONS,
  EVENT_FONT_PRESETS,
  EVENT_THEME_OPTIONS,
  getEventFontFamily,
  type EventFontPreset,
  type EventThemeId,
} from "@/lib/eventAppearance";

type EventAppearancePanelProps = {
  open: boolean;
  onClose: () => void;
  selectedTheme: EventThemeId;
  selectedFont: EventFontPreset;
  selectedThemeColor: string;
  selectedEmojiSymbol: string;
  onThemeChange: (themeId: EventThemeId) => void;
  onFontChange: (font: EventFontPreset) => void;
  onThemeColorChange: (value: string) => void;
  onEmojiSymbolChange: (emoji: string) => void;
};

type ActiveMenu = "emoji" | "font" | null;

export function EventAppearancePanel({
  open,
  onClose,
  selectedTheme,
  selectedFont,
  selectedThemeColor,
  selectedEmojiSymbol,
  onThemeChange,
  onFontChange,
  onThemeColorChange,
  onEmojiSymbolChange,
}: EventAppearancePanelProps) {
  const [activeMenu, setActiveMenu] = useState<ActiveMenu>(null);
  const selectedEmojiOption = useMemo(
    () => EVENT_EMOJI_OPTIONS.find((option) => option.emoji === selectedEmojiSymbol) ?? EVENT_EMOJI_OPTIONS[0],
    [selectedEmojiSymbol],
  );

  useEffect(() => {
    if (!open) return;

    function onEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (activeMenu) {
        setActiveMenu(null);
        return;
      }
      onClose();
    }

    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [activeMenu, onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90]">
      <button
        type="button"
        onClick={() => {
          setActiveMenu(null);
          onClose();
        }}
        className="absolute inset-0 bg-black/20"
        aria-label="Close appearance panel"
      />

      <div className="absolute inset-x-2 bottom-2 sm:inset-x-4 sm:bottom-4">
        <div className="mx-auto w-full max-w-5xl rounded-2xl border border-white/15 bg-[#1b3318]/95 p-3 text-white shadow-[0_20px_60px_-24px_rgba(0,0,0,0.8)] backdrop-blur-md">
          <div className="flex items-center justify-between">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-200">
              <Palette size={14} />
              Event Appearance
            </p>
            <button
              type="button"
              onClick={() => {
                setActiveMenu(null);
                onClose();
              }}
              className="rounded-lg border border-white/15 bg-white/5 p-1.5 text-zinc-200 hover:bg-white/10"
            >
              <X size={14} />
            </button>
          </div>

          <section className="mt-2">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {EVENT_THEME_OPTIONS.map((theme) => {
                const selected = theme.id === selectedTheme;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => {
                      onThemeChange(theme.id);
                      setActiveMenu(null);
                    }}
                    className={`shrink-0 rounded-xl border px-1.5 pb-1.5 pt-1 text-left transition-colors ${
                      selected
                        ? "border-white/70 bg-white/14"
                        : "border-white/15 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <span
                      className="block h-10 w-24 rounded-lg border border-white/20"
                      style={{ background: theme.preview }}
                    />
                    <span className={`mt-1 block text-xs font-semibold ${selected ? "text-white" : "text-zinc-300"}`}>
                      {theme.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {selectedTheme === "minimal" ? (
              <section className="rounded-xl border border-white/12 bg-black/20 px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-300">Colour</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    type="color"
                    value={selectedThemeColor}
                    onChange={(event) => onThemeColorChange(event.target.value)}
                    className="h-8 w-10 cursor-pointer rounded-md border border-white/20 bg-transparent"
                  />
                  <p className="text-sm font-semibold">{selectedThemeColor.toUpperCase()}</p>
                </div>
              </section>
            ) : selectedTheme === "emoji" ? (
              <section className="relative">
                <button
                  type="button"
                  onClick={() => setActiveMenu((current) => (current === "emoji" ? null : "emoji"))}
                  className="flex w-full items-center gap-2 rounded-xl border border-white/12 bg-black/20 px-3 py-2.5 text-left transition-colors hover:bg-white/10"
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/20 bg-white/10 text-xl leading-none">
                    {selectedEmojiOption.emoji}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-300">Emoji</span>
                    <span className="truncate text-sm font-semibold text-white">{selectedEmojiOption.label}</span>
                  </span>
                  <ChevronsUpDown size={14} className="ml-auto text-zinc-400" />
                </button>

                {activeMenu === "emoji" && (
                  <div className="absolute bottom-full left-0 z-20 mb-2 w-[320px] max-w-[calc(100vw-1rem)] rounded-xl border border-white/20 bg-[#213e1d]/97 p-2 shadow-2xl">
                    <div className="grid grid-cols-4 gap-1.5">
                      {EVENT_EMOJI_OPTIONS.map((option) => {
                        const selected = option.emoji === selectedEmojiSymbol;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => {
                              onEmojiSymbolChange(option.emoji);
                              setActiveMenu(null);
                            }}
                            className={`rounded-lg border px-1.5 py-2 text-center transition-colors ${
                              selected
                                ? "border-white/70 bg-white/15"
                                : "border-white/15 bg-white/5 hover:bg-white/10"
                            }`}
                          >
                            <span className="text-xl leading-none">{option.emoji}</span>
                            <span className="mt-1 block truncate text-[10px] font-medium text-zinc-200">{option.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>
            ) : (
              <div className="rounded-xl border border-white/12 bg-black/20 px-3 py-2.5 text-sm text-zinc-300">
                Pattern theme fills the page with abstract shapes.
              </div>
            )}

            <section className="relative">
              <button
                type="button"
                onClick={() => setActiveMenu((current) => (current === "font" ? null : "font"))}
                className="flex w-full items-center gap-2 rounded-xl border border-white/12 bg-black/20 px-3 py-2.5 text-left transition-colors hover:bg-white/10"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/20 bg-white/10 text-lg leading-none">
                  <Type size={15} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-300">Font</span>
                  <span className="truncate text-sm font-semibold text-white">{selectedFont}</span>
                </span>
                <ChevronsUpDown size={14} className="ml-auto text-zinc-400" />
              </button>

              {activeMenu === "font" && (
                <div className="absolute bottom-full right-0 z-20 mb-2 w-[380px] max-w-[calc(100vw-1rem)] rounded-xl border border-white/20 bg-[#213e1d]/97 p-2 shadow-2xl">
                  <div className="grid grid-cols-4 gap-1.5">
                    {EVENT_FONT_PRESETS.map((font) => {
                      const selected = font === selectedFont;
                      return (
                        <button
                          key={font}
                          type="button"
                          onClick={() => {
                            onFontChange(font);
                            setActiveMenu(null);
                          }}
                          className={`rounded-lg border px-2 py-2 text-left transition-colors ${
                            selected
                              ? "border-white/70 bg-white/12 text-white"
                              : "border-white/15 bg-white/5 text-zinc-200 hover:bg-white/10"
                          }`}
                        >
                          <span className="block text-[1.65rem] leading-none" style={{ fontFamily: getEventFontFamily(font) }}>
                            Ag
                          </span>
                          <span className="mt-1 flex items-center gap-1 truncate text-[11px] font-semibold">
                            {selected ? <Check size={11} className="shrink-0" /> : null}
                            <span className="truncate">{font}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
