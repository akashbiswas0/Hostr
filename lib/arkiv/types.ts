import type { Category } from "./categories";

export type ArkivResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export type EventStatus = "draft" | "upcoming" | "live" | "ended";
export type RSVPStatus = "pending" | "confirmed" | "waitlisted" | "checked-in" | "not-going";
export type RsvpDecision = "approved" | "rejected";

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

export interface UserProfileV2 {
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
  coverImageUrl?: string;
  posterImageUrl?: string;
  thumbnailImageUrl?: string;
  format?: "in_person" | "online" | "hybrid";
  priceTier?: "free" | "paid" | "donation";
  priceMin?: number;
  priceMax?: number;
  currency?: string;
  language?: string;
  audienceLevel?: "all" | "beginner" | "intermediate" | "advanced";
  visibility?: "public" | "unlisted";
}

export type EventV2 = Event;

export interface RSVP {
  eventKey: string;
  attendeeName: string;
  attendeeEmail: string;
  message?: string;
  attendeeAvatarUrlSnapshot?: string;
  attendeeDisplayNameSnapshot?: string;
  attendanceMode?: "in_person" | "online";
  ticketType?: string;
}

export type RsvpV2 = RSVP;

export interface RsvpDecisionV2 {
  eventKey: string;
  rsvpKey: string;
  attendeeWallet: string;
  decision: RsvpDecision;
  decidedAt: number;
  decisionReasonCode?: string;
}

export interface CheckinV2 {
  eventKey: string;
  rsvpKey?: string;
  attendeeWallet: string;
  checkedInAt: number;
  checkinMethod: "qr" | "manual";
  checkinGate?: string;
}

export interface ProofOfAttendanceV2 {
  eventKey: string;
  rsvpKey: string;
  checkinKey: string;
  attendeeWallet: string;
  eventTitle: string;
  issuedAt: number;
  checkedInAt: number;
  poapImageUrl?: string;
  poapAnimationUrl?: string;
  poapTemplateId?: string;
}

export interface EventSearchTokenV2 {
  eventKey: string;
  token: string;
  field: "title" | "description" | "venue" | "tags";
  status: EventStatus;
  category: string;
  cityNorm: string;
  startAt: number;
}

export interface EventDiscoveryFiltersV2 {
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

export type EventSortV2 =
  | "startAtAsc"
  | "startAtDesc"
  | "newest"
  | "mostPopular";

export interface EventGraphV2 {
  event: import("@arkiv-network/sdk").Entity;
  rsvps: import("@arkiv-network/sdk").Entity[];
  decisions: import("@arkiv-network/sdk").Entity[];
  checkins: import("@arkiv-network/sdk").Entity[];
  poaps: import("@arkiv-network/sdk").Entity[];
}
