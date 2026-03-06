import { jsonToPayload } from "@arkiv-network/sdk";
import { eq } from "@arkiv-network/sdk/query";
import { ExpirationTime } from "@arkiv-network/sdk/utils";
import type { Account, Chain, Hex, Transport } from "viem";
import type { PublicArkivClient, WalletArkivClient } from "@arkiv-network/sdk";
import { ENTITY_TYPES } from "../constants";
import { assertCallerOwnsHostEvent } from "../ownership";
import type { ArkivResult } from "../types";
import { ensureEvenSeconds, schemaAttributes, unixNow } from "../v2";

const CONTENT_TYPE = "application/json" as const;
const CHECKIN_ENTITY_DEBUG_PREFIX = "[checkin-entity]";
const RETRYABLE_TXPOOL_PATTERNS: RegExp[] = [
  /txpool/i,
  /nonce too low/i,
  /already known/i,
  /replacement transaction underpriced/i,
  /transaction underpriced/i,
  /rate limit/i,
  /timeout|timed? ?out/i,
];

function toErrorLog(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return {
    type: typeof error,
    value: String(error ?? ""),
    raw: error,
  };
}

function isRetryableTxPoolError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return RETRYABLE_TXPOOL_PATTERNS.some((pattern) => pattern.test(message));
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function expiresInFromEventEnd(eventEndDate: number): number {
  const secondsFromNow = eventEndDate - unixNow();
  const gracePeriod = ExpirationTime.fromDays(2);
  const seconds = Math.floor(
    Math.max(secondsFromNow + gracePeriod, ExpirationTime.fromHours(1)),
  );
  return ensureEvenSeconds(seconds);
}

async function assertRefs(
  publicClient: PublicArkivClient,
  eventKey: Hex,
  ticketKey: Hex,
  attendeeWallet: Hex,
): Promise<{ eventEndAt: number; ticket: import("@arkiv-network/sdk").Entity }> {
  console.info(`${CHECKIN_ENTITY_DEBUG_PREFIX} assertRefs:start`, {
    eventKey,
    ticketKey,
    attendeeWallet,
  });

  const event = await publicClient.getEntity(eventKey);
  const eventType = event.attributes.find((a) => a.key === "type")?.value;
  console.info(`${CHECKIN_ENTITY_DEBUG_PREFIX} assertRefs:event-loaded`, {
    eventKey,
    eventType,
    eventOwner: event.owner,
  });
  if (eventType !== ENTITY_TYPES.HOSTEVENT) {
    console.error(`${CHECKIN_ENTITY_DEBUG_PREFIX} assertRefs:event-type-invalid`, {
      expected: ENTITY_TYPES.HOSTEVENT,
      actual: eventType,
      eventKey,
    });
    throw new Error("Invalid event reference for check-in.");
  }

  const ticket = await publicClient.getEntity(ticketKey);
  const ticketType = ticket.attributes.find((a) => a.key === "type")?.value;
  console.info(`${CHECKIN_ENTITY_DEBUG_PREFIX} assertRefs:ticket-loaded`, {
    ticketKey,
    ticketType,
    ticketOwner: ticket.owner,
    ticketAttrCount: ticket.attributes.length,
  });
  if (ticketType !== ENTITY_TYPES.TICKET) {
    console.error(`${CHECKIN_ENTITY_DEBUG_PREFIX} assertRefs:ticket-type-invalid`, {
      expected: ENTITY_TYPES.TICKET,
      actual: ticketType,
      ticketKey,
    });
    throw new Error("Invalid ticket reference for check-in.");
  }

  const ticketEventKey = String(
    ticket.attributes.find((a) => a.key === "eventKey")?.value ?? "",
  ).toLowerCase();
  if (ticketEventKey !== String(eventKey).toLowerCase()) {
    console.error(`${CHECKIN_ENTITY_DEBUG_PREFIX} assertRefs:event-mismatch`, {
      ticketEventKey,
      expectedEventKey: String(eventKey).toLowerCase(),
      ticketKey,
    });
    throw new Error("Ticket does not belong to this hostevent.");
  }

  const ticketAttendee = String(
    ticket.attributes.find((a) => a.key === "attendeeWallet")?.value ?? ticket.owner ?? "",
  ).toLowerCase();
  if (ticketAttendee !== String(attendeeWallet).toLowerCase()) {
    console.error(`${CHECKIN_ENTITY_DEBUG_PREFIX} assertRefs:attendee-mismatch`, {
      ticketAttendee,
      expectedAttendee: String(attendeeWallet).toLowerCase(),
      ticketKey,
    });
    throw new Error("Ticket attendeeWallet does not match check-in attendee.");
  }

  const ticketStatus = String(
    ticket.attributes.find((a) => a.key === "status")?.value ?? "pending",
  ).toLowerCase();
  console.info(`${CHECKIN_ENTITY_DEBUG_PREFIX} assertRefs:status-evaluated`, {
    ticketKey,
    ticketStatus,
  });
  const statusAllowsCheckin = ticketStatus === "confirmed" || ticketStatus === "checked-in";
  if (!statusAllowsCheckin) {
    if (ticketStatus !== "pending") {
      console.error(`${CHECKIN_ENTITY_DEBUG_PREFIX} assertRefs:status-blocked`, {
        ticketKey,
        ticketStatus,
      });
      throw new Error("Only confirmed tickets can be checked in.");
    }

    const latestDecisionResult = await publicClient
      .buildQuery()
      .where([eq("type", ENTITY_TYPES.TICKET_DECISION), eq("ticketKey", ticketKey)])
      .withAttributes()
      .orderBy("decidedAt", "number", "desc")
      .fetch();
    const latestDecision = String(
      latestDecisionResult.entities[0]?.attributes.find((a) => a.key === "decision")?.value ?? "",
    ).toLowerCase();
    console.info(`${CHECKIN_ENTITY_DEBUG_PREFIX} assertRefs:decision-evaluated`, {
      ticketKey,
      decisionEntityCount: latestDecisionResult.entities.length,
      latestDecision,
      latestDecisionEntityKey: latestDecisionResult.entities[0]?.key,
    });
    if (latestDecision !== "approved") {
      console.error(`${CHECKIN_ENTITY_DEBUG_PREFIX} assertRefs:decision-blocked`, {
        ticketKey,
        latestDecision,
      });
      throw new Error("Only confirmed tickets can be checked in.");
    }
  }

  const existing = await publicClient
    .buildQuery()
    .where([eq("type", ENTITY_TYPES.CHECKIN), eq("ticketKey", ticketKey)])
    .withAttributes()
    .fetch();
  console.info(`${CHECKIN_ENTITY_DEBUG_PREFIX} assertRefs:existing-checkins`, {
    ticketKey,
    existingCount: existing.entities.length,
    existingEntityKeys: existing.entities.map((entity) => entity.key),
  });
  if (existing.entities.length > 0) {
    console.error(`${CHECKIN_ENTITY_DEBUG_PREFIX} assertRefs:duplicate-checkin-blocked`, {
      ticketKey,
    });
    throw new Error("Check-in already exists for this ticket.");
  }

  const eventEndAt = Number(event.attributes.find((a) => a.key === "endAt")?.value ?? 0);
  console.info(`${CHECKIN_ENTITY_DEBUG_PREFIX} assertRefs:passed`, {
    ticketKey,
    eventKey,
    eventEndAt,
  });
  return {
    eventEndAt,
    ticket,
  };
}

export async function createCheckinEntity(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  eventKey: Hex,
  attendeeWallet: Hex,
  eventEndDate: number,
  ticketKey: Hex,
  method: "qr" | "manual" = "manual",
): Promise<ArkivResult<{ entityKey: Hex; txHash: Hex }>> {
  try {
    console.info(`${CHECKIN_ENTITY_DEBUG_PREFIX} createCheckinEntity:start`, {
      eventKey,
      attendeeWallet,
      eventEndDate,
      ticketKey,
      method,
      callerWallet: walletClient.account.address,
    });
    await assertCallerOwnsHostEvent(publicClient, eventKey, walletClient.account.address);
    console.info(`${CHECKIN_ENTITY_DEBUG_PREFIX} createCheckinEntity:host-ownership-verified`, {
      eventKey,
      callerWallet: walletClient.account.address,
    });
    const refs = await assertRefs(publicClient, eventKey, ticketKey, attendeeWallet);
    console.info(`${CHECKIN_ENTITY_DEBUG_PREFIX} createCheckinEntity:refs-validated`, {
      eventKey,
      ticketKey,
      eventEndAt: refs.eventEndAt,
    });

    const checkedInAt = unixNow();
    const effectiveEndDate =
      refs.eventEndAt > 0 ? refs.eventEndAt : eventEndDate;
    const checkinExpiresIn = expiresInFromEventEnd(effectiveEndDate);
    console.info(`${CHECKIN_ENTITY_DEBUG_PREFIX} createCheckinEntity:timestamps-computed`, {
      checkedInAt,
      effectiveEndDate,
      checkinExpiresIn,
    });

    const checkinData = {
      eventKey,
      attendeeWallet,
      ticketKey,
      checkedInAt,
      checkinMethod: method,
      checkinGate: "default",
    };
    console.info(`${CHECKIN_ENTITY_DEBUG_PREFIX} createCheckinEntity:creating-checkin-entity`, {
      checkinData,
    });

    const result = await walletClient.createEntity({
      payload: jsonToPayload(checkinData),
      contentType: CONTENT_TYPE,
      attributes: [
        { key: "type", value: ENTITY_TYPES.CHECKIN },
        ...schemaAttributes(),
        { key: "eventKey", value: eventKey },
        { key: "attendeeWallet", value: attendeeWallet },
        { key: "ticketKey", value: ticketKey },
        { key: "checkedInAt", value: checkedInAt },
        { key: "checkinMethod", value: method },
        { key: "checkinGate", value: "default" },
      ],
      expiresIn: checkinExpiresIn,
    });
    console.info(`${CHECKIN_ENTITY_DEBUG_PREFIX} createCheckinEntity:checkin-created`, {
      entityKey: (result as { entityKey?: Hex }).entityKey,
      txHash: (result as { txHash?: Hex }).txHash,
    });

    const ticketAttrs = refs.ticket.attributes.map((attr) => {
      if (attr.key === "status") return { key: "status", value: "checked-in" };
      if (attr.key === "lastActionAt") return { key: "lastActionAt", value: checkedInAt };
      return attr;
    });
    if (!ticketAttrs.some((attr) => attr.key === "status")) {
      ticketAttrs.push({ key: "status", value: "checked-in" });
    }
    if (!ticketAttrs.some((attr) => attr.key === "lastActionAt")) {
      ticketAttrs.push({ key: "lastActionAt", value: checkedInAt });
    }
    const ticketUpdateExpiresIn = expiresInFromEventEnd(effectiveEndDate);
    console.info(`${CHECKIN_ENTITY_DEBUG_PREFIX} createCheckinEntity:updating-ticket-status:start`, {
      ticketKey,
      statusAttrPresent: ticketAttrs.some((attr) => attr.key === "status"),
      lastActionAtAttrPresent: ticketAttrs.some((attr) => attr.key === "lastActionAt"),
      attributeCount: ticketAttrs.length,
      ticketUpdateExpiresIn,
    });
    const retryDelaysMs = [0, 1_200, 2_500];
    let updateSucceeded = false;
    let updateAttempt = 0;
    let lastUpdateError: unknown = null;
    for (let i = 0; i < retryDelaysMs.length; i += 1) {
      updateAttempt = i + 1;
      if (retryDelaysMs[i] > 0) {
        await sleep(retryDelaysMs[i]);
      }
      try {
        await walletClient.updateEntity({
          entityKey: ticketKey,
          payload: refs.ticket.payload ?? jsonToPayload(refs.ticket.toJson()),
          contentType: CONTENT_TYPE,
          attributes: ticketAttrs,
          expiresIn: ticketUpdateExpiresIn,
        });
        updateSucceeded = true;
        console.info(`${CHECKIN_ENTITY_DEBUG_PREFIX} createCheckinEntity:ticket-updated`, {
          ticketKey,
          status: "checked-in",
          checkedInAt,
          attempt: updateAttempt,
        });
        break;
      } catch (updateError) {
        lastUpdateError = updateError;
        const retryable = isRetryableTxPoolError(updateError);
        console.warn(`${CHECKIN_ENTITY_DEBUG_PREFIX} createCheckinEntity:ticket-update-attempt-failed`, {
          ticketKey,
          attempt: updateAttempt,
          retryable,
          error: toErrorLog(updateError),
        });
        if (!retryable) break;
      }
    }

    if (!updateSucceeded) {
      console.warn(`${CHECKIN_ENTITY_DEBUG_PREFIX} createCheckinEntity:ticket-update-skipped-non-fatal`, {
        ticketKey,
        attempts: updateAttempt,
        reason: "secondary ticket status write failed after retries",
        lastError: toErrorLog(lastUpdateError),
      });
    }

    console.info(`${CHECKIN_ENTITY_DEBUG_PREFIX} createCheckinEntity:success`, {
      eventKey,
      ticketKey,
      attendeeWallet,
      ticketStatusUpdated: updateSucceeded,
    });
    return { success: true, data: result as { entityKey: Hex; txHash: Hex } };
  } catch (error) {
    console.error(`${CHECKIN_ENTITY_DEBUG_PREFIX} createCheckinEntity:failed`, {
      context: {
        eventKey,
        attendeeWallet,
        eventEndDate,
        ticketKey,
        method,
        callerWallet: walletClient.account.address,
      },
      error: toErrorLog(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
