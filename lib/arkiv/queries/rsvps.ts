import { eq } from "@arkiv-network/sdk/query"
import type { Entity, PublicArkivClient } from "@arkiv-network/sdk"
import type { Hex } from "viem"
import { ENTITY_TYPES } from "../constants"
import type { ArkivResult, RSVPStatus } from "../types"

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

export async function getRsvpsByEventAndStatus(
  publicClient: PublicArkivClient,
  eventKey: Hex,
  status: RSVPStatus,
): Promise<ArkivResult<Entity[]>> {
  try {
    const result = await publicClient
      .buildQuery()
      .where([
        eq("type", ENTITY_TYPES.RSVP),
        eq("eventKey", eventKey),
        eq("status", status),
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

export async function getConfirmedRsvpsByEvent(
  publicClient: PublicArkivClient,
  eventKey: Hex,
): Promise<ArkivResult<Entity[]>> {
  return getRsvpsByEventAndStatus(publicClient, eventKey, "confirmed")
}

export async function getPendingRsvpsByEvent(
  publicClient: PublicArkivClient,
  eventKey: Hex,
): Promise<ArkivResult<Entity[]>> {
  return getRsvpsByEventAndStatus(publicClient, eventKey, "pending")
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
