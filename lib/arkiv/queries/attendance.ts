import { eq } from "@arkiv-network/sdk/query";
import type { Entity, PublicArkivClient } from "@arkiv-network/sdk";
import type { Hex } from "viem";
import { ENTITY_TYPES } from "../constants";
import type { ArkivResult } from "../types";

export async function getPoAsByAttendee(
  publicClient: PublicArkivClient,
  attendeeWallet: Hex,
): Promise<ArkivResult<Entity[]>> {
  try {
    const result = await publicClient
      .buildQuery()
      .where([eq("type", ENTITY_TYPES.PROOF_OF_ATTENDANCE)])
      .ownedBy(attendeeWallet)
      .withPayload()
      .withAttributes()
      .orderBy("issuedAt", "number", "desc")
      .fetch();

    return { success: true, data: result.entities };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function getPoAsByEvent(
  publicClient: PublicArkivClient,
  eventKey: Hex,
): Promise<ArkivResult<Entity[]>> {
  try {
    const result = await publicClient
      .buildQuery()
      .where([
        eq("type", ENTITY_TYPES.PROOF_OF_ATTENDANCE),
        eq("eventKey", eventKey),
      ])
      .withPayload()
      .withAttributes()
      .orderBy("issuedAt", "number", "desc")
      .fetch();

    return { success: true, data: result.entities };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
