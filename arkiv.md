# Arkiv SDK — Implemented Features

This document covers every Arkiv SDK feature used in this project, organized by entity type. All on-chain data lives on the **Kaolin testnet** (`chainId: 60138453025`).

---

## Network & Client

| Item | Value |
|---|---|
| Chain | Kaolin testnet |
| Chain ID | `60138453025` |
| RPC URL | `https://kaolin.hoodi.arkiv.network/rpc` |
| SDK package | `@arkiv-network/sdk` |

### Clients (`lib/arkiv/client.ts`)

Two client types are used throughout the app:

**`publicClient`** — read-only, created once at module level, safe for unauthenticated reads.
```ts
createPublicClient({ chain: kaolin, transport: http(rpcUrl) })
```

**`getWalletClient(account, provider)`** — created per-user session after wallet connection, required for all write operations.
```ts
createWalletClient({ chain: kaolin, transport: custom(provider), account })
```

---

## Entity Types

All data is stored as Arkiv **entities**. Each entity has a JSON payload and a set of queryable key-value **attributes**. The four entity types used are:

| Constant | On-chain value |
|---|---|
| `ENTITY_TYPES.EVENT` | `"event"` |
| `ENTITY_TYPES.ORGANIZER_PROFILE` | `"organizer_profile"` |
| `ENTITY_TYPES.RSVP` | `"rsvp"` |
| `ENTITY_TYPES.CHECKIN` | `"checkin"` |

---

## 1. Events (`lib/arkiv/entities/event.ts`)

### Attributes stored on-chain

| Attribute key | Type | Description |
|---|---|---|
| `type` | string | Always `"event"` |
| `title` | string | Event name |
| `status` | string | `draft` / `upcoming` / `live` / `ended` |
| `category` | string | Free-form category label |
| `location` | string | Venue or city |
| `date` | number | Unix timestamp (seconds) — used for range queries |
| `organizer` | string | Wallet address of creator |
| `capacity` | number | Max attendees |
| `rsvpCount` | number | Live counter incremented on each RSVP |

### TypeScript type

```ts
interface Event {
  title: string;
  description: string;
  date: string;        // ISO-8601
  endDate: string;     // ISO-8601
  location: string;
  category: string;
  capacity: number;
  virtualLink?: string;
  status: EventStatus; // "draft" | "upcoming" | "live" | "ended"
}
```

### Write functions

#### `createEventEntity(walletClient, data)`
Creates a new event entity on-chain. Sets all attributes plus an expiry derived from `endDate` (minimum 1 day). `rsvpCount` starts at `0`.

#### `updateEventStatus(walletClient, publicClient, entityKey, newStatus, currentPayload)`
Updates only the `status` attribute and payload. Fetches the current live `rsvpCount` first so it is not reset to zero.

#### `updateEventDetails(walletClient, publicClient, entityKey, updatedData)`
Full event edit — updates payload and all attributes. Also preserves the live `rsvpCount`.

#### `updateRsvpCount(walletClient, publicClient, entityKey, increment: boolean)`
Atomically reads the current `rsvpCount` attribute from the entity, computes `+1` or `-1` (floored at 0), then writes back the updated attributes via `updateEntity`.

#### `deleteEvent(walletClient, publicClient, eventKey)`
Cascade-deletes the event entity **and all associated RSVP entities** in a single `mutateEntities({ deletes: [...] })` call.

### Read functions

#### `getEventByKey(publicClient, entityKey)`
Fetches a single entity by key via `publicClient.getEntity(entityKey)`.

#### `getAllUpcomingEvents(publicClient, filters?)`
Queries all events using the query builder with optional filters:
- `status` (defaults to `"upcoming"`)
- `category` — exact match via `eq()`
- `location` — exact match via `eq()`
- `dateFrom` — lower bound via `gte()`
- `dateTo` — upper bound via `lte()`

Results ordered by `date` ascending (numeric sort).

#### `getEventsByOrganizer(publicClient, walletAddress)`
Queries all events owned by a wallet using `.ownedBy(walletAddress)`, ordered by date ascending.

---

## 2. Organizer Profiles (`lib/arkiv/entities/organizer.ts`)

### Attributes stored on-chain

| Attribute key | Type | Description |
|---|---|---|
| `type` | string | Always `"organizer_profile"` |
| `wallet` | string | Owner wallet address |
| `name` | string | Display name |

The rest of the profile (bio, avatarUrl, website, twitter) lives in the JSON payload.

### TypeScript type

```ts
interface OrganizerProfile {
  name: string;
  bio: string;
  avatarUrl: string;
  website: string;
  twitter: string;
}
```

### Write functions

#### `createOrganizerEntity(walletClient, data)`
Creates a new organizer profile entity. Expires in 365 days (renewed on edit).

#### `updateOrganizerEntity(walletClient, entityKey, data)`
Updates the payload and name attribute of an existing profile. Resets expiry to 365 days.

### Read functions

#### `getOrganizerByWallet(publicClient, walletAddress)`
Queries for `type = "organizer_profile"` owned by the given wallet. Returns the first entity found (or `null`).

---

## 3. RSVPs (`lib/arkiv/entities/rsvp.ts`)

### Attributes stored on-chain

| Attribute key | Type | Description |
|---|---|---|
| `type` | string | Always `"rsvp"` |
| `eventKey` | string | Hex key of the parent event |
| `attendeeWallet` | string | Wallet address of the attendee |
| `status` | string | `confirmed` / `waitlisted` / `checked-in` |

The full RSVP form data (name, email, optional message, checkedIn flag) lives in the payload.

### TypeScript type

```ts
interface RSVP {
  eventKey: string;
  attendeeName: string;
  attendeeEmail: string;
  message?: string;
  checkedIn: boolean;
}

type RSVPStatus = "confirmed" | "waitlisted" | "checked-in";
```

### Write functions

#### `createRsvpEntity(walletClient, data, eventEndDate, initialStatus?)`
Creates an RSVP entity. Expiry is tied to the event's end date (minimum 1 hour). Sets `checkedIn: false` in payload by default.

#### `updateRsvpStatus(walletClient, publicClient, entityKey, status)`
Reads the existing RSVP entity, patches the `status` attribute, updates `checkedIn` in payload (`true` if status is `"checked-in"`), and writes back via `updateEntity`.

#### `deleteRsvp(walletClient, entityKey)`
Deletes a single RSVP entity via `walletClient.deleteEntity({ entityKey })`.

### Read functions

#### `getRsvpsByEvent(publicClient, eventKey)`
Returns all RSVPs for an event by querying `type = "rsvp"` AND `eventKey = <key>`.

#### `getRsvpByAttendee(publicClient, eventKey, attendeeWallet)`
Returns the specific RSVP for one attendee at one event by combining `eq("eventKey", ...)` with `.ownedBy(attendeeWallet)`.

---

## 4. Check-ins (`lib/arkiv/entities/checkin.ts`)

A separate entity that acts as an immutable on-chain receipt when an organizer marks an attendee as checked in. Distinct from the RSVP status so check-in history is preserved even if the RSVP is cancelled.

### Attributes stored on-chain

| Attribute key | Type | Description |
|---|---|---|
| `type` | string | Always `"checkin"` |
| `eventKey` | string | Hex key of the event |
| `attendeeWallet` | string | Wallet address of the checked-in attendee |

Payload contains `{ eventKey, attendeeWallet, checkedInAt }` (Unix timestamp in seconds).

### Write functions

#### `createCheckinEntity(walletClient, eventKey, attendeeWallet, eventEndDate)`
Creates the on-chain check-in receipt. Expiry tied to event's end date (minimum 1 hour).

### Read functions

#### `getCheckinsByEvent(publicClient, eventKey)`
Returns all check-in entities for a given event.

#### `hasAttendeeCheckedIn(publicClient, eventKey, attendeeWallet)`
Returns `true`/`false` — queries `type = "checkin"` AND `eventKey` AND `attendeeWallet`, checks if any entity exists.

---

## SDK Primitives Used

### `walletClient.createEntity({ payload, contentType, attributes, expiresIn })`
Creates a new entity on-chain. Returns `{ entityKey, txHash }`.

### `walletClient.updateEntity({ entityKey, payload, contentType, attributes, expiresIn })`
Replaces payload and attributes of an existing entity. Caller must own the entity.

### `walletClient.deleteEntity({ entityKey })`
Deletes a single entity. Caller must own the entity.

### `walletClient.mutateEntities({ deletes: [...] })`
Batch-deletes multiple entities in one transaction. Used in `deleteEvent` to cascade-delete all RSVPs.

### `publicClient.getEntity(entityKey)`
Fetches a single entity by its hex key.

### `publicClient.buildQuery()`
Fluent query builder. All query results include entities with `.key`, `.attributes`, `.toJson()`, and `.payload`.

| Builder method | Description |
|---|---|
| `.where([predicates])` | Filter by attribute values |
| `.ownedBy(walletAddress)` | Filter to entities owned by a specific wallet |
| `.withPayload()` | Include the JSON payload in results |
| `.withAttributes()` | Include key-value attributes in results |
| `.orderBy(key, type, direction)` | Sort by an attribute (`"number"` type for numeric sort) |
| `.fetch()` | Execute — returns `{ entities: Entity[] }` |

### Query predicates (`@arkiv-network/sdk/query`)

| Predicate | Usage |
|---|---|
| `eq(key, value)` | Exact equality |
| `gte(key, value)` | Greater than or equal (numeric) |
| `lte(key, value)` | Less than or equal (numeric) |

### `ExpirationTime` (`@arkiv-network/sdk/utils`)

| Method | Description |
|---|---|
| `ExpirationTime.fromHours(n)` | Seconds representing n hours from now |
| `ExpirationTime.fromDays(n)` | Seconds representing n days from now |
| `ExpirationTime.fromDate(date)` | Seconds until a specific Date |

### `jsonToPayload(data)` (`@arkiv-network/sdk`)
Serializes a plain JS object into the binary payload format expected by `createEntity` / `updateEntity`.

---

## Expiry Strategy

| Entity | Expiry |
|---|---|
| Event | Until `endDate` (min 1 day) |
| Organizer profile | 365 days, renewed on each edit |
| RSVP | Until event `endDate` (min 1 hour) |
| Check-in | Until event `endDate` (min 1 hour) |

Expiry is computed server-side at write time using `ExpirationTime.fromDate(new Date(endDate))`, clamped to a minimum so entities remain queryable for a short grace period after the event ends.
