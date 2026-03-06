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

function expiresInFromEventEnd(eventEndDate: number): number {
  const secondsFromNow =
    eventEndDate - Math.floor(Date.now() / 1_000)

  const gracePeriod = ExpirationTime.fromDays(1)
  const seconds = Math.floor(Math.max(secondsFromNow + gracePeriod, ExpirationTime.fromHours(1)))
  return Math.floor(seconds / 2) * 2
}

export async function createCheckinEntity(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  eventKey: Hex,
  attendeeWallet: Hex,
  eventEndDate: number,
  rsvpKey?: Hex,
): Promise<ArkivResult<{ entityKey: Hex; txHash: Hex }>> {
  try {
    const checkinData = {
      eventKey,
      attendeeWallet,
      rsvpKey: rsvpKey ?? "",
      checkedInAt: Math.floor(Date.now() / 1_000),
    }

    const result = await walletClient.createEntity({
      payload: jsonToPayload(checkinData),
      contentType: CONTENT_TYPE,
      attributes: [
        { key: "type", value: ENTITY_TYPES.CHECKIN },
        { key: "eventKey", value: eventKey },
        { key: "attendeeWallet", value: attendeeWallet },

        { key: "rsvpKey", value: rsvpKey ?? "" },
      ],
      expiresIn: expiresInFromEventEnd(eventEndDate),
    })

    return { success: true, data: result as { entityKey: Hex; txHash: Hex } }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

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
      .fetch()

    return { success: true, data: result.entities }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
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
      .fetch()

    return { success: true, data: result.entities.length > 0 }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
