import { eq } from "@arkiv-network/sdk/query";
import type { Entity, PublicArkivClient } from "@arkiv-network/sdk";
import type { Hex } from "viem";
import { ENTITY_TYPES } from "../constants";
import type { ArkivResult } from "../types";

export async function getOrganizerByWallet(
  publicClient: PublicArkivClient,
  walletAddress: Hex,
): Promise<ArkivResult<Entity | null>> {
  try {
    const result = await publicClient
      .buildQuery()
      .where([eq("type", ENTITY_TYPES.ORGANIZER_PROFILE)])
      .ownedBy(walletAddress)
      .withPayload()
      .withAttributes()
      .fetch();

    return { success: true, data: result.entities[0] ?? null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function getUserProfileByWallet(
  publicClient: PublicArkivClient,
  walletAddress: Hex,
): Promise<ArkivResult<Entity | null>> {
  try {
    const result = await publicClient
      .buildQuery()
      .where([eq("type", ENTITY_TYPES.USER_PROFILE)])
      .ownedBy(walletAddress)
      .withPayload()
      .withAttributes()
      .fetch();

    return { success: true, data: result.entities[0] ?? null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
