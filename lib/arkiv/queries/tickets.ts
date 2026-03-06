import { eq } from "@arkiv-network/sdk/query";
import type { Entity, PublicArkivClient } from "@arkiv-network/sdk";
import type { Hex } from "viem";
import { ENTITY_TYPES } from "../constants";
import type { ArkivResult, TicketDecision, TicketStatus } from "../types";

export async function getTicketsByEvent(
  publicClient: PublicArkivClient,
  eventKey: Hex,
): Promise<ArkivResult<Entity[]>> {
  try {
    const result = await publicClient
      .buildQuery()
      .where([eq("type", ENTITY_TYPES.TICKET), eq("eventKey", eventKey)])
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

export async function getTicketsByEventAndStatus(
  publicClient: PublicArkivClient,
  eventKey: Hex,
  status: TicketStatus,
): Promise<ArkivResult<Entity[]>> {
  try {
    const result = await publicClient
      .buildQuery()
      .where([
        eq("type", ENTITY_TYPES.TICKET),
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

export async function getTicketByAttendee(
  publicClient: PublicArkivClient,
  eventKey: Hex,
  attendeeWallet: Hex,
): Promise<ArkivResult<Entity | null>> {
  try {
    const result = await publicClient
      .buildQuery()
      .where([eq("type", ENTITY_TYPES.TICKET), eq("eventKey", eventKey)])
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
  decision?: TicketDecision,
): Promise<ArkivResult<Entity[]>> {
  try {
    const result = await publicClient
      .buildQuery()
      .where([
        eq("type", ENTITY_TYPES.TICKET_DECISION),
        eq("eventKey", eventKey),
        ...(decision ? [eq("decision", decision)] : []),
      ])
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

export async function getDecisionForTicket(
  publicClient: PublicArkivClient,
  ticketKey: Hex,
  decision?: TicketDecision,
): Promise<ArkivResult<Entity | null>> {
  try {
    const result = await publicClient
      .buildQuery()
      .where([
        eq("type", ENTITY_TYPES.TICKET_DECISION),
        eq("ticketKey", ticketKey),
        ...(decision ? [eq("decision", decision)] : []),
      ])
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

export async function getApprovalForTicket(
  publicClient: PublicArkivClient,
  ticketKey: Hex,
): Promise<ArkivResult<Entity | null>> {
  return getDecisionForTicket(publicClient, ticketKey, "approved");
}

export async function getRejectionForTicket(
  publicClient: PublicArkivClient,
  ticketKey: Hex,
): Promise<ArkivResult<Entity | null>> {
  return getDecisionForTicket(publicClient, ticketKey, "rejected");
}
