"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { WagmiProvider } from "wagmi";
import { Toaster } from "react-hot-toast";
import { wagmiConfig } from "@/lib/wagmi";

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            
            staleTime: 30_000,
          },
        },
      }),
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#18181b",
              color: "#f4f4f5",
              border: "1px solid rgba(255,255,255,0.08)",
              fontSize: "0.875rem",
            },
            success: {
              iconTheme: { primary: "#a78bfa", secondary: "#18181b" },
            },
            error: {
              iconTheme: { primary: "#f87171", secondary: "#18181b" },
            },
          }}
        />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
