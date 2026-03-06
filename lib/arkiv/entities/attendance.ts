import { jsonToPayload } from "@arkiv-network/sdk";
import { eq } from "@arkiv-network/sdk/query";
import { ExpirationTime } from "@arkiv-network/sdk/utils";
import type { Account, Chain, Hex, Transport } from "viem";
import type { PublicArkivClient, WalletArkivClient } from "@arkiv-network/sdk";
import { ENTITY_TYPES } from "../constants";
import { assertCallerOwnsHostEvent } from "../ownership";
import type { ArkivResult } from "../types";
import {
  mediaHost,
  normalizeMediaUrl,
  schemaAttributes,
  unixNow,
} from "../v2";

const CONTENT_TYPE = "application/json" as const;

export interface ProofOfAttendance {
  eventKey: string;
  ticketKey: string;
  attendeeWallet: string;
  eventTitle: string;
  checkedInAt: number;
  issuedAt: number;
  poapImageUrl?: string;
  poapAnimationUrl?: string;
  poapTemplateId?: string;
}

async function assertRefs(
  publicClient: PublicArkivClient,
  eventKey: Hex,
  ticketKey: Hex,
  checkinKey: Hex,
  attendeeWallet: Hex,
): Promise<{
  eventTitle: string;
  checkedInAt: number;
  poapImageUrl: string;
  poapAnimationUrl: string;
  poapTemplateId: string;
}> {
  const [event, ticket, checkin] = await Promise.all([
    publicClient.getEntity(eventKey),
    publicClient.getEntity(ticketKey),
    publicClient.getEntity(checkinKey),
  ]);

  const eventType = event.attributes.find((a) => a.key === "type")?.value;
  const ticketType = ticket.attributes.find((a) => a.key === "type")?.value;
  const checkinType = checkin.attributes.find((a) => a.key === "type")?.value;

  if (eventType !== ENTITY_TYPES.HOSTEVENT) throw new Error("Invalid event reference for PoA.");
  if (ticketType !== ENTITY_TYPES.TICKET) throw new Error("Invalid ticket reference for PoAP.");
  if (checkinType !== ENTITY_TYPES.CHECKIN) throw new Error("Invalid checkin reference for PoAP.");

  const ticketEventKey = String(
    ticket.attributes.find((a) => a.key === "eventKey")?.value ?? "",
  ).toLowerCase();
  const checkinEventKey = String(
    checkin.attributes.find((a) => a.key === "eventKey")?.value ?? "",
  ).toLowerCase();
  if (ticketEventKey !== String(eventKey).toLowerCase() || checkinEventKey !== String(eventKey).toLowerCase()) {
    throw new Error("PoA references are inconsistent: event mismatch.");
  }

  const checkinTicketKey = String(
    checkin.attributes.find((a) => a.key === "ticketKey")?.value ?? "",
  ).toLowerCase();
  if (checkinTicketKey !== String(ticketKey).toLowerCase()) {
    throw new Error("PoA references are inconsistent: checkin ticket mismatch.");
  }

  const ticketAttendee = String(
    ticket.attributes.find((a) => a.key === "attendeeWallet")?.value ?? ticket.owner ?? "",
  ).toLowerCase();
  const checkinAttendee = String(
    checkin.attributes.find((a) => a.key === "attendeeWallet")?.value ?? checkin.owner ?? "",
  ).toLowerCase();
  if (
    ticketAttendee !== String(attendeeWallet).toLowerCase() ||
    checkinAttendee !== String(attendeeWallet).toLowerCase()
  ) {
    throw new Error("PoA references are inconsistent: attendee mismatch.");
  }

  const existingPoa = await publicClient
    .buildQuery()
    .where([eq("type", ENTITY_TYPES.PROOF_OF_ATTENDANCE), eq("checkinKey", checkinKey)])
    .withAttributes()
    .fetch();
  if (existingPoa.entities.length > 0) {
    throw new Error("POA already exists for this check-in.");
  }

  const eventPayload = event.toJson() as { title?: string; poapImageUrl?: string; poapAnimationUrl?: string; poapTemplateId?: string; coverImageUrl?: string; imageUrl?: string };
  const eventTitle = String(
    event.attributes.find((a) => a.key === "title")?.value ?? eventPayload.title ?? "",
  );
  const checkedInAt = Number(
    checkin.attributes.find((a) => a.key === "checkedInAt")?.value ?? unixNow(),
  );

  const poapImageUrl = normalizeMediaUrl(
    String(
      event.attributes.find((a) => a.key === "poapImageUrl")?.value ??
      eventPayload.poapImageUrl ??
      event.attributes.find((a) => a.key === "coverImageUrl")?.value ??
      eventPayload.coverImageUrl ??
      eventPayload.imageUrl ??
      "",
    ),
  );
  const poapAnimationUrl = normalizeMediaUrl(
    String(
      event.attributes.find((a) => a.key === "poapAnimationUrl")?.value ??
      eventPayload.poapAnimationUrl ??
      "",
    ),
  );
  const poapTemplateId = String(
    event.attributes.find((a) => a.key === "poapTemplateId")?.value ??
    eventPayload.poapTemplateId ??
    "",
  );

  return { eventTitle, checkedInAt, poapImageUrl, poapAnimationUrl, poapTemplateId };
}

export async function createPoAEntity(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  eventKey: Hex,
  ticketKey: Hex,
  attendeeWallet: Hex,
  checkinKey: Hex,
): Promise<ArkivResult<{ entityKey: Hex; txHash: Hex }>> {
  try {
    await assertCallerOwnsHostEvent(publicClient, eventKey, walletClient.account.address);
    const derived = await assertRefs(publicClient, eventKey, ticketKey, checkinKey, attendeeWallet);

    const issuedAt = unixNow();
    const checkedInAt = derived.checkedInAt;
    const poapImageUrl = derived.poapImageUrl;
    const poapAnimationUrl = derived.poapAnimationUrl;

    const poaData: ProofOfAttendance = {
      eventKey,
      ticketKey: ticketKey,
      attendeeWallet,
      eventTitle: derived.eventTitle,
      checkedInAt,
      issuedAt,
      poapImageUrl,
      poapAnimationUrl,
      poapTemplateId: derived.poapTemplateId,
    };

    const result = await walletClient.createEntity({
      payload: jsonToPayload(poaData),
      contentType: CONTENT_TYPE,
      attributes: [
        { key: "type", value: ENTITY_TYPES.PROOF_OF_ATTENDANCE },
        ...schemaAttributes(),
        { key: "eventKey", value: eventKey },
        { key: "ticketKey", value: ticketKey },
        { key: "attendeeWallet", value: attendeeWallet },
        { key: "checkinKey", value: checkinKey },
        { key: "eventTitle", value: derived.eventTitle },
        { key: "issuedAt", value: issuedAt },
        { key: "checkedInAt", value: checkedInAt },
        { key: "proofVersion", value: "v3" },
        { key: "eventCategory", value: "" },
        { key: "poapImageUrl", value: poapImageUrl },
        { key: "poapAnimationUrl", value: poapAnimationUrl },
        { key: "poapTemplateId", value: derived.poapTemplateId },
        { key: "poapMediaHost", value: mediaHost(poapImageUrl || poapAnimationUrl) },
        { key: "hasPoapImage", value: poapImageUrl ? 1 : 0 },
      ],
      expiresIn: Math.floor(ExpirationTime.fromDays(730)),
    });

    await walletClient.changeOwnership({
      entityKey: result.entityKey as Hex,
      newOwner: attendeeWallet,
    });

    return { success: true, data: result as { entityKey: Hex; txHash: Hex } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
