import { jsonToPayload } from "@arkiv-network/sdk";
import { eq, gte } from "@arkiv-network/sdk/query";
import { ExpirationTime } from "@arkiv-network/sdk/utils";
import type { PublicArkivClient, WalletArkivClient } from "@arkiv-network/sdk";
import type { Account, Chain, Hex, Transport } from "viem";
import { ENTITY_TYPES } from "../constants";
import { assertCallerOwnsHostEvent } from "../ownership";
import type { ArkivResult, Event, EventStatus, TicketDecision, TicketStatus } from "../types";
import { normalizeEventFontPreset, normalizeEventThemeId } from "../../eventAppearance";
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

function normalizeEventPayload(data: Event): Event {
  const themeId = normalizeEventThemeId(data.themeId);
  const fontPreset = normalizeEventFontPreset(data.fontPreset);
  return {
    ...data,
    themeId,
    fontPreset,
    coverImageUrl: normalizeMediaUrl(data.coverImageUrl ?? data.imageUrl),
    posterImageUrl: normalizeMediaUrl(data.posterImageUrl ?? data.imageUrl),
    thumbnailImageUrl: normalizeMediaUrl(data.thumbnailImageUrl ?? data.imageUrl),
    poapImageUrl: normalizeMediaUrl(data.poapImageUrl ?? data.coverImageUrl ?? data.imageUrl),
    poapAnimationUrl: normalizeMediaUrl(data.poapAnimationUrl),
    poapTemplateId: (data.poapTemplateId ?? "").trim(),
  };
}

function eventAttributes(
  ownerWallet: Hex,
  data: Event,
  counts: { confirmed: number; pending: number; waitlisted: number },
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
  const requiresRsvp = boolToNumber(Boolean(data.requiresRsvp));
  const coverImageUrl = normalizeMediaUrl(data.coverImageUrl ?? data.imageUrl);
  const posterImageUrl = normalizeMediaUrl(data.posterImageUrl ?? data.imageUrl);
  const thumbnailImageUrl = normalizeMediaUrl(data.thumbnailImageUrl ?? data.imageUrl);
  const poapImageUrl = normalizeMediaUrl(data.poapImageUrl ?? coverImageUrl);
  const poapAnimationUrl = normalizeMediaUrl(data.poapAnimationUrl);
  const poapTemplateId = (data.poapTemplateId ?? "").trim();
  const themeId = normalizeEventThemeId(data.themeId);
  const fontPreset = normalizeEventFontPreset(data.fontPreset);

  return [
    { key: "type", value: ENTITY_TYPES.HOSTEVENT },
    ...schemaAttributes(),
    { key: "slug", value: slugify(data.title) },
    { key: "title", value: data.title },
    { key: "titleNorm", value: normalizeText(data.title) },
    { key: "status", value: data.status },
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
    { key: "organizerWallet", value: ownerWallet },
    { key: "organizer", value: ownerWallet },
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
    { key: "themeId", value: themeId },
    { key: "fontPreset", value: fontPreset },
    { key: "coverImageUrl", value: coverImageUrl },
    { key: "posterImageUrl", value: posterImageUrl },
    { key: "thumbnailImageUrl", value: thumbnailImageUrl },
    { key: "mediaHost", value: mediaHost(coverImageUrl) },
    { key: "hasImage", value: coverImageUrl ? 1 : 0 },
    { key: "poapImageUrl", value: poapImageUrl },
    { key: "poapAnimationUrl", value: poapAnimationUrl },
    { key: "poapTemplateId", value: poapTemplateId },
    { key: "createdAt", value: createdAt },
    { key: "updatedAt", value: unixNow() },
  ];
}

function collectTokensByField(data: Event): Array<{ field: "title" | "description" | "venue" | "tags"; token: string }> {
  const titleTokens = tokenizeSearch(data.title).map((token) => ({ field: "title" as const, token }));
  const descTokens = tokenizeSearch(data.description).map((token) => ({ field: "description" as const, token }));
  const venueTokens = tokenizeSearch(data.location).map((token) => ({ field: "venue" as const, token }));
  const tagTokens = tokenizeSearch(data.category).map((token) => ({ field: "tags" as const, token }));
  const dedup = new Map<string, { field: "title" | "description" | "venue" | "tags"; token: string }>();

  for (const item of [...titleTokens, ...descTokens, ...venueTokens, ...tagTokens]) {
    dedup.set(`${item.field}:${item.token}`, item);
  }
  return Array.from(dedup.values());
}

async function replaceEventSearchTokens(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  eventKey: Hex,
  data: Event,
): Promise<void> {
  const existing = await publicClient
    .buildQuery()
    .where([eq("type", ENTITY_TYPES.EVENT_SEARCH_TOKEN), eq("eventKey", eventKey)])
    .withAttributes()
    .fetch();

  if (existing.entities.length) {
    await walletClient.mutateEntities({
      deletes: existing.entities.map((entity) => ({ entityKey: entity.key as Hex })),
    });
  }

  const tokens = collectTokensByField(data);
  if (!tokens.length) return;
  const startAt = toUnixSeconds(data.date);
  const cityNorm = normalizeText(data.location);

  await walletClient.mutateEntities({
    creates: tokens.map((token) => ({
      payload: jsonToPayload({ token: token.token, eventKey, field: token.field }),
      contentType: CONTENT_TYPE,
      attributes: [
        { key: "type", value: ENTITY_TYPES.EVENT_SEARCH_TOKEN },
        ...schemaAttributes(),
        { key: "eventKey", value: eventKey },
        { key: "token", value: token.token },
        { key: "field", value: token.field },
        { key: "status", value: data.status },
        { key: "category", value: data.category },
        { key: "cityNorm", value: cityNorm },
        { key: "startAt", value: startAt },
      ],
      expiresIn: secondsUntil(data.endDate),
    })),
  });
}

async function assertOrganizerProfileReference(
  publicClient: PublicArkivClient,
  organizerKey: Hex | undefined,
): Promise<void> {
  if (!organizerKey) return;
  const organizer = await publicClient.getEntity(organizerKey);
  const type = organizer.attributes.find((a) => a.key === "type")?.value;
  if (type !== ENTITY_TYPES.ORGANIZER_PROFILE) {
    throw new Error("Invalid organizer profile reference for hostevent.");
  }
}

async function fetchGraphForCounts(publicClient: PublicArkivClient, eventKey: Hex) {
  const [tickets, decisions, checkins] = await Promise.all([
    publicClient
      .buildQuery()
      .where([eq("type", ENTITY_TYPES.TICKET), eq("eventKey", eventKey)])
      .withAttributes()
      .fetch(),
    publicClient
      .buildQuery()
      .where([eq("type", ENTITY_TYPES.TICKET_DECISION), eq("eventKey", eventKey)])
      .withAttributes()
      .fetch(),
    publicClient
      .buildQuery()
      .where([eq("type", ENTITY_TYPES.CHECKIN), eq("eventKey", eventKey)])
      .withAttributes()
      .fetch(),
  ]);
  return { tickets: tickets.entities, decisions: decisions.entities, checkins: checkins.entities };
}

function computeTicketCounts(
  tickets: Array<{ key: unknown; attributes: Array<{ key: string; value: unknown }> }>,
  decisions: Array<{ attributes: Array<{ key: string; value: unknown }> }>,
): { confirmed: number; pending: number; waitlisted: number } {
  const decisionByTicket = new Map<string, TicketDecision>();
  for (const decision of decisions) {
    const ticketKey = String(
      decision.attributes.find((a) => a.key === "ticketKey")?.value ?? "",
    ).toLowerCase();
    const value = String(
      decision.attributes.find((a) => a.key === "decision")?.value ?? "",
    ) as TicketDecision;
    if (ticketKey && (value === "approved" || value === "rejected")) {
      decisionByTicket.set(ticketKey, value);
    }
  }

  let confirmed = 0;
  let pending = 0;
  let waitlisted = 0;

  for (const ticket of tickets) {
    const status = String(
      ticket.attributes.find((a) => a.key === "status")?.value ?? "pending",
    ) as TicketStatus;
    const ticketKey = String(ticket.key).toLowerCase();
    const decision = decisionByTicket.get(ticketKey);

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

function velocityBucket(score: number): "cold" | "warm" | "hot" {
  if (score >= 15) return "hot";
  if (score >= 5) return "warm";
  return "cold";
}

async function replaceDerivedFlags(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  eventKey: Hex,
  eventData: Event,
  counts: { confirmed: number; pending: number; waitlisted: number },
  tickets: Array<{ attributes: Array<{ key: string; value: unknown }> }>,
  checkins: Array<{ attributes: Array<{ key: string; value: unknown }> }>,
): Promise<void> {
  const [capacityFlags, trendingFlags] = await Promise.all([
    publicClient
      .buildQuery()
      .where([eq("type", ENTITY_TYPES.EVENT_CAPACITY_FLAG), eq("eventKey", eventKey)])
      .withAttributes()
      .fetch(),
    publicClient
      .buildQuery()
      .where([eq("type", ENTITY_TYPES.EVENT_TRENDING_FLAG), eq("eventKey", eventKey)])
      .withAttributes()
      .fetch(),
  ]);

  const now = unixNow();
  const since24h = now - 86_400;
  const capacityTotal = Math.max(0, Number(eventData.capacity ?? 0));
  const seatsRemaining = Math.max(0, capacityTotal - counts.confirmed);
  const isSoldOut = capacityTotal > 0 && seatsRemaining === 0 ? 1 : 0;
  const newTickets24h = tickets.filter((ticket) => {
    const requestedAt = Number(ticket.attributes.find((a) => a.key === "requestedAt")?.value ?? 0);
    return requestedAt >= since24h;
  }).length;
  const checkins24h = checkins.filter((checkin) => {
    const checkedInAt = Number(checkin.attributes.find((a) => a.key === "checkedInAt")?.value ?? 0);
    return checkedInAt >= since24h;
  }).length;
  const score24h = newTickets24h * 2 + checkins24h * 3;

  const deletes = [
    ...capacityFlags.entities.map((entity) => ({ entityKey: entity.key as Hex })),
    ...trendingFlags.entities.map((entity) => ({ entityKey: entity.key as Hex })),
  ];

  const expiresIn = secondsUntil(eventData.endDate);
  const creates = [
    {
      payload: jsonToPayload({ eventKey, seatsRemaining, isSoldOut, counts }),
      contentType: CONTENT_TYPE,
      attributes: [
        { key: "type", value: ENTITY_TYPES.EVENT_CAPACITY_FLAG },
        ...schemaAttributes(),
        { key: "eventKey", value: eventKey },
        { key: "seatsRemaining", value: seatsRemaining },
        { key: "isSoldOut", value: isSoldOut },
        { key: "confirmedCount", value: counts.confirmed },
        { key: "waitlistedCount", value: counts.waitlisted },
        { key: "updatedAt", value: now },
      ],
      expiresIn,
    },
    {
      payload: jsonToPayload({ eventKey, score24h, newTickets24h, checkins24h }),
      contentType: CONTENT_TYPE,
      attributes: [
        { key: "type", value: ENTITY_TYPES.EVENT_TRENDING_FLAG },
        ...schemaAttributes(),
        { key: "eventKey", value: eventKey },
        { key: "score24h", value: score24h },
        { key: "newTickets24h", value: newTickets24h },
        { key: "checkins24h", value: checkins24h },
        { key: "velocityBucket", value: velocityBucket(score24h) },
        { key: "updatedAt", value: now },
      ],
      expiresIn,
    },
  ];

  await walletClient.mutateEntities({ deletes, creates });
}

function assertHostEventTransition(current: EventStatus, next: EventStatus): void {
  const map: Record<EventStatus, EventStatus[]> = {
    draft: ["upcoming", "archived"],
    upcoming: ["live", "ended", "archived"],
    live: ["ended", "archived"],
    ended: ["archived"],
    archived: [],
  };
  const allowed = map[current] ?? [];
  if (!allowed.includes(next)) {
    throw new Error(`Invalid hostevent status transition: ${current} -> ${next}`);
  }
}

async function updateHostEventWithCounts(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  entityKey: Hex,
  payload: Event,
  createdAt: number,
  organizerKey?: Hex,
  organizerName?: string,
): Promise<Hex> {
  const graph = await fetchGraphForCounts(publicClient, entityKey);
  const counts = computeTicketCounts(graph.tickets, graph.decisions);
  const normalized = normalizeEventPayload(payload);

  const updateResult = await walletClient.updateEntity({
    entityKey,
    payload: jsonToPayload(normalized),
    contentType: CONTENT_TYPE,
    attributes: eventAttributes(
      walletClient.account.address,
      normalized,
      counts,
      createdAt,
      organizerKey,
      organizerName,
    ),
    expiresIn: secondsUntil(normalized.endDate),
  });

  await Promise.all([
    replaceEventSearchTokens(walletClient, publicClient, entityKey, normalized),
    replaceDerivedFlags(walletClient, publicClient, entityKey, normalized, counts, graph.tickets, graph.checkins),
  ]);
  return updateResult.txHash as Hex;
}

export async function createHostEventEntity(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  data: Event,
  organizerKey?: Hex,
  organizerName?: string,
): Promise<ArkivResult<{ entityKey: Hex; txHash: Hex }>> {
  try {
    await assertOrganizerProfileReference(publicClient, organizerKey);
    const normalized = normalizeEventPayload(data);
    const createdAt = unixNow();
    const counts = { confirmed: 0, pending: 0, waitlisted: 0 };

    const result = await walletClient.createEntity({
      payload: jsonToPayload(normalized),
      contentType: CONTENT_TYPE,
      attributes: eventAttributes(
        walletClient.account.address,
        normalized,
        counts,
        createdAt,
        organizerKey,
        organizerName,
      ),
      expiresIn: secondsUntil(normalized.endDate),
    });

    const eventKey = result.entityKey as Hex;
    await Promise.all([
      replaceEventSearchTokens(walletClient, publicClient, eventKey, normalized),
      replaceDerivedFlags(walletClient, publicClient, eventKey, normalized, counts, [], []),
    ]);

    return { success: true, data: result as { entityKey: Hex; txHash: Hex } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function updateHostEventStatus(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  entityKey: Hex,
  newStatus: EventStatus,
  currentPayload: Event,
): Promise<ArkivResult<{ entityKey: Hex; txHash: Hex }>> {
  try {
    await assertCallerOwnsHostEvent(publicClient, entityKey, walletClient.account.address);
    const entity = await publicClient.getEntity(entityKey);
    const currentStatus = String(
      entity.attributes.find((a) => a.key === "status")?.value ?? currentPayload.status,
    ) as EventStatus;
    assertHostEventTransition(currentStatus, newStatus);

    const organizerKey = entity.attributes.find((a) => a.key === "organizerKey")?.value as Hex | undefined;
    const organizerName = entity.attributes.find((a) => a.key === "organizerName")?.value as string | undefined;
    const createdAt = Number(entity.attributes.find((a) => a.key === "createdAt")?.value ?? unixNow());

    const txHash = await updateHostEventWithCounts(
      walletClient,
      publicClient,
      entityKey,
      { ...currentPayload, status: newStatus },
      createdAt,
      organizerKey,
      organizerName,
    );

    return {
      success: true,
      data: { entityKey, txHash },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function updateHostEventDetails(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  entityKey: Hex,
  data: Event,
): Promise<ArkivResult<{ entityKey: Hex; txHash: Hex }>> {
  try {
    await assertCallerOwnsHostEvent(publicClient, entityKey, walletClient.account.address);
    const entity = await publicClient.getEntity(entityKey);
    const organizerKey = entity.attributes.find((a) => a.key === "organizerKey")?.value as Hex | undefined;
    const organizerName = entity.attributes.find((a) => a.key === "organizerName")?.value as string | undefined;
    const createdAt = Number(entity.attributes.find((a) => a.key === "createdAt")?.value ?? unixNow());

    const txHash = await updateHostEventWithCounts(
      walletClient,
      publicClient,
      entityKey,
      data,
      createdAt,
      organizerKey,
      organizerName,
    );

    return {
      success: true,
      data: { entityKey, txHash },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function archiveHostEvent(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  eventKey: Hex,
): Promise<ArkivResult<{ entityKey: Hex; txHash: Hex }>> {
  try {
    await assertCallerOwnsHostEvent(publicClient, eventKey, walletClient.account.address);
    const entity = await publicClient.getEntity(eventKey);
    const payload = entity.toJson() as Event;
    const status = String(
      entity.attributes.find((a) => a.key === "status")?.value ?? payload.status,
    ) as EventStatus;
    if (status !== "archived") {
      assertHostEventTransition(status, "archived");
    }

    const result = await updateHostEventStatus(
      walletClient,
      publicClient,
      eventKey,
      "archived",
      {
        ...payload,
        status: "archived",
        visibility: "unlisted",
      },
    );
    if (!result.success) throw new Error(result.error);
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function purgeHostEventIfNoTickets(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  eventKey: Hex,
): Promise<ArkivResult<{ txHash: Hex; deletedCount: number }>> {
  try {
    await assertCallerOwnsHostEvent(publicClient, eventKey, walletClient.account.address);

    const ticketResult = await publicClient
      .buildQuery()
      .where([eq("type", ENTITY_TYPES.TICKET), eq("eventKey", eventKey)])
      .withAttributes()
      .fetch();
    if (ticketResult.entities.length > 0) {
      throw new Error("Purge blocked: attendee-owned tickets still exist for this hostevent.");
    }

    const [decisionResult, checkinResult, poaResult, tokenResult, capacityFlags, trendingFlags] =
      await Promise.all([
        publicClient
          .buildQuery()
          .where([eq("type", ENTITY_TYPES.TICKET_DECISION), eq("eventKey", eventKey)])
          .withAttributes()
          .fetch(),
        publicClient
          .buildQuery()
          .where([eq("type", ENTITY_TYPES.CHECKIN), eq("eventKey", eventKey)])
          .withAttributes()
          .fetch(),
        publicClient
          .buildQuery()
          .where([eq("type", ENTITY_TYPES.PROOF_OF_ATTENDANCE), eq("eventKey", eventKey)])
          .withAttributes()
          .fetch(),
        publicClient
          .buildQuery()
          .where([eq("type", ENTITY_TYPES.EVENT_SEARCH_TOKEN), eq("eventKey", eventKey)])
          .withAttributes()
          .fetch(),
        publicClient
          .buildQuery()
          .where([eq("type", ENTITY_TYPES.EVENT_CAPACITY_FLAG), eq("eventKey", eventKey)])
          .withAttributes()
          .fetch(),
        publicClient
          .buildQuery()
          .where([eq("type", ENTITY_TYPES.EVENT_TRENDING_FLAG), eq("eventKey", eventKey)])
          .withAttributes()
          .fetch(),
      ]);

    const deletes = [
      { entityKey: eventKey },
      ...decisionResult.entities.map((e) => ({ entityKey: e.key as Hex })),
      ...checkinResult.entities.map((e) => ({ entityKey: e.key as Hex })),
      ...poaResult.entities.map((e) => ({ entityKey: e.key as Hex })),
      ...tokenResult.entities.map((e) => ({ entityKey: e.key as Hex })),
      ...capacityFlags.entities.map((e) => ({ entityKey: e.key as Hex })),
      ...trendingFlags.entities.map((e) => ({ entityKey: e.key as Hex })),
    ];

    const result = await walletClient.mutateEntities({ deletes });
    return {
      success: true,
      data: { txHash: result.txHash as Hex, deletedCount: deletes.length },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function reconcileHostEventIntegrity(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  eventKey: Hex,
): Promise<ArkivResult<{ repaired: boolean }>> {
  try {
    await assertCallerOwnsHostEvent(publicClient, eventKey, walletClient.account.address);
    const entity = await publicClient.getEntity(eventKey);
    const payload = entity.toJson() as Event;
    const organizerKey = entity.attributes.find((a) => a.key === "organizerKey")?.value as Hex | undefined;
    const organizerName = entity.attributes.find((a) => a.key === "organizerName")?.value as string | undefined;
    const createdAt = Number(entity.attributes.find((a) => a.key === "createdAt")?.value ?? unixNow());
    const currentStatus = String(
      entity.attributes.find((a) => a.key === "status")?.value ?? payload.status,
    ) as EventStatus;

    const nextPayload = { ...payload, status: currentStatus };
    if (currentStatus !== "archived" && currentStatus !== "draft") {
      const endAt = Number(entity.attributes.find((a) => a.key === "endAt")?.value ?? toUnixSeconds(payload.endDate));
      if (endAt > 0 && endAt < unixNow()) {
        nextPayload.status = "ended";
      }
    }

    await updateHostEventWithCounts(
      walletClient,
      publicClient,
      eventKey,
      nextPayload,
      createdAt,
      organizerKey,
      organizerName,
    );
    return { success: true, data: { repaired: true } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function autoTransitionEndedHostEvents(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  walletAddress: Hex,
): Promise<ArkivResult<{ transitioned: number }>> {
  try {
    const result = await publicClient
      .buildQuery()
      .where([eq("type", ENTITY_TYPES.HOSTEVENT)])
      .ownedBy(walletAddress)
      .withPayload()
      .withAttributes()
      .fetch();

    const now = unixNow();
    let transitioned = 0;
    for (const entity of result.entities) {
      const payload = entity.toJson() as Event;
      const status = String(
        entity.attributes.find((a) => a.key === "status")?.value ?? payload.status,
      ) as EventStatus;
      if (status === "ended" || status === "draft" || status === "archived") continue;

      const endAt = Number(
        entity.attributes.find((a) => a.key === "endAt")?.value ?? toUnixSeconds(payload.endDate),
      );
      if (endAt > 0 && endAt < now) {
        const res = await updateHostEventStatus(
          walletClient,
          publicClient,
          entity.key as Hex,
          "ended",
          { ...payload, status: "ended" },
        );
        if (!res.success) throw new Error(res.error);
        transitioned += 1;
      }
    }

    return { success: true, data: { transitioned } };
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
    await assertCallerOwnsHostEvent(publicClient, eventKey, walletClient.account.address);
    const entity = await publicClient.getEntity(eventKey);
    const payload = entity.toJson() as Event;
    const status = String(
      entity.attributes.find((a) => a.key === "status")?.value ?? payload.status,
    ) as EventStatus;
    if (status === "draft" || status === "archived" || status === "ended") {
      return { success: true, data: { promoted: false } };
    }

    const capacityTotal = Number(
      entity.attributes.find((a) => a.key === "capacityTotal")?.value ??
        entity.attributes.find((a) => a.key === "capacity")?.value ??
        0,
    );
    if (capacityTotal <= 0) return { success: true, data: { promoted: false } };

    const ticketResult = await publicClient
      .buildQuery()
      .where([eq("type", ENTITY_TYPES.TICKET), eq("eventKey", eventKey)])
      .withAttributes()
      .fetch();
    const confirmed = ticketResult.entities.filter((ticket) => {
      const ticketStatus = String(ticket.attributes.find((a) => a.key === "status")?.value ?? "");
      return ticketStatus === "confirmed" || ticketStatus === "checked-in";
    }).length;
    const target: EventStatus = confirmed >= capacityTotal ? "live" : "upcoming";
    if (target === status) return { success: true, data: { promoted: false } };

    const res = await updateHostEventStatus(
      walletClient,
      publicClient,
      eventKey,
      target,
      { ...payload, status: target },
    );
    if (!res.success) throw new Error(res.error);
    return { success: true, data: { promoted: true } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function getRecentCheckinsForTrending(
  publicClient: PublicArkivClient,
  eventKey: Hex,
): Promise<number> {
  const since = unixNow() - 86_400;
  const result = await publicClient
    .buildQuery()
    .where([
      eq("type", ENTITY_TYPES.CHECKIN),
      eq("eventKey", eventKey),
      gte("checkedInAt", since),
    ])
    .withAttributes()
    .fetch();
  return result.entities.length;
}
