import { kaolin } from "@arkiv-network/sdk/chains";
import { createConfig, http, injected } from "wagmi";

export const wagmiConfig = createConfig({
  chains: [kaolin],
  connectors: [
    injected({
      target: "metaMask",
      shimDisconnect: true,
    }),
  ],
  multiInjectedProviderDiscovery: false,
  ssr: true,
  transports: {
    [kaolin.id]: http(kaolin.rpcUrls.default.http[0]),
  },
});
