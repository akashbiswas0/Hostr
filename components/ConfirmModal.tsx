"use client";

import { useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl shadow-black/60 p-6 space-y-4"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-zinc-500 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        <div className="flex items-start gap-3 pr-6">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            destructive
              ? "bg-rose-900/40 border border-rose-700/30"
              : "bg-amber-900/40 border border-amber-700/30"
          }`}>
            <AlertTriangle
              size={16}
              className={destructive ? "text-rose-400" : "text-amber-400"}
            />
          </div>
          <div className="space-y-1">
            <h2 id="confirm-modal-title" className="text-sm font-semibold text-white">
              {title}
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-colors ${
              destructive
                ? "bg-rose-600 hover:bg-rose-500"
                : "bg-violet-600 hover:bg-violet-500"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
