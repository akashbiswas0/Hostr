"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  RefreshCw,
  WandSparkles,
  X,
} from "lucide-react";

interface AIImageGeneratorProps {
  eventTitle: string;
  eventCategory: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectImage: (dataUrl: string) => Promise<void>;
}

const STYLE_PILLS = [
  "Minimalist",
  "Neon glow",
  "Watercolor",
  "Cyberpunk",
  "Abstract",
  "Dark moody",
];

function buildDefaultPrompt(title: string, category: string): string {
  if (title.trim()) {
    return `Event cover for "${title}" — a ${category || "special"} event. Vibrant, modern, abstract design. Square format.`;
  }
  return "A stunning vibrant event cover image. Modern abstract art, square format.";
}

function SpinnerIcon() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
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

export default function AIImageGenerator({
  eventTitle,
  eventCategory,
  isOpen,
  onClose,
  onSelectImage,
}: AIImageGeneratorProps) {
  const [prompt, setPrompt] = useState(() =>
    buildDefaultPrompt(eventTitle, eventCategory),
  );
  const [userEditedPrompt, setUserEditedPrompt] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [generatedDataUrl, setGeneratedDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sync prompt when title/category change, but only if user hasn't edited
  useEffect(() => {
    if (!userEditedPrompt) {
      setPrompt(buildDefaultPrompt(eventTitle, eventCategory));
    }
  }, [eventTitle, eventCategory, userEditedPrompt]);

  // Reset state when modal opens
  const prevOpen = useRef(isOpen);
  useEffect(() => {
    if (isOpen && !prevOpen.current) {
      setGeneratedDataUrl(null);
      setError(null);
      setIsUploading(false);
      setUserEditedPrompt(false);
      setPrompt(buildDefaultPrompt(eventTitle, eventCategory));
    }
    prevOpen.current = isOpen;
  }, [isOpen, eventTitle, eventCategory]);

  async function handleGenerate() {
    setIsGenerating(true);
    setError(null);
    setGeneratedDataUrl(null);
    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      const dataUrl = `data:${data.mimeType};base64,${data.imageData}`;
      setGeneratedDataUrl(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-md rounded-2xl border border-white/15 bg-[#2b1231] p-6 shadow-2xl">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-[#ceb2d1] transition-colors hover:text-white"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/20">
            <WandSparkles size={16} className="text-fuchsia-300" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">AI Cover Generator</h2>
            <p className="text-xs text-[#ceb2d1]">Powered by Gemini</p>
          </div>
        </div>

        {/* Prompt textarea */}
        <label className="mb-1 block text-xs font-semibold text-[#dbc3dd]">
          Describe your image
        </label>
        <textarea
          rows={3}
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            setUserEditedPrompt(true);
          }}
          className="w-full resize-none rounded-xl border border-white/15 bg-[#3d1e42] px-3 py-2 text-sm text-[#f6ecf7] placeholder:text-[#ceb2d1] outline-none focus:border-fuchsia-300"
          placeholder="Describe the image you want..."
        />

        {/* Style pills */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {STYLE_PILLS.map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => {
                setPrompt((p) => p + `, ${style} style`);
                setUserEditedPrompt(true);
              }}
              className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-[#ceb2d1] transition-colors hover:border-fuchsia-400/30 hover:bg-fuchsia-500/20 hover:text-fuchsia-200"
            >
              {style}
            </button>
          ))}
        </div>

        {/* Generate button */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-fuchsia-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isGenerating ? (
            <>
              <SpinnerIcon />
              Generating...
            </>
          ) : (
            <>
              <WandSparkles size={15} />
              Generate Image
            </>
          )}
        </button>

        {/* Error state */}
        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-300/20 bg-rose-900/30 px-4 py-3 text-sm text-rose-200">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Generated image preview */}
        {generatedDataUrl && (
          <div className="relative mt-4 group">
            <img
              src={generatedDataUrl}
              alt="AI generated cover"
              className="w-full aspect-square rounded-xl object-cover"
            />

            {/* Hover overlay */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 opacity-0 transition-opacity group-hover:opacity-100" />

            {/* Regenerate button */}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || isUploading}
              className="absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-black/60 px-2.5 py-1.5 text-xs text-white hover:bg-black/80 disabled:opacity-50"
            >
              <RefreshCw size={12} />
              Regenerate
            </button>

            {/* Use this image button */}
            <button
              type="button"
              disabled={isUploading}
              onClick={async () => {
                setIsUploading(true);
                try {
                  await onSelectImage(generatedDataUrl);
                } finally {
                  setIsUploading(false);
                }
                onClose();
              }}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-fuchsia-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isUploading ? (
                <><SpinnerIcon /> Uploading...</>
              ) : (
                <><Check size={15} /> Use This Image</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
