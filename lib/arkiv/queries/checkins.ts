import { eq } from "@arkiv-network/sdk/query";
import type { Entity, PublicArkivClient } from "@arkiv-network/sdk";
import type { Hex } from "viem";
import { ENTITY_TYPES } from "../constants";
import type { ArkivResult } from "../types";

export async function getCheckinsByEvent(
  publicClient: PublicArkivClient,
  eventKey: Hex,
): Promise<ArkivResult<Entity[]>> {
  try {
    const result = await publicClient
      .buildQuery()
      .where([
        eq("type", ENTITY_TYPES.CHECKIN),
        eq("eventKey", eventKey),
      ])
      .withPayload()
      .withAttributes()
      .orderBy("checkedInAt", "number", "asc")
      .fetch();

    return { success: true, data: result.entities };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function hasAttendeeCheckedIn(
  publicClient: PublicArkivClient,
  eventKey: Hex,
  attendeeWallet: Hex,
): Promise<ArkivResult<boolean>> {
  try {
    const result = await publicClient
      .buildQuery()
      .where([
        eq("type", ENTITY_TYPES.CHECKIN),
        eq("eventKey", eventKey),
        eq("attendeeWallet", attendeeWallet),
      ])
      .withAttributes()
      .fetch();

    return { success: true, data: result.entities.length > 0 };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
