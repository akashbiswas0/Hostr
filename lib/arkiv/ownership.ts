import type { PublicArkivClient } from "@arkiv-network/sdk";
import type { Hex } from "viem";
import { ENTITY_TYPES } from "./constants";

function normalizeAddress(value: string | undefined | null): string {
  return (value ?? "").toLowerCase();
}

export async function assertCallerOwnsEntity(
  publicClient: PublicArkivClient,
  entityKey: Hex,
  callerWallet: Hex,
  entityLabel = "entity",
): Promise<void> {
  const entity = await publicClient.getEntity(entityKey);
  if (normalizeAddress(entity.owner) !== normalizeAddress(callerWallet)) {
    throw new Error(`Unauthorized: only ${entityLabel} owner can mutate this ${entityLabel}.`);
  }
}

export async function assertCallerOwnsHostEvent(
  publicClient: PublicArkivClient,
  eventKey: Hex,
  callerWallet: Hex,
): Promise<void> {
  const event = await publicClient.getEntity(eventKey);
  const type = event.attributes.find((a) => a.key === "type")?.value;
  if (type !== ENTITY_TYPES.HOSTEVENT) {
    throw new Error("Invalid hostevent reference.");
  }
  if (normalizeAddress(event.owner) !== normalizeAddress(callerWallet)) {
    throw new Error("Unauthorized: only hostevent owner can mutate this hostevent.");
  }
}
