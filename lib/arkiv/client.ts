

import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
} from "@arkiv-network/sdk";
import { kaolin } from "@arkiv-network/sdk/chains";
import type { Account, EIP1193RequestFn } from "viem";

export const publicClient = createPublicClient({
  chain: kaolin,
  transport: http(kaolin.rpcUrls.default.http[0]),
});

export function getWalletClient(
  account: Account,
  provider: { request: EIP1193RequestFn },
) {
  return createWalletClient({
    chain: kaolin,
    transport: custom(provider),
    account,
  });
}

export { kaolin };
