import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
} from "@arkiv-network/sdk";
import { kaolin } from "@arkiv-network/sdk/chains";
import type { Account, EIP1193RequestFn, Hex } from "viem";
import type { Entity } from "@arkiv-network/sdk";

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

export function assertOwnership(entity: Entity, walletAddress: Hex): void {
  const owner = (entity.owner ?? "").toLowerCase();
  const wallet = walletAddress.toLowerCase();
  if (owner !== wallet) {
    throw new Error("You don't own this entity — only the original creator can modify it.");
  }
}

export { kaolin };
