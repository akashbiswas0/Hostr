"use client";

import { useEffect, useRef } from "react";

interface QrScannerProps {
  onScan: (result: string) => void;
  onError?: (error: string) => void;
}

const ELEMENT_ID = "qr-scanner-region";

/**
 * Camera-based QR code scanner.
 * Dynamically imports html5-qrcode at runtime (client-only).
 * Uses the rear camera on mobile ("environment" facing mode).
 */
export function QrScanner({ onScan, onError }: QrScannerProps) {
  // Keep refs so the effect closure always calls the latest callbacks
  const onScanRef = useRef(onScan);
  const onErrorRef = useRef(onError);
  onScanRef.current = onScan;
  onErrorRef.current = onError;

  useEffect(() => {
    let unmounted = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let scanner: any = null;
    // Only true between a successful .start() and a subsequent .stop()
    let isRunning = false;

    async function safeStop() {
      if (scanner && isRunning) {
        isRunning = false;
        try {
          await scanner.stop();
        } catch {
          // Already stopped — ignore
        }
      }
    }

    import("html5-qrcode").then(({ Html5Qrcode }) => {
      if (unmounted) return;

      scanner = new Html5Qrcode(ELEMENT_ID);

      const config = { fps: 10, qrbox: { width: 250, height: 250 } };

      const onSuccess = (text: string) => {
        onScanRef.current(text);
        safeStop();
      };
      const onFrameError = () => { /* per-frame errors are normal */ };

      // Try rear camera first (works on mobile), fall back to any camera (laptop)
      scanner
        .start({ facingMode: "environment" }, config, onSuccess, onFrameError)
        .then(() => {
          if (!unmounted) isRunning = true;
          else safeStop();
        })
        .catch(() => {
          // Rear camera not available (laptop) — try default camera
          if (unmounted) return;
          scanner
            .start({ facingMode: "user" }, config, onSuccess, onFrameError)
            .then(() => {
              if (!unmounted) isRunning = true;
              else safeStop();
            })
            .catch((err: unknown) => {
              onErrorRef.current?.(String(err));
            });
        });
    });

    return () => {
      unmounted = true;
      safeStop();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      id={ELEMENT_ID}
      className="w-full rounded-lg overflow-hidden bg-black"
    />
  );
}
