import { eq } from "@arkiv-network/sdk/query";
import type { Entity, PublicArkivClient } from "@arkiv-network/sdk";
import type { Hex } from "viem";
import { ENTITY_TYPES } from "../constants";
import type { ArkivResult, RSVPStatus, RsvpDecision } from "../types";

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
      .orderBy("requestedAt", "number", "asc")
      .fetch();

    return { success: true, data: result.entities };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
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
      .orderBy("requestedAt", "number", "asc")
      .fetch();

    return { success: true, data: result.entities };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function getConfirmedRsvpsByEvent(
  publicClient: PublicArkivClient,
  eventKey: Hex,
): Promise<ArkivResult<Entity[]>> {
  return getRsvpsByEventAndStatus(publicClient, eventKey, "confirmed");
}

export async function getPendingRsvpsByEvent(
  publicClient: PublicArkivClient,
  eventKey: Hex,
): Promise<ArkivResult<Entity[]>> {
  return getRsvpsByEventAndStatus(publicClient, eventKey, "pending");
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
      .fetch();

    return { success: true, data: result.entities[0] ?? null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function getDecisionsByEvent(
  publicClient: PublicArkivClient,
  eventKey: Hex,
  decision?: RsvpDecision,
): Promise<ArkivResult<Entity[]>> {
  try {
    const predicates = [
      eq("type", ENTITY_TYPES.RSVP_DECISION),
      eq("eventKey", eventKey),
      ...(decision ? [eq("decision", decision)] : []),
    ];

    const result = await publicClient
      .buildQuery()
      .where(predicates)
      .withAttributes()
      .orderBy("decidedAt", "number", "asc")
      .fetch();

    return { success: true, data: result.entities };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function getDecisionForRsvp(
  publicClient: PublicArkivClient,
  rsvpKey: Hex,
  decision?: RsvpDecision,
): Promise<ArkivResult<Entity | null>> {
  try {
    const predicates = [
      eq("type", ENTITY_TYPES.RSVP_DECISION),
      eq("rsvpKey", rsvpKey),
      ...(decision ? [eq("decision", decision)] : []),
    ];

    const result = await publicClient
      .buildQuery()
      .where(predicates)
      .withAttributes()
      .orderBy("decidedAt", "number", "desc")
      .fetch();

    return { success: true, data: result.entities[0] ?? null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Compatibility wrappers used by current UI.
export async function getApprovalsByEvent(
  publicClient: PublicArkivClient,
  eventKey: Hex,
): Promise<ArkivResult<Entity[]>> {
  return getDecisionsByEvent(publicClient, eventKey, "approved");
}

export async function getRejectionsByEvent(
  publicClient: PublicArkivClient,
  eventKey: Hex,
): Promise<ArkivResult<Entity[]>> {
  return getDecisionsByEvent(publicClient, eventKey, "rejected");
}

export async function getApprovalForRsvp(
  publicClient: PublicArkivClient,
  rsvpKey: Hex,
): Promise<ArkivResult<Entity | null>> {
  return getDecisionForRsvp(publicClient, rsvpKey, "approved");
}

export async function getRejectionForRsvp(
  publicClient: PublicArkivClient,
  rsvpKey: Hex,
): Promise<ArkivResult<Entity | null>> {
  return getDecisionForRsvp(publicClient, rsvpKey, "rejected");
}
