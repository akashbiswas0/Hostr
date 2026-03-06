import type { Category } from "./categories";

export type ArkivResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export type EventStatus = "draft" | "upcoming" | "live" | "ended" | "archived";
export type TicketStatus =
  | "pending"
  | "confirmed"
  | "waitlisted"
  | "checked-in"
  | "not-going";
export type TicketDecision = "approved" | "rejected";

export interface OrganizerProfile {
  name: string;
  bio: string;
  avatarUrl: string;
  website: string;
  twitter: string;
  coverImageUrl?: string;
  logoImageUrl?: string;
  countryCode?: string;
  city?: string;
  language?: string;
}

export interface UserProfile {
  displayName: string;
  bio?: string;
  avatarImageUrl?: string;
  bannerImageUrl?: string;
  website?: string;
  twitter?: string;
  countryCode?: string;
  city?: string;
  language?: string;
}

export interface Event {
  title: string;
  description: string;
  date: string;
  endDate: string;
  location: string;
  category: Category;
  capacity: number;
  virtualLink?: string;
  status: EventStatus;
  requiresRsvp?: boolean;
  imageUrl?: string;
  themeId?: string;
  fontPreset?: string;
  coverImageUrl?: string;
  posterImageUrl?: string;
  thumbnailImageUrl?: string;
  poapImageUrl?: string;
  poapAnimationUrl?: string;
  poapTemplateId?: string;
  format?: "in_person" | "online" | "hybrid";
  priceTier?: "free" | "paid" | "donation";
  priceMin?: number;
  priceMax?: number;
  currency?: string;
  language?: string;
  audienceLevel?: "all" | "beginner" | "intermediate" | "advanced";
  visibility?: "public" | "unlisted";
}

export interface Ticket {
  eventKey: string;
  attendeeName: string;
  attendeeEmail: string;
  message?: string;
  attendeeAvatarUrlSnapshot?: string;
  attendeeDisplayNameSnapshot?: string;
  attendanceMode?: "in_person" | "online";
  ticketType?: string;
}

export interface TicketDecisionEntity {
  eventKey: string;
  ticketKey: string;
  attendeeWallet: string;
  decision: TicketDecision;
  decidedAt: number;
  decisionReasonCode?: string;
}

export interface Checkin {
  eventKey: string;
  ticketKey?: string;
  attendeeWallet: string;
  checkedInAt: number;
  checkinMethod: "qr" | "manual";
  checkinGate?: string;
}

export interface ProofOfAttendance {
  eventKey: string;
  ticketKey: string;
  checkinKey: string;
  attendeeWallet: string;
  eventTitle: string;
  issuedAt: number;
  checkedInAt: number;
  poapImageUrl?: string;
  poapAnimationUrl?: string;
  poapTemplateId?: string;
}

export interface EventSearchToken {
  eventKey: string;
  token: string;
  field: "title" | "description" | "venue" | "tags";
  status: EventStatus;
  category: string;
  cityNorm: string;
  startAt: number;
}

export interface HostEventDiscoveryFilters {
  status?: EventStatus[];
  category?: string[];
  city?: string;
  countryCode?: string;
  format?: "in_person" | "online" | "hybrid";
  isOnline?: 0 | 1;
  approvalMode?: "auto" | "manual";
  priceTier?: "free" | "paid" | "donation";
  priceMax?: number;
  language?: string;
  startFrom?: number;
  startTo?: number;
  hasSeatsOnly?: boolean;
  hasImage?: 0 | 1;
}

export type HostEventSort =
  | "startAtAsc"
  | "startAtDesc"
  | "newest"
  | "mostPopular";

export interface HostEventGraph {
  event: import("@arkiv-network/sdk").Entity;
  tickets: import("@arkiv-network/sdk").Entity[];
  decisions: import("@arkiv-network/sdk").Entity[];
  checkins: import("@arkiv-network/sdk").Entity[];
  poaps: import("@arkiv-network/sdk").Entity[];
}
