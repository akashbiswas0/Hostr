"use client";

import { useEffect, useRef } from "react";

interface QrScannerProps {
  onScan: (result: string) => void;
  onError?: (error: string) => void;
}

const ELEMENT_ID = "qr-scanner-region";

export function QrScanner({ onScan, onError }: QrScannerProps) {

  const onScanRef = useRef(onScan);
  const onErrorRef = useRef(onError);
  onScanRef.current = onScan;
  onErrorRef.current = onError;

  useEffect(() => {
    let unmounted = false;

    let scanner: any = null;

    let isRunning = false;

    async function safeStop() {
      if (scanner && isRunning) {
        isRunning = false;
        try {
          await scanner.stop();
        } catch {

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
      const onFrameError = () => {  };

      scanner
        .start({ facingMode: "environment" }, config, onSuccess, onFrameError)
        .then(() => {
          if (!unmounted) isRunning = true;
          else safeStop();
        })
        .catch(() => {

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

  }, []);

  return (
    <div
      id={ELEMENT_ID}
      className="w-full rounded-lg overflow-hidden bg-black"
    />
  );
}
