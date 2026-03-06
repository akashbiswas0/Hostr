import { jsonToPayload } from "@arkiv-network/sdk";
import { eq } from "@arkiv-network/sdk/query";
import type { Entity, PublicArkivClient, WalletArkivClient } from "@arkiv-network/sdk";
import type { Account, Chain, Hex, Transport } from "viem";
import { ExpirationTime } from "@arkiv-network/sdk/utils";
import { ENTITY_TYPES } from "./constants";
import { normalizeText, schemaAttributes, tokenizeSearch, unixNow } from "./v2";

const CONTENT_TYPE = "application/json" as const;

type TokenField = "title" | "description" | "venue" | "tags";

export interface MigrationStats {
  legacyEventsCloned: number;
  legacyRsvpsCloned: number;
  relationsRemapped: number;
  legacyArchived: number;
  tokenEntitiesRebuilt: number;
  notes: string[];
}

function cloneAttrsWithType(
  entity: Entity,
  type: string,
  extra: Array<{ key: string; value: string | number }> = [],
) {
  const attrs = entity.attributes.filter((attr) => attr.key !== "type");
  const hasUpdatedAt = attrs.some((attr) => attr.key === "updatedAt");
  return [
    { key: "type", value: type },
    ...schemaAttributes(),
    ...attrs,
    ...(hasUpdatedAt ? [] : [{ key: "updatedAt", value: unixNow() }]),
    ...extra,
  ];
}

function collectLegacyTokens(payload: {
  title?: string;
  description?: string;
  location?: string;
  category?: string;
}): Array<{ token: string; field: TokenField }> {
  const title = tokenizeSearch(payload.title ?? "").map((token) => ({ token, field: "title" as const }));
  const description = tokenizeSearch(payload.description ?? "").map((token) => ({ token, field: "description" as const }));
  const venue = tokenizeSearch(payload.location ?? "").map((token) => ({ token, field: "venue" as const }));
  const tags = tokenizeSearch(payload.category ?? "").map((token) => ({ token, field: "tags" as const }));
  const dedup = new Map<string, { token: string; field: TokenField }>();
  for (const item of [...title, ...description, ...venue, ...tags]) {
    dedup.set(`${item.field}:${item.token}`, item);
  }
  return Array.from(dedup.values());
}

async function rebuildSearchTokensForHostevent(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  hosteventEntity: Entity,
): Promise<number> {
  const eventKey = hosteventEntity.key as Hex;
  const payload = hosteventEntity.toJson() as {
    title?: string;
    description?: string;
    location?: string;
    category?: string;
    date?: string;
    endDate?: string;
    status?: string;
  };
  const startAt = Number(hosteventEntity.attributes.find((a) => a.key === "startAt")?.value ?? 0);
  const cityNorm = String(hosteventEntity.attributes.find((a) => a.key === "cityNorm")?.value ?? normalizeText(payload.location));
  const status = String(hosteventEntity.attributes.find((a) => a.key === "status")?.value ?? payload.status ?? "upcoming");

  const existing = await publicClient
    .buildQuery()
    .where([eq("type", ENTITY_TYPES.EVENT_SEARCH_TOKEN), eq("eventKey", eventKey)])
    .withAttributes()
    .fetch();

  const tokens = collectLegacyTokens(payload);
  const deletes = existing.entities.map((entity) => ({ entityKey: entity.key as Hex }));
  const creates = tokens.map((token) => ({
    payload: jsonToPayload({ eventKey, token: token.token, field: token.field }),
    contentType: CONTENT_TYPE,
    attributes: [
      { key: "type", value: ENTITY_TYPES.EVENT_SEARCH_TOKEN },
      ...schemaAttributes(),
      { key: "eventKey", value: eventKey },
      { key: "token", value: token.token },
      { key: "field", value: token.field },
      { key: "status", value: status },
      { key: "category", value: payload.category ?? "" },
      { key: "cityNorm", value: cityNorm },
      { key: "startAt", value: startAt },
      { key: "updatedAt", value: unixNow() },
    ],
    expiresIn: Math.floor(ExpirationTime.fromDays(365)),
  }));

  await walletClient.mutateEntities({ deletes, creates });
  return creates.length;
}

export async function migrateLegacyArkivData(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
): Promise<MigrationStats> {
  const stats: MigrationStats = {
    legacyEventsCloned: 0,
    legacyRsvpsCloned: 0,
    relationsRemapped: 0,
    legacyArchived: 0,
    tokenEntitiesRebuilt: 0,
    notes: [],
  };

  const wallet = walletClient.account.address;
  const legacyEvents = await publicClient
    .buildQuery()
    .where([eq("type", "event")])
    .ownedBy(wallet)
    .withPayload()
    .withAttributes()
    .fetch();

  const legacyRsvps = await publicClient
    .buildQuery()
    .where([eq("type", "rsvp")])
    .ownedBy(wallet)
    .withPayload()
    .withAttributes()
    .fetch();

  const eventKeyMap = new Map<string, Hex>();
  const rsvpKeyMap = new Map<string, Hex>();

  for (const legacy of legacyEvents.entities) {
    const already = await publicClient
      .buildQuery()
      .where([
        eq("type", ENTITY_TYPES.HOSTEVENT),
        eq("legacyEventKey", legacy.key as Hex),
      ])
      .withAttributes()
      .fetch();
    if (already.entities[0]) {
      eventKeyMap.set(String(legacy.key).toLowerCase(), already.entities[0].key as Hex);
      continue;
    }

    const res = await walletClient.createEntity({
      payload: legacy.payload ?? jsonToPayload(legacy.toJson()),
      contentType: CONTENT_TYPE,
      attributes: cloneAttrsWithType(legacy, ENTITY_TYPES.HOSTEVENT, [
        { key: "legacyEventKey", value: legacy.key as Hex },
        { key: "updatedAt", value: unixNow() },
      ]),
      expiresIn: Math.floor(ExpirationTime.fromDays(365)),
    });
    eventKeyMap.set(String(legacy.key).toLowerCase(), res.entityKey as Hex);
    stats.legacyEventsCloned += 1;
  }

  for (const legacy of legacyRsvps.entities) {
    const already = await publicClient
      .buildQuery()
      .where([
        eq("type", ENTITY_TYPES.TICKET),
        eq("legacyRsvpKey", legacy.key as Hex),
      ])
      .ownedBy(wallet)
      .withAttributes()
      .fetch();
    if (already.entities[0]) {
      rsvpKeyMap.set(String(legacy.key).toLowerCase(), already.entities[0].key as Hex);
      continue;
    }

    const legacyEventKey = String(legacy.attributes.find((a) => a.key === "eventKey")?.value ?? "").toLowerCase();
    const mappedEventKey = eventKeyMap.get(legacyEventKey);
    const attrs = cloneAttrsWithType(legacy, ENTITY_TYPES.TICKET, [
      { key: "legacyRsvpKey", value: legacy.key as Hex },
      ...(mappedEventKey ? [{ key: "eventKey", value: mappedEventKey }] : []),
      { key: "updatedAt", value: unixNow() },
    ]);

    const res = await walletClient.createEntity({
      payload: legacy.payload ?? jsonToPayload(legacy.toJson()),
      contentType: CONTENT_TYPE,
      attributes: attrs,
      expiresIn: Math.floor(ExpirationTime.fromDays(365)),
    });
    rsvpKeyMap.set(String(legacy.key).toLowerCase(), res.entityKey as Hex);
    stats.legacyRsvpsCloned += 1;
  }

  // Organizer-owned references can be remapped by this wallet.
  for (const [fromEvent, toEvent] of eventKeyMap.entries()) {
    const [decisions, checkins, poas] = await Promise.all([
      publicClient
        .buildQuery()
        .where([eq("type", ENTITY_TYPES.TICKET_DECISION), eq("eventKey", fromEvent as Hex)])
        .ownedBy(wallet)
        .withPayload()
        .withAttributes()
        .fetch(),
      publicClient
        .buildQuery()
        .where([eq("type", ENTITY_TYPES.CHECKIN), eq("eventKey", fromEvent as Hex)])
        .ownedBy(wallet)
        .withPayload()
        .withAttributes()
        .fetch(),
      publicClient
        .buildQuery()
        .where([eq("type", ENTITY_TYPES.PROOF_OF_ATTENDANCE), eq("eventKey", fromEvent as Hex)])
        .ownedBy(wallet)
        .withPayload()
        .withAttributes()
        .fetch(),
    ]);

    const remapEntity = async (entity: Entity) => {
      const attrs = entity.attributes.map((attr) => {
        if (attr.key === "eventKey") return { key: "eventKey", value: toEvent };
        if (attr.key === "ticketKey") {
          const mapped = rsvpKeyMap.get(String(attr.value ?? "").toLowerCase());
          if (mapped) return { key: "ticketKey", value: mapped };
        }
        return attr;
      });
      await walletClient.updateEntity({
        entityKey: entity.key as Hex,
        payload: entity.payload ?? jsonToPayload(entity.toJson()),
        contentType: CONTENT_TYPE,
        attributes: attrs,
        expiresIn: Math.floor(ExpirationTime.fromDays(365)),
      });
      stats.relationsRemapped += 1;
    };

    for (const entity of decisions.entities) await remapEntity(entity);
    for (const entity of checkins.entities) await remapEntity(entity);
    for (const entity of poas.entities) await remapEntity(entity);
  }

  if (legacyEvents.entities.length) {
    for (const entity of legacyEvents.entities) {
      await walletClient.updateEntity({
        entityKey: entity.key as Hex,
        payload: entity.payload ?? jsonToPayload(entity.toJson()),
        contentType: CONTENT_TYPE,
        attributes: cloneAttrsWithType(entity, "event", [
          { key: "legacyArchived", value: 1 },
          { key: "updatedAt", value: unixNow() },
        ]),
        expiresIn: Math.floor(ExpirationTime.fromDays(30)),
      });
    }
    stats.legacyArchived += legacyEvents.entities.length;
  }

  for (const target of eventKeyMap.values()) {
    const hostevent = await publicClient.getEntity(target);
    stats.tokenEntitiesRebuilt += await rebuildSearchTokensForHostevent(walletClient, publicClient, hostevent);
  }

  if (legacyRsvps.entities.length > 0) {
    stats.notes.push(
      "Legacy RSVP entities remain immutable snapshots. Ticket clones are now canonical.",
    );
  }

  return stats;
}
