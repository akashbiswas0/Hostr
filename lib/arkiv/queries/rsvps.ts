/**
 * RSVP / approval / rejection query functions — read-only Arkiv queries.
 */

import { eq } from "@arkiv-network/sdk/query"
import type { Entity, PublicArkivClient } from "@arkiv-network/sdk"
import type { Hex } from "viem"
import { ENTITY_TYPES } from "../constants"
import type { ArkivResult, RSVPStatus } from "../types"

// ─── RSVPs ───────────────────────────────────────────────────────────────────

/** All RSVPs for a given event. */
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

/** RSVPs for a given event filtered by status (multi-filter query). */
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

/** Confirmed RSVPs for a given event. */
export async function getConfirmedRsvpsByEvent(
  publicClient: PublicArkivClient,
  eventKey: Hex,
): Promise<ArkivResult<Entity[]>> {
  return getRsvpsByEventAndStatus(publicClient, eventKey, "confirmed")
}

/** Pending RSVPs for a given event. */
export async function getPendingRsvpsByEvent(
  publicClient: PublicArkivClient,
  eventKey: Hex,
): Promise<ArkivResult<Entity[]>> {
  return getRsvpsByEventAndStatus(publicClient, eventKey, "pending")
}

/** A specific attendee's RSVP for an event (using ownedBy filter). */
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

// ─── Approvals ───────────────────────────────────────────────────────────────

/** All organizer-created approval entities for a given event. */
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

/** Approval entity for a specific RSVP key (if any). */
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

// ─── Rejections ──────────────────────────────────────────────────────────────

/** All organizer-created rejection entities for a given event. */
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

/** Rejection entity for a specific RSVP key (if any). */
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
