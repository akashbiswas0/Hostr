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
  const event = await publicClient.getEntity(eventKey);
  const eventType = event.attributes.find((a) => a.key === "type")?.value;
  if (eventType !== ENTITY_TYPES.HOSTEVENT) {
    throw new Error("Invalid event reference for check-in.");
  }

  const ticket = await publicClient.getEntity(ticketKey);
  const ticketType = ticket.attributes.find((a) => a.key === "type")?.value;
  if (ticketType !== ENTITY_TYPES.TICKET) {
    throw new Error("Invalid ticket reference for check-in.");
  }

  const ticketEventKey = String(
    ticket.attributes.find((a) => a.key === "eventKey")?.value ?? "",
  ).toLowerCase();
  if (ticketEventKey !== String(eventKey).toLowerCase()) {
    throw new Error("Ticket does not belong to this hostevent.");
  }

  const ticketAttendee = String(
    ticket.attributes.find((a) => a.key === "attendeeWallet")?.value ?? ticket.owner ?? "",
  ).toLowerCase();
  if (ticketAttendee !== String(attendeeWallet).toLowerCase()) {
    throw new Error("Ticket attendeeWallet does not match check-in attendee.");
  }

  const ticketStatus = String(
    ticket.attributes.find((a) => a.key === "status")?.value ?? "pending",
  );
  if (ticketStatus !== "confirmed" && ticketStatus !== "checked-in") {
    throw new Error("Only confirmed tickets can be checked in.");
  }

  const existing = await publicClient
    .buildQuery()
    .where([eq("type", ENTITY_TYPES.CHECKIN), eq("ticketKey", ticketKey)])
    .withAttributes()
    .fetch();
  if (existing.entities.length > 0) {
    throw new Error("Check-in already exists for this ticket.");
  }

  return {
    eventEndAt: Number(event.attributes.find((a) => a.key === "endAt")?.value ?? 0),
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
    await assertCallerOwnsHostEvent(publicClient, eventKey, walletClient.account.address);
    const refs = await assertRefs(publicClient, eventKey, ticketKey, attendeeWallet);

    const checkedInAt = unixNow();
    const effectiveEndDate =
      refs.eventEndAt > 0 ? refs.eventEndAt : eventEndDate;

    const checkinData = {
      eventKey,
      attendeeWallet,
      ticketKey,
      checkedInAt,
      checkinMethod: method,
      checkinGate: "default",
    };

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
      expiresIn: expiresInFromEventEnd(effectiveEndDate),
    });

    const ticketAttrs = refs.ticket.attributes.map((attr) => {
      if (attr.key === "status") return { key: "status", value: "checked-in" };
      if (attr.key === "lastActionAt") return { key: "lastActionAt", value: checkedInAt };
      return attr;
    });
    if (!ticketAttrs.some((attr) => attr.key === "lastActionAt")) {
      ticketAttrs.push({ key: "lastActionAt", value: checkedInAt });
    }
    await walletClient.updateEntity({
      entityKey: ticketKey,
      payload: refs.ticket.payload ?? jsonToPayload(refs.ticket.toJson()),
      contentType: CONTENT_TYPE,
      attributes: ticketAttrs,
      expiresIn: expiresInFromEventEnd(effectiveEndDate),
    });

    return { success: true, data: result as { entityKey: Hex; txHash: Hex } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
