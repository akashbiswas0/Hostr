import { getDefaultConfig } from "connectkit";
import { createConfig, http } from "wagmi";
import { kaolin } from "@arkiv-network/sdk/chains";

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "YOUR_WALLETCONNECT_PROJECT_ID";

export const wagmiConfig = createConfig(
  getDefaultConfig({
    
    chains: [kaolin],
    transports: {
      [kaolin.id]: http(kaolin.rpcUrls.default.http[0]),
    },

    
    walletConnectProjectId,

    
    appName: "OnChain Events",
    appDescription: "A decentralised event platform built on Arkiv.",
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "https://onchain.events",
    appIcon: "/logo.png",
  }),
);
