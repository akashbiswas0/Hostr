# Arkiv Web3 Database Builders Challenge — Builder's Guide

---

## What you're building

A **web3-native application** where all data lives on Arkiv. Users own their data — not the platform.

Pick one of three verticals:

| Vertical | The pitch | You're replacing... |
|----------|----------|-------------------|
| **Job Board** | Professional data owned by users, not platforms | LinkedIn, Indeed |
| **Event Platform** | Events and attendance owned by organizers and communities | Luma, Eventbrite |
| **Knowledge Base** | Documentation owned by the team, not the hosting provider | GitBook, Notion |

All three are tools that web3 teams use every day — except they run on centralized infrastructure. You're building the version where the data lives on Arkiv.

**Pick the one that excites you.** All verticals are scored on the same rubric. There's no advantage to choosing one over another.

---

## Minimum Requirements (all verticals)

Regardless of which vertical you pick, your submission must:

### Technical baseline
- [ ] All core data stored as Arkiv entities (not in a traditional database)
- [ ] Wallet-based ownership (creators own their data)
- [ ] At least 2 entity types with a relationship between them
- [ ] Queryable attributes used for filtering or search
- [ ] Rational expiration dates on entities (see [A note on expiration](#a-note-on-expiration))
- [ ] Public read access (no wallet needed to browse)
- [ ] Open source GitHub repo
- [ ] Working demo link
- [ ] README with setup instructions

---

## Vertical 1: Job Board

*"Own your professional data."*

Build a web3-native Job Board where job postings, company profiles, and applications are owned by users and stored on Arkiv.

### Minimum features

**For companies / job posters (wallet required):**
- [ ] Create a company profile
- [ ] Post a job listing with title, description, and apply link
- [ ] Edit a listing
- [ ] View and manage their listings

**For job seekers (no wallet needed):**
- [ ] Browse all active listings
- [ ] Filter listings by at least 2 criteria (e.g., discipline, location type)
- [ ] View full job details
- [ ] Apply via external link
- [ ] View company profiles

**For job seekers (continued):**
- [ ] Search by keyword (across titles, descriptions, company names)

**Data lifecycle:**
- [ ] Expiration dates on listings (e.g., 30/60/90 days — see [A note on expiration](#a-note-on-expiration) below)

### Nice-to-haves
- Flagging (users flag suspicious listings, wallet required)
- Status management (mark as filled, show expired states)
- Salary display

### Suggested entity design

Think in terms of **two core entity types**: a Company profile (one per wallet) and Job Listings (owned by the company's wallet). Use queryable attributes for things like status, discipline, location type — anything users will want to filter by.

---

## Vertical 2: Event Platform (Luma-style)

*"Own your events and community."*

Build a web3-native event platform where events, RSVPs, and attendance records are owned by organizers and verifiable on-chain.

### Minimum features

**For organizers (wallet required):**
- [ ] Create an organizer profile
- [ ] Create an event with title, description, date, location, and capacity
- [ ] View RSVPs / attendee list
- [ ] Manage event status (upcoming → live → ended)
- [ ] Edit event details

**For attendees (no wallet needed to browse, wallet needed to RSVP):**
- [ ] Browse upcoming events
- [ ] Filter by at least 2 criteria (e.g., date, location, category)
- [ ] View full event details
- [ ] RSVP to an event (wallet required)
- [ ] View organizer profile and their other events

**Data lifecycle:**
- [ ] Expiration dates on events (e.g., auto-expire after event end date — see [A note on expiration](#a-note-on-expiration) below)

### Nice-to-haves
- Capacity limits with waitlist
- Check-in / attendance verification (proof of attendance as an entity)
- Recurring events
- Event categories / tags
- Calendar view
- Share / invite links

### Suggested entity design

Think in terms of **three core entity types**: an Organizer profile (one per wallet), Events (owned by the organizer), and RSVPs (owned by the attendee's wallet — a different wallet than the event owner).

---

## Vertical 3: Knowledge Base / Docs

*"Own your documentation."*

Build a web3-native knowledge base where documentation, articles, and edits are owned by authors and the organization — not by the hosting provider. Think GitBook, but the data lives on Arkiv.

### Minimum features

**For authors (wallet required):**
- [ ] Create a space (project/organization)
- [ ] Create and edit pages/articles within a space
- [ ] Organize pages (at minimum: flat list with ordering; bonus: nested/tree structure)
- [ ] Manage space settings (name, description, visibility)

**For readers (no wallet needed):**
- [ ] Browse spaces
- [ ] Read pages/articles with proper formatting (Markdown rendering)
- [ ] Navigate between pages within a space
- [ ] Search across pages (at minimum: by title)
- [ ] See author and last-edit info per page

### Nice-to-haves
- Version history (each edit stored as a separate entity, browsable diff)
- Nested page structure (tree navigation like GitBook sidebar)
- Multiple authors per space (collaborative editing with attribution)
- Full-text search across page content
- Custom slugs / URLs for pages
- Public vs. private spaces
- Table of contents auto-generated from headings
- Export (Markdown download)

### Suggested entity design

Think in terms of **two core entity types** (with an optional third): a Space (one per wallet), Pages within a space, and optionally Revisions for version history. Pages reference their parent space, and revisions reference their parent page. Nested page structures (parent→child) are a great way to show entity relationship depth.

---

## What "Arkiv integration depth" means

This is 40% of your score. Same rubric regardless of vertical.

**Shallow (low score):**
- Using Arkiv as a simple key-value store
- Storing a JSON blob and reading it back
- Minimal use of entity attributes or querying

**Medium (decent score):**
- Proper entity schema with queryable attributes
- Using Arkiv's query capabilities for filtering and search
- Wallet-based ownership

**Deep (high score):**
- Entity relationships maintained properly (parent → children via references)
- Rational expiration dates — thoughtful choices about how long each entity type should live (see [A note on expiration](#a-note-on-expiration))
- Multiple entity types working together
- Creative use of Arkiv features we haven't thought of

---

## A note on expiration

All Arkiv entities have an expiration date — this is core to how Arkiv works, not an optional feature. Job listings that expire after 30 days, events that expire after the event date, draft pages that clean themselves up — that's the expected behavior.

**Choose expiration dates thoughtfully.** On testnet (which is what you'll be building on), expiration has no cost implications. But on mainnet, expiration directly impacts pricing — shorter-lived entities are cheaper, longer-lived entities cost more. If you're designing your data model, think about it the way a real product would: a job listing probably doesn't need to live for 5 years, but a company profile probably needs a longer lifespan. That kind of intentionality is what scores well on Arkiv integration depth.

---

## Getting Started

1. **Pick your vertical** — whichever excites you most
2. **Read the Arkiv docs** — [arkiv.network/docs](https://arkiv.network/docs)
3. **Pick your SDK** — [TypeScript](https://arkiv.network/getting-started/typescript) or [Python](https://arkiv.network/getting-started/python)
4. **Explore the developer portal** — [arkiv.network/dev](https://arkiv.network/dev)
5. **Connect to testnet** — [instructions in the getting started guides]
6. **Join the Discord support channel** — [Join our server](https://discord.gg/arkiv) → #builders-challenge
7. **Start with your primary entity** — get create + read working first, then build relationships on top
---

## Submission Requirements

| What | Details |
|------|---------|
| **Vertical chosen** | Job Board, Event Platform, or Knowledge Base |
| **GitHub repo** | Public, open source, includes README with setup instructions |
| **Demo link** | Working deployment (Vercel, Netlify, etc.) connected to Arkiv testnet |
| **Demo video** | Optionally, you can submit slides, but we recommend a 2-3 min walkthrough/demo. |
| **Team info** | Names, GitHub handles, wallet address for prize |

Submission form: [Submit here](https://forms.arkiv.network/web3-db-challenge)

---

## Questions?

Join our [Discord](https://discord.gg/arkiv) and head to **#builders-challenge**. The Arkiv team is there daily during the build window.

Don't struggle alone. If you're stuck on an Arkiv integration issue, ask. We'd rather help you ship something great than watch you debug in silence for 3 days.