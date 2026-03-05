/**
 * Proof-of-Attendance (PoA) entity — minted by organizer after attendee check-in.
 * Long-lived on-chain proof that an attendee was present at an event.
 */

import { jsonToPayload } from "@arkiv-network/sdk"
import { eq } from "@arkiv-network/sdk/query"
import { ExpirationTime } from "@arkiv-network/sdk/utils"
import type { Account, Chain, Hex, Transport } from "viem"
import type {
  Entity,
  PublicArkivClient,
  WalletArkivClient,
} from "@arkiv-network/sdk"
import { ENTITY_TYPES } from "../constants"
import type { ArkivResult } from "../types"

const CONTENT_TYPE = "application/json" as const

export interface ProofOfAttendance {
  eventKey: string
  attendeeWallet: string
  eventTitle: string
  checkedInAt: number
  mintedAt: number
}

/**
 * Mints a proof-of-attendance entity after successful check-in.
 * Owned by the organizer on behalf of the attendee.
 * Expiration: 2 years (long-lived proof).
 */
export async function createPoAEntity(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  eventKey: Hex,
  rsvpKey: Hex,
  attendeeWallet: Hex,
  checkinKey: Hex,
  eventTitle: string,
): Promise<ArkivResult<{ entityKey: Hex; txHash: Hex }>> {
  try {
    const poaData: ProofOfAttendance = {
      eventKey,
      attendeeWallet,
      eventTitle,
      checkedInAt: Math.floor(Date.now() / 1_000),
      mintedAt: Math.floor(Date.now() / 1_000),
    }

    const result = await walletClient.createEntity({
      payload: jsonToPayload(poaData),
      contentType: CONTENT_TYPE,
      attributes: [
        { key: "type", value: ENTITY_TYPES.PROOF_OF_ATTENDANCE },
        { key: "eventKey", value: eventKey },
        { key: "rsvpKey", value: rsvpKey },
        { key: "attendeeWallet", value: attendeeWallet },
        { key: "checkinKey", value: checkinKey },
      ],
      // PoA is a long-lived proof — 2 years
      expiresIn: Math.floor(ExpirationTime.fromDays(730)),
    })

    return { success: true, data: result as { entityKey: Hex; txHash: Hex } }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/** Get all PoA entities for a specific attendee wallet. */
export async function getPoAsByAttendee(
  publicClient: PublicArkivClient,
  attendeeWallet: Hex,
): Promise<ArkivResult<Entity[]>> {
  try {
    const result = await publicClient
      .buildQuery()
      .where([
        eq("type", ENTITY_TYPES.PROOF_OF_ATTENDANCE),
        eq("attendeeWallet", attendeeWallet),
      ])
      .withPayload()
      .withAttributes()
      .fetch()

    return { success: true, data: result.entities }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/** Get all PoA entities for a specific event. */
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
      .fetch()

    return { success: true, data: result.entities }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
