# OnChain Events

A fully on-chain event management platform built on **Arkiv** (Kaolin testnet).
Create events, collect RSVPs, manage attendees, and record check-ins — all stored verifiably on-chain with no backend or traditional database.

> **Try it live**: [http://localhost:3000](http://localhost:3000) after running `npm run dev`.

---

## What It Does

**For attendees (no wallet needed to browse):**
- Browse and search upcoming events with 5+ filter dimensions
- View full event detail pages — capacity, organizer profile, attendee list
- Connect wallet and RSVP (confirmed or waitlisted if at capacity)
- See your RSVPs on `/my-rsvps`, including your waitlist position (#)
- Cancel your own RSVP at any time (data deleted on-chain)

**For organizers (wallet-gated):**
- Create an on-chain organizer profile (one per wallet)
- Create events with a 3-step form — publish immediately or save as draft
- Manage event lifecycle: `draft → upcoming → live → ended`
- View the full attendee + waitlist list, export CSV
- Check in attendees with a single click (recorded as a separate proof-of-attendance entity)
- Edit event details at any time (all writes go on-chain)

---

## Architecture Overview

```
app/                   Next.js 15 App Router pages
├── page.tsx           Public browse + search + filter (5 filter dimensions)
├── events/[key]/      Event detail + RSVP modal (confirmed / waitlisted)
├── my-rsvps/          Attendee RSVP list with waitlist position + cancel
├── organizers/[wallet]/  Public organizer profile + their events
└── organizer/         Wallet-gated organizer flows
    ├── onboard/       Create on-chain organizer profile
    ├── dashboard/     Manage events tabbed by status + auto-transitions
    └── events/[key]/
        ├── edit/      Edit event details on-chain
        └── attendees/ Check-in management + CSV export

components/            Shared UI components
hooks/                 React TanStack Query wrappers around Arkiv functions
lib/arkiv/             All Arkiv SDK integration — zero UI dependencies
  client.ts            publicClient + getWalletClient factory
  constants.ts         Entity type strings, ExpirationTime helpers
  types.ts             TypeScript interfaces for all 4 entity schemas
  entities/
    organizer.ts       create / update / getByWallet
    event.ts           create / updateStatus / updateDetails / delete (cascade)
    rsvp.ts            create / delete / getRsvpsByEvent / promoteWaitlisted
    checkin.ts         create / getByEvent / hasAttendeeCheckedIn
```

---

## Arkiv Integration

### Entity Schema — 4 Distinct Types

| Entity type | Key queryable attributes | Payload fields | Expiry |
|---|---|---|---|
| `organizer_profile` | `type`, `wallet`, `name` | name, bio, avatarUrl, website, twitter | 365 days |
| `event` | `type`, `title`, `status`, `category`, `location`, `date` (unix), `organizer` (wallet), `organizerKey` (entity ref), `organizerName`, `capacity`, `rsvpCount` | all event fields | Until event `endDate`, min 1 day |
| `rsvp` | `type`, `eventKey`, `attendeeWallet`, `status` | attendeeName, attendeeEmail, message, checkedIn | Mirrors parent event `endDate` |
| `checkin` | `type`, `eventKey`, `attendeeWallet` | eventKey, attendeeWallet, checkedInAt | Mirrors parent event `endDate` |

### Ownership Model — End-User Wallets Own Everything

All writes use the **end-user's wallet** via `getWalletClient(wagmiAccount)` — no server-side signing key exists.

| Entity | Owner | Can edit/delete |
|---|---|---|
| Organizer profile | Organizer wallet | Only the organizer |
| Event | Organizer wallet | Only the event creator |
| RSVP | **Attendee wallet** | Only the attendee (they can cancel) |
| Checkin | Organizer wallet | Only the event organizer |

### Entity Relationships

```
organizer_profile (owner: organizerWallet)
    └── event (attr: organizer=wallet, organizerKey=entityRef, organizerName, owner: organizerWallet)
            ├── rsvp    (attr: eventKey→event.key, attendeeWallet, owner: attendeeWallet)
            └── checkin (attr: eventKey→event.key, attendeeWallet, owner: organizerWallet)
```

- **`organizerKey`** — a proper entity reference attribute on every event, pointing to the `organizer_profile` entity key. Enables cross-entity navigation without additional wallet lookups.
- **`organizerName`** — cached on the event entity at creation time so event cards can display the organizer's name without an extra query.
- **Cascade delete** — `deleteEvent()` batch-deletes the event and all child RSVPs atomically in one `mutateEntities({ deletes: [...] })` transaction.
- **Check-in cross-reference** — check-in status is derived from the `checkin` entity (3-predicate query), so organizers never need to mutate the attendee-owned RSVP.

### Query Usage — 6 Server-Side Predicates + `orderBy`

```typescript
// Browse page — up to 6 server-side predicates, ordered by numeric date attribute
buildQuery()
  .where([
    eq("type", "event"),
    eq("status", "upcoming"),      // status filter
    eq("category", "DeFi"),        // category filter
    eq("location", "Berlin"),      // location filter
    gte("date", fromUnixSeconds),  // date range start
    lte("date", toUnixSeconds),    // date range end
  ])
  .withPayload()
  .withAttributes()
  .orderBy("date", "number", "asc")
  .fetch()
```

Additional queries used throughout the app:
- `getOrganizerByWallet` — single wallet → organizer profile
- `getEventsByOrganizer` — wallet-owned events
- `getRsvpsByEvent` — all RSVPs for an event (also used for waitlist position)
- `getRsvpByAttendee` — did this wallet RSVP?
- `getCheckinsByEvent` / `hasAttendeeCheckedIn` — proof-of-attendance
- `getWaitlistedRsvpsByEvent` — waitlist ordering

### Differentiated Expiration

| Entity | Expiry logic | Rationale |
|---|---|---|
| Organizer profile | `ExpirationTime.fromDays(365)` — renewed on every update | Long-lived identity entity |
| Event | `ExpirationTime.fromDate(endDate)`, floor 1 day | Expires when the event ends |
| RSVP | Matches parent event `endDate`, floor 1 hour | No value after event ends |
| Checkin | Matches parent event `endDate`, floor 1 hour | Proof valid until event ends |

### Advanced Features

**Discrete event state machine** — `draft → upcoming → live → ended` with one-click transitions. Status is updated via `updateEntity()` preserving live `rsvpCount`, `organizerKey`, and `organizerName` attributes.

**Publish now / save as draft** — when creating an event, organizers choose whether to publish immediately (status = `upcoming`) or save privately (status = `draft`).

**Waitlist with auto-promotion** — when `rsvpCount >= capacity`, new RSVPs are `waitlisted`. When a confirmed RSVP is cancelled, `promoteFirstWaitlisted()` updates the next waitlisted RSVP to `confirmed` on-chain automatically. My RSVPs page shows live waitlist position (#1, #2, …).

**Auto-ended transition** — on organizer dashboard load, `autoTransitionEndedEvents()` batch-updates any `upcoming`/`live` events whose `endDate` has passed to `ended` in a single `mutateEntities({ updates: [...] })` call.

**Capacity → Live auto-promotion** — `autoPromoteCapacityStatus()` reads `rsvpCount` vs `capacity` attributes after each RSVP, auto-transitioning `upcoming → live` when the event fills up.

**Cascade delete** — `deleteEvent()` fetches all child RSVPs first, then deletes everything atomically in one batch transaction.

**Check-in as a separate entity** — RSVP and check-in are decoupled: organizers create `checkin` entities independently, so walk-in check-ins (no prior RSVP) work too. Check-in history is independently queryable by event.

**`rsvpCount` as a numeric attribute** — capacity checks use `gte`/`lte` without deserialising payload. This is an Arkiv-native approach for derived aggregates.

**`organizerKey` entity reference** — events store a reference to their parent `organizer_profile` entity key, enabling navigation and data integrity checks using pure Arkiv queries.

---

## User Flows

### Organizer
1. Connect wallet → switch to Kaolin
2. `/organizer/onboard` → create on-chain organizer profile
3. `/organizer/events/create` → 3-step form → choose "Publish immediately" or "Save as draft"
4. Dashboard → manage status transitions, edit details, delete events
5. `/organizer/events/[key]/attendees` → check in attendees, export attendee list CSV

### Attendee (wallet optional for browsing)
1. `/` → search events, apply category chips, use filter bar (category, location, date range, status)
2. Click event → see full details: capacity bar, organizer profile link, attendee list
3. Connect wallet → RSVP (confirmed, or waitlisted if full)
4. `/my-rsvps` → see all RSVPs with status, waitlist position, on-chain link; cancel at any time

---

## Setup

### Prerequisites
- Node.js 20+
- A wallet (MetaMask, Rabby, etc.) configured for Kaolin testnet:
  - **RPC**: `https://kaolin.hoodi.arkiv.network/rpc`
  - **Chain ID**: `60138453025`

### Install & Run

```bash
git clone <repo-url>
cd arkiv-luma
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No `.env` file required — everything reads from the public Kaolin RPC.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Styling | Tailwind CSS v4 |
| Blockchain | Arkiv SDK · Kaolin testnet |
| Wallet | wagmi v3 + ConnectKit |
| Data fetching | TanStack Query v5 |
| Notifications | react-hot-toast |

---

## Code Quality Notes

- **`lib/arkiv/`** — pure TypeScript, zero React. Every exported function returns `ArkivResult<T>` (discriminated union `{ success: true; data } | { success: false; error }`). Callers never need `try/catch`.
- **`hooks/`** — thin TanStack Query wrappers. No business logic or SDK calls.
- **`components/`** — stateless or lightly stateful UI. No direct Arkiv SDK calls.
- **`app/`** — pages compose hooks + components, handle routing and wallet guards.
- TypeScript strict mode throughout. No `any` usage.
- All entity attribute arrays are built to preserve existing values (e.g., `organizerKey`, `rsvpCount`) across updates, preventing accidental data loss.
