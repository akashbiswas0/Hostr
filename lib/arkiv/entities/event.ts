import { jsonToPayload } from "@arkiv-network/sdk";
import { eq } from "@arkiv-network/sdk/query";
import { ExpirationTime } from "@arkiv-network/sdk/utils";
import type { Account, Chain, Hex, Transport } from "viem";
import type {
  PublicArkivClient,
  WalletArkivClient,
} from "@arkiv-network/sdk";
import { ENTITY_TYPES } from "../constants";
import type {
  ArkivResult,
  Event,
  EventStatus,
  RsvpDecision,
  RSVPStatus,
} from "../types";
import {
  boolToNumber,
  ensureEvenSeconds,
  mediaHost,
  normalizeMediaUrl,
  normalizeText,
  schemaAttributes,
  slugify,
  tokenizeSearch,
  toUnixSeconds,
  unixNow,
} from "../v2";

const CONTENT_TYPE = "application/json" as const;
const MIN_EXPIRY_SECONDS = ExpirationTime.fromDays(1);

function secondsUntil(isoDate: string): number {
  const diffMs = new Date(isoDate).getTime() - Date.now();
  const gracePeriod = ExpirationTime.fromDays(30);
  const seconds = Math.floor(
    Math.max(diffMs / 1_000 + gracePeriod, MIN_EXPIRY_SECONDS),
  );
  return ensureEvenSeconds(seconds);
}

function computeFormat(data: Event): "in_person" | "online" | "hybrid" {
  if (data.format) return data.format;
  const hasLocation = Boolean(data.location?.trim());
  const hasVirtual = Boolean(data.virtualLink?.trim());
  if (hasLocation && hasVirtual) return "hybrid";
  if (hasVirtual) return "online";
  return "in_person";
}

function computePriceTier(data: Event): "free" | "paid" | "donation" {
  if (data.priceTier) return data.priceTier;
  if ((data.priceMin ?? 0) > 0 || (data.priceMax ?? 0) > 0) return "paid";
  return "free";
}

function eventAttributes(
  walletAddress: Hex,
  data: Event,
  counts: {
    confirmed: number;
    pending: number;
    waitlisted: number;
  },
  createdAt: number,
  organizerKey?: Hex,
  organizerName?: string,
): Array<{ key: string; value: string | number }> {
  const startAt = toUnixSeconds(data.date);
  const endAt = toUnixSeconds(data.endDate);
  const format = computeFormat(data);
  const priceTier = computePriceTier(data);
  const capacityTotal = Math.max(0, Number(data.capacity ?? 0));
  const seatsRemaining = Math.max(0, capacityTotal - counts.confirmed);
  const isSoldOut = capacityTotal > 0 && seatsRemaining === 0 ? 1 : 0;

  const coverImageUrl = normalizeMediaUrl(data.coverImageUrl ?? data.imageUrl);
  const posterImageUrl = normalizeMediaUrl(data.posterImageUrl ?? data.imageUrl);
  const thumbnailImageUrl = normalizeMediaUrl(
    data.thumbnailImageUrl ?? data.imageUrl,
  );

  const status = data.status ?? "upcoming";
  const requiresRsvp = boolToNumber(Boolean(data.requiresRsvp));

  return [
    { key: "type", value: ENTITY_TYPES.EVENT },
    ...schemaAttributes(),
    { key: "slug", value: slugify(data.title) },
    { key: "title", value: data.title },
    { key: "titleNorm", value: normalizeText(data.title) },
    { key: "status", value: status },
    { key: "visibility", value: data.visibility ?? "public" },
    { key: "category", value: data.category },
    { key: "subCategory", value: "" },
    { key: "language", value: normalizeText(data.language) },
    { key: "location", value: data.location },
    { key: "cityNorm", value: normalizeText(data.location) },
    { key: "countryCode", value: "" },
    { key: "regionNorm", value: "" },
    { key: "venueNorm", value: normalizeText(data.location) },
    { key: "format", value: format },
    { key: "isOnline", value: format === "online" ? 1 : 0 },
    { key: "approvalMode", value: requiresRsvp ? "manual" : "auto" },
    { key: "requiresRsvp", value: requiresRsvp },
    { key: "startAt", value: startAt },
    { key: "endAt", value: endAt },
    { key: "date", value: startAt },
    { key: "startDay", value: new Date(startAt * 1_000).getUTCDate() },
    { key: "startMonth", value: new Date(startAt * 1_000).getUTCMonth() + 1 },
    { key: "dayOfWeek", value: new Date(startAt * 1_000).getUTCDay() },
    { key: "durationMinutes", value: Math.max(0, Math.floor((endAt - startAt) / 60)) },
    { key: "timezone", value: "UTC" },
    { key: "organizerWallet", value: walletAddress },
    { key: "organizer", value: walletAddress },
    { key: "organizerKey", value: organizerKey ?? "" },
    { key: "organizerName", value: organizerName ?? "" },
    { key: "capacityTotal", value: capacityTotal },
    { key: "capacity", value: capacityTotal },
    { key: "rsvpConfirmedCount", value: counts.confirmed },
    { key: "rsvpPendingCount", value: counts.pending },
    { key: "rsvpWaitlistCount", value: counts.waitlisted },
    { key: "rsvpCount", value: counts.confirmed },
    { key: "seatsRemaining", value: seatsRemaining },
    { key: "isSoldOut", value: isSoldOut },
    { key: "priceTier", value: priceTier },
    { key: "priceMin", value: Math.max(0, Number(data.priceMin ?? 0)) },
    { key: "priceMax", value: Math.max(0, Number(data.priceMax ?? 0)) },
    { key: "currency", value: (data.currency ?? "").toUpperCase() },
    { key: "audienceLevel", value: data.audienceLevel ?? "all" },
    { key: "coverImageUrl", value: coverImageUrl },
    { key: "posterImageUrl", value: posterImageUrl },
    { key: "thumbnailImageUrl", value: thumbnailImageUrl },
    { key: "mediaHost", value: mediaHost(coverImageUrl) },
    { key: "hasImage", value: coverImageUrl ? 1 : 0 },
    { key: "createdAt", value: createdAt },
    { key: "updatedAt", value: unixNow() },
  ];
}

function normalizeEventPayload(data: Event): Event {
  return {
    ...data,
    coverImageUrl: normalizeMediaUrl(data.coverImageUrl ?? data.imageUrl),
    posterImageUrl: normalizeMediaUrl(data.posterImageUrl ?? data.imageUrl),
    thumbnailImageUrl: normalizeMediaUrl(data.thumbnailImageUrl ?? data.imageUrl),
  };
}

function collectSearchTokens(data: Event): string[] {
  const source = [
    data.title,
    data.description,
    data.location,
    data.category,
  ]
    .filter(Boolean)
    .join(" ");
  return tokenizeSearch(source);
}

async function replaceEventSearchTokens(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  eventKey: Hex,
  data: Event,
): Promise<void> {
  const existing = await publicClient
    .buildQuery()
    .where([
      eq("type", ENTITY_TYPES.EVENT_SEARCH_TOKEN),
      eq("eventKey", eventKey),
    ])
    .withAttributes()
    .fetch();

  if (existing.entities.length > 0) {
    await walletClient.mutateEntities({
      deletes: existing.entities.map((entity) => ({ entityKey: entity.key as Hex })),
    });
  }

  const tokens = collectSearchTokens(data);
  if (tokens.length === 0) return;

  const startAt = toUnixSeconds(data.date);
  const cityNorm = normalizeText(data.location);

  const creates = tokens.map((token) => ({
    payload: jsonToPayload({ token, eventKey }),
    contentType: CONTENT_TYPE,
    attributes: [
      { key: "type", value: ENTITY_TYPES.EVENT_SEARCH_TOKEN },
      ...schemaAttributes(),
      { key: "eventKey", value: eventKey },
      { key: "token", value: token },
      { key: "field", value: "tags" },
      { key: "status", value: data.status },
      { key: "category", value: data.category },
      { key: "cityNorm", value: cityNorm },
      { key: "startAt", value: startAt },
    ],
    expiresIn: secondsUntil(data.endDate),
  }));

  await walletClient.mutateEntities({ creates });
}

async function assertOrganizerProfileReference(
  publicClient: PublicArkivClient,
  organizerKey: Hex | undefined,
): Promise<void> {
  if (!organizerKey) return;
  const organizer = await publicClient.getEntity(organizerKey);
  const type = organizer.attributes.find((a) => a.key === "type")?.value;
  if (type !== ENTITY_TYPES.ORGANIZER_PROFILE) {
    throw new Error("Invalid organizer profile reference for event.");
  }
}

async function computeRsvpCounts(
  publicClient: PublicArkivClient,
  eventKey: Hex,
): Promise<{ confirmed: number; pending: number; waitlisted: number }> {
  const [rsvps, decisions] = await Promise.all([
    publicClient
      .buildQuery()
      .where([
        eq("type", ENTITY_TYPES.RSVP),
        eq("eventKey", eventKey),
      ])
      .withAttributes()
      .fetch(),
    publicClient
      .buildQuery()
      .where([
        eq("type", ENTITY_TYPES.RSVP_DECISION),
        eq("eventKey", eventKey),
      ])
      .withAttributes()
      .fetch(),
  ]);

  const decisionByRsvp = new Map<string, RsvpDecision>();
  for (const decision of decisions.entities) {
    const rsvpKey = String(
      decision.attributes.find((a) => a.key === "rsvpKey")?.value ?? "",
    ).toLowerCase();
    const value = String(
      decision.attributes.find((a) => a.key === "decision")?.value ?? "",
    ) as RsvpDecision;
    if (rsvpKey && (value === "approved" || value === "rejected")) {
      decisionByRsvp.set(rsvpKey, value);
    }
  }

  let confirmed = 0;
  let pending = 0;
  let waitlisted = 0;

  for (const rsvp of rsvps.entities) {
    const status = String(
      rsvp.attributes.find((a) => a.key === "status")?.value ?? "pending",
    ) as RSVPStatus;
    const rsvpKey = String(rsvp.key).toLowerCase();
    const decision = decisionByRsvp.get(rsvpKey);

    if (status === "not-going") continue;
    if (status === "waitlisted") {
      waitlisted += 1;
      continue;
    }
    if (status === "checked-in" || status === "confirmed") {
      confirmed += 1;
      continue;
    }

    if (status === "pending") {
      if (decision === "approved") confirmed += 1;
      else if (decision !== "rejected") pending += 1;
    }
  }

  return { confirmed, pending, waitlisted };
}

export async function createEventEntity(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  data: Event,
  organizerKey?: Hex,
  organizerName?: string,
): Promise<ArkivResult<{ entityKey: Hex; txHash: Hex }>> {
  try {
    await assertOrganizerProfileReference(publicClient, organizerKey);

    const normalizedPayload = normalizeEventPayload(data);
    const counts = { confirmed: 0, pending: 0, waitlisted: 0 };
    const createdAt = unixNow();

    const result = await walletClient.createEntity({
      payload: jsonToPayload(normalizedPayload),
      contentType: CONTENT_TYPE,
      attributes: eventAttributes(
        walletClient.account.address,
        normalizedPayload,
        counts,
        createdAt,
        organizerKey,
        organizerName,
      ),
      expiresIn: secondsUntil(data.endDate),
    });

    await replaceEventSearchTokens(
      walletClient,
      publicClient,
      result.entityKey as Hex,
      normalizedPayload,
    );

    return { success: true, data: result as { entityKey: Hex; txHash: Hex } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function updateEventStatus(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  entityKey: Hex,
  newStatus: EventStatus,
  currentPayload: Event,
): Promise<ArkivResult<{ entityKey: Hex; txHash: Hex }>> {
  try {
    const entity = await publicClient.getEntity(entityKey);
    const existingOrgKey = entity.attributes.find((a) => a.key === "organizerKey")
      ?.value as Hex | undefined;
    const existingOrgName = entity.attributes.find((a) => a.key === "organizerName")
      ?.value as string | undefined;
    const createdAt = Number(
      entity.attributes.find((a) => a.key === "createdAt")?.value ?? unixNow(),
    );

    const normalizedPayload = normalizeEventPayload({
      ...currentPayload,
      status: newStatus,
    });

    const counts = await computeRsvpCounts(publicClient, entityKey);

    const result = await walletClient.updateEntity({
      entityKey,
      payload: jsonToPayload(normalizedPayload),
      contentType: CONTENT_TYPE,
      attributes: eventAttributes(
        walletClient.account.address,
        normalizedPayload,
        counts,
        createdAt,
        existingOrgKey,
        existingOrgName,
      ),
      expiresIn: secondsUntil(normalizedPayload.endDate),
    });

    await replaceEventSearchTokens(
      walletClient,
      publicClient,
      entityKey,
      normalizedPayload,
    );

    return { success: true, data: result as { entityKey: Hex; txHash: Hex } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function updateEventDetails(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  entityKey: Hex,
  updatedData: Event,
): Promise<ArkivResult<{ entityKey: Hex; txHash: Hex }>> {
  try {
    const entity = await publicClient.getEntity(entityKey);
    const existingOrgKey = entity.attributes.find((a) => a.key === "organizerKey")
      ?.value as Hex | undefined;
    const existingOrgName = entity.attributes.find((a) => a.key === "organizerName")
      ?.value as string | undefined;
    const createdAt = Number(
      entity.attributes.find((a) => a.key === "createdAt")?.value ?? unixNow(),
    );

    const normalizedPayload = normalizeEventPayload(updatedData);
    const counts = await computeRsvpCounts(publicClient, entityKey);

    const result = await walletClient.updateEntity({
      entityKey,
      payload: jsonToPayload(normalizedPayload),
      contentType: CONTENT_TYPE,
      attributes: eventAttributes(
        walletClient.account.address,
        normalizedPayload,
        counts,
        createdAt,
        existingOrgKey,
        existingOrgName,
      ),
      expiresIn: secondsUntil(normalizedPayload.endDate),
    });

    await replaceEventSearchTokens(
      walletClient,
      publicClient,
      entityKey,
      normalizedPayload,
    );

    return { success: true, data: result as { entityKey: Hex; txHash: Hex } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function updateRsvpCount(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  entityKey: Hex,
  _increment: boolean,
): Promise<ArkivResult<{ entityKey: Hex; txHash: Hex }>> {
  try {
    const entity = await publicClient.getEntity(entityKey);
    const eventData = entity.toJson() as Event;
    const counts = await computeRsvpCounts(publicClient, entityKey);

    const organizerKey = entity.attributes.find((a) => a.key === "organizerKey")
      ?.value as Hex | undefined;
    const organizerName = entity.attributes.find((a) => a.key === "organizerName")
      ?.value as string | undefined;
    const createdAt = Number(
      entity.attributes.find((a) => a.key === "createdAt")?.value ?? unixNow(),
    );

    const attrs = eventAttributes(
      walletClient.account.address,
      normalizeEventPayload(eventData),
      counts,
      createdAt,
      organizerKey,
      organizerName,
    );

    const result = await walletClient.updateEntity({
      entityKey,
      payload: entity.payload ?? jsonToPayload(eventData),
      contentType: CONTENT_TYPE,
      attributes: attrs,
      expiresIn: secondsUntil(eventData.endDate),
    });

    return { success: true, data: result as { entityKey: Hex; txHash: Hex } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function deleteEvent(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  eventKey: Hex,
): Promise<ArkivResult<{ txHash: Hex; deletedCount: number }>> {
  try {
    const [decisionResult, checkinResult, poaResult, tokenResult] =
      await Promise.all([
        publicClient
          .buildQuery()
          .where([
            eq("type", ENTITY_TYPES.RSVP_DECISION),
            eq("eventKey", eventKey),
          ])
          .withAttributes()
          .fetch(),
        publicClient
          .buildQuery()
          .where([
            eq("type", ENTITY_TYPES.CHECKIN),
            eq("eventKey", eventKey),
          ])
          .withAttributes()
          .fetch(),
        publicClient
          .buildQuery()
          .where([
            eq("type", ENTITY_TYPES.PROOF_OF_ATTENDANCE),
            eq("eventKey", eventKey),
          ])
          .withAttributes()
          .fetch(),
        publicClient
          .buildQuery()
          .where([
            eq("type", ENTITY_TYPES.EVENT_SEARCH_TOKEN),
            eq("eventKey", eventKey),
          ])
          .withAttributes()
          .fetch(),
      ]);

    const deletes = [
      { entityKey: eventKey },
      ...decisionResult.entities.map((e) => ({ entityKey: e.key as Hex })),
      ...checkinResult.entities.map((e) => ({ entityKey: e.key as Hex })),
      ...poaResult.entities.map((e) => ({ entityKey: e.key as Hex })),
      ...tokenResult.entities.map((e) => ({ entityKey: e.key as Hex })),
    ];

    const result = await walletClient.mutateEntities({ deletes });

    return {
      success: true,
      data: {
        txHash: result.txHash as Hex,
        deletedCount: deletes.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function autoTransitionEndedEvents(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  walletAddress: Hex,
): Promise<ArkivResult<{ transitioned: number }>> {
  try {
    const nowSeconds = unixNow();

    const result = await publicClient
      .buildQuery()
      .where([eq("type", ENTITY_TYPES.EVENT)])
      .ownedBy(walletAddress)
      .withPayload()
      .withAttributes()
      .fetch();

    const toEnd = result.entities.filter((entity) => {
      const data = entity.toJson() as Event;
      const status = String(
        entity.attributes.find((a) => a.key === "status")?.value ?? data.status,
      );
      if (status === "ended" || status === "draft") return false;

      const endAt = Number(
        entity.attributes.find((a) => a.key === "endAt")?.value ??
          toUnixSeconds(data.endDate),
      );

      return endAt > 0 && endAt < nowSeconds;
    });

    if (toEnd.length === 0) return { success: true, data: { transitioned: 0 } };

    for (const entity of toEnd) {
      const data = entity.toJson() as Event;
      const update = await updateEventStatus(
        walletClient,
        publicClient,
        entity.key as Hex,
        "ended",
        { ...data, status: "ended" },
      );
      if (!update.success) throw new Error(update.error);
    }

    return { success: true, data: { transitioned: toEnd.length } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function autoPromoteCapacityStatus(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  eventKey: Hex,
): Promise<ArkivResult<{ promoted: boolean }>> {
  try {
    const entity = await publicClient.getEntity(eventKey);
    const data = entity.toJson() as Event;

    const capacityTotal = Number(
      entity.attributes.find((a) => a.key === "capacityTotal")?.value ??
        entity.attributes.find((a) => a.key === "capacity")?.value ??
        0,
    );

    if (capacityTotal === 0) return { success: true, data: { promoted: false } };

    const counts = await computeRsvpCounts(publicClient, eventKey);
    const newStatus: EventStatus =
      counts.confirmed >= capacityTotal ? "live" : "upcoming";

    const currentStatus = String(
      entity.attributes.find((a) => a.key === "status")?.value ?? data.status,
    );

    if (
      currentStatus === newStatus ||
      currentStatus === "ended" ||
      currentStatus === "draft"
    ) {
      return { success: true, data: { promoted: false } };
    }

    const result = await updateEventStatus(
      walletClient,
      publicClient,
      eventKey,
      newStatus,
      { ...data, status: newStatus },
    );

    if (!result.success) throw new Error(result.error);
    return { success: true, data: { promoted: true } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
