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
import type { ArkivResult, RSVP, RSVPStatus } from "../types"

const CONTENT_TYPE = "application/json" as const

// Compute expiry for RSVP entities — differentiated by status:
// - "pending" RSVPs auto-expire in 7 days if not approved
// - "confirmed" / "waitlisted" RSVPs live until event end + 7 days
// Result is rounded DOWN to a multiple of 2 (BLOCK_TIME) so that
// `expiresIn / BLOCK_TIME` is always an integer when the SDK converts to blocks.
function expiresInFromEventEnd(eventEndDate: number, status?: string): number {
  if (status === "pending") {
    // Pending RSVPs auto-expire in 7 days
    const seconds = Math.floor(ExpirationTime.fromDays(7))
    return Math.floor(seconds / 2) * 2
  }
  const secondsFromNow =
    eventEndDate - Math.floor(Date.now() / 1_000)
  // Add 7-day grace period after event end
  const gracePeriod = ExpirationTime.fromDays(7)
  const seconds = Math.floor(Math.max(secondsFromNow + gracePeriod, ExpirationTime.fromHours(1)))
  return Math.floor(seconds / 2) * 2
}

export async function createRsvpEntity(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  data: RSVP,
  eventEndDate: number,
  initialStatus: RSVPStatus = "confirmed",
): Promise<ArkivResult<{ entityKey: Hex; txHash: Hex }>> {
  try {
    const rsvpData: RSVP = { ...data }

    const result = await walletClient.createEntity({
      payload: jsonToPayload(rsvpData),
      contentType: CONTENT_TYPE,
      attributes: [
        { key: "type", value: ENTITY_TYPES.RSVP },
        { key: "eventKey", value: data.eventKey },
        
        
        { key: "attendeeWallet", value: walletClient.account.address },
        { key: "status", value: initialStatus },
      ],
      expiresIn: expiresInFromEventEnd(eventEndDate, initialStatus),
    })

    return { success: true, data: result as { entityKey: Hex; txHash: Hex } }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function updateRsvpStatus(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  entityKey: Hex,
  status: RSVPStatus,
): Promise<ArkivResult<{ entityKey: Hex; txHash: Hex }>> {
  try {
    // Validate one-way status transitions
    const entity = await publicClient.getEntity(entityKey)
    const currentStatusAttr = entity.attributes.find((a) => a.key === "status")
    const currentStatus = currentStatusAttr?.value as string

    const VALID_TRANSITIONS: Record<string, string[]> = {
      "pending": ["confirmed", "waitlisted"],
      "waitlisted": ["confirmed"],
      "confirmed": ["checked-in"],
      "checked-in": [],
    }

    const allowed = VALID_TRANSITIONS[currentStatus] ?? []
    if (!allowed.includes(status)) {
      return {
        success: false,
        error: `Invalid status transition: ${currentStatus} → ${status}`,
      }
    }

    // Use event-end-aware expiry (30 days for confirmed actions)
    const expiresIn = Math.floor(ExpirationTime.fromDays(30))

    const updatedAttrs = entity.attributes.map((a) =>
      a.key === "status" ? { key: "status", value: status } : a,
    )

    const currentRsvp = entity.toJson() as RSVP
    const updatedRsvp: RSVP = { ...currentRsvp }

    const result = await walletClient.updateEntity({
      entityKey,
      payload: jsonToPayload(updatedRsvp),
      contentType: CONTENT_TYPE,
      attributes: updatedAttrs,
      expiresIn,
    })

    return { success: true, data: result as { entityKey: Hex; txHash: Hex } }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Deletes an attendee-owned RSVP entity.
 *
 * NOTE (Pattern C — hybrid ownership): Organizer-owned entities linked to this
 * RSVP (approvals, rejections, checkins) cannot be deleted by the attendee’s
 * wallet. They will expire naturally per their TTL settings.
 */
export async function deleteRsvp(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  entityKey: Hex,
): Promise<ArkivResult<{ entityKey: Hex; txHash: Hex }>> {
  try {
    const result = await walletClient.deleteEntity({ entityKey })
    return { success: true, data: result as { entityKey: Hex; txHash: Hex } }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function getRsvpsByEvent(
  publicClient: PublicArkivClient,
  eventKey: Hex,
): Promise<ArkivResult<Entity[]>> {
  try {
    const result = await publicClient
      .buildQuery()
      .where([
        eq("type", ENTITY_TYPES.RSVP),
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

/**
 * Organizer creates an approval entity (owned by organizer) for a pending RSVP.
 * The RSVP entity itself is left untouched (owned by attendee — organizer cannot modify it).
 */
export async function confirmRsvp(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  rsvpEntityKey: Hex,
  eventEntityKey: Hex,
  attendeeWallet: Hex,
  eventEndDate: number,
): Promise<ArkivResult<{ entityKey: Hex; txHash: Hex }>> {
  try {
    // Create an approval entity owned by the organizer
    const result = await walletClient.createEntity({
      payload: jsonToPayload({ rsvpKey: rsvpEntityKey, attendeeWallet, eventKey: eventEntityKey, approvedAt: Math.floor(Date.now() / 1_000) }),
      contentType: CONTENT_TYPE,
      attributes: [
        { key: "type", value: ENTITY_TYPES.RSVP_APPROVAL },
        { key: "eventKey", value: eventEntityKey },
        { key: "rsvpKey", value: rsvpEntityKey },
        { key: "attendeeWallet", value: attendeeWallet },
      ],
      expiresIn: Math.floor(Math.max(
        eventEndDate - Math.floor(Date.now() / 1_000) + ExpirationTime.fromDays(7),
        ExpirationTime.fromHours(1),
      ) / 2) * 2,
    })

    // Increment event rsvpCount — organizer owns the event so this works
    try {
      const { updateRsvpCount } = await import("./event")
      await updateRsvpCount(walletClient, publicClient, eventEntityKey, true)
    } catch (_) { /* non-fatal */ }

    return { success: true, data: result as { entityKey: Hex; txHash: Hex } }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Organizer creates a rejection entity (owned by organizer) for a pending RSVP.
 * The RSVP entity itself is left untouched (owned by attendee — organizer cannot delete it).
 */
export async function rejectRsvp(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  rsvpEntityKey: Hex,
  eventEntityKey: Hex,
  attendeeWallet: Hex,
  eventEndDate: number,
): Promise<ArkivResult<{ entityKey: Hex; txHash: Hex }>> {
  try {
    const result = await walletClient.createEntity({
      payload: jsonToPayload({ rsvpKey: rsvpEntityKey, attendeeWallet, eventKey: eventEntityKey, rejectedAt: Math.floor(Date.now() / 1_000) }),
      contentType: CONTENT_TYPE,
      attributes: [
        { key: "type", value: ENTITY_TYPES.RSVP_REJECTION },
        { key: "eventKey", value: eventEntityKey },
        { key: "rsvpKey", value: rsvpEntityKey },
        { key: "attendeeWallet", value: attendeeWallet },
      ],
      expiresIn: Math.floor(Math.max(
        eventEndDate - Math.floor(Date.now() / 1_000) + ExpirationTime.fromDays(7),
        ExpirationTime.fromHours(1),
      ) / 2) * 2,
    })
    return { success: true, data: result as { entityKey: Hex; txHash: Hex } }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/** Returns all organizer-created approval entities for a given event. */
export async function getApprovalsByEvent(
  publicClient: PublicArkivClient,
  eventKey: Hex,
): Promise<ArkivResult<Entity[]>> {
  try {
    const result = await publicClient
      .buildQuery()
      .where([
        eq("type", ENTITY_TYPES.RSVP_APPROVAL),
        eq("eventKey", eventKey),
      ])
      .withAttributes()
      .fetch()
    return { success: true, data: result.entities }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/** Returns all organizer-created rejection entities for a given event. */
export async function getRejectionsByEvent(
  publicClient: PublicArkivClient,
  eventKey: Hex,
): Promise<ArkivResult<Entity[]>> {
  try {
    const result = await publicClient
      .buildQuery()
      .where([
        eq("type", ENTITY_TYPES.RSVP_REJECTION),
        eq("eventKey", eventKey),
      ])
      .withAttributes()
      .fetch()
    return { success: true, data: result.entities }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/** Returns the approval entity for a specific RSVP key (if any), used on attendee side. */
export async function getApprovalForRsvp(
  publicClient: PublicArkivClient,
  rsvpKey: Hex,
): Promise<ArkivResult<Entity | null>> {
  try {
    const result = await publicClient
      .buildQuery()
      .where([
        eq("type", ENTITY_TYPES.RSVP_APPROVAL),
        eq("rsvpKey", rsvpKey),
      ])
      .withAttributes()
      .fetch()
    return { success: true, data: result.entities[0] ?? null }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/** Returns the rejection entity for a specific RSVP key (if any), used on attendee side. */
export async function getRejectionForRsvp(
  publicClient: PublicArkivClient,
  rsvpKey: Hex,
): Promise<ArkivResult<Entity | null>> {
  try {
    const result = await publicClient
      .buildQuery()
      .where([
        eq("type", ENTITY_TYPES.RSVP_REJECTION),
        eq("rsvpKey", rsvpKey),
      ])
      .withAttributes()
      .fetch()
    return { success: true, data: result.entities[0] ?? null }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function getRsvpByAttendee(
  publicClient: PublicArkivClient,
  eventKey: Hex,
  attendeeWallet: Hex,
): Promise<ArkivResult<Entity | null>> {
  try {
    const result = await publicClient
      .buildQuery()
      .where([
        eq("type", ENTITY_TYPES.RSVP),
        eq("eventKey", eventKey),
      ])
      .ownedBy(attendeeWallet)
      .withPayload()
      .withAttributes()
      .fetch()

    const entity = result.entities[0] ?? null
    return { success: true, data: entity }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Promotes the first waitlisted attendee by creating an approval entity.
 * 
 * NOTE (Pattern C): The organizer cannot directly update the attendee-owned RSVP
 * entity. Instead, we create an RSVP_APPROVAL entity (owned by organizer) which
 * the UI interprets as an upgrade from "waitlisted" → "confirmed".
 */
export async function promoteFirstWaitlisted(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  eventKey: Hex,
  eventEndDate?: number,
): Promise<ArkivResult<{ promoted: boolean; entityKey?: Hex }>> {
  try {
    const result = await publicClient
      .buildQuery()
      .where([
        eq("type", ENTITY_TYPES.RSVP),
        eq("eventKey", eventKey),
        eq("status", "waitlisted"),
      ])
      .withPayload()
      .withAttributes()
      .fetch()

    if (result.entities.length === 0) {
      return { success: true, data: { promoted: false } }
    }

    const first = result.entities[0]
    const attendeeWalletAttr = first.attributes.find((a) => a.key === "attendeeWallet")
    const attendeeWallet = (attendeeWalletAttr?.value as Hex) ?? (first.owner as Hex)

    // Create an approval entity — same pattern as confirmRsvp
    const endDate = eventEndDate ?? Math.floor(Date.now() / 1_000) + 86_400
    const approvalRes = await confirmRsvp(
      walletClient,
      publicClient,
      first.key as Hex,
      eventKey,
      attendeeWallet,
      endDate,
    )

    if (!approvalRes.success) throw new Error(approvalRes.error)

    return { success: true, data: { promoted: true, entityKey: first.key as Hex } }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
