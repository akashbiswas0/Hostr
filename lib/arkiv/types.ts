export type ArkivResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export type EventStatus = "draft" | "upcoming" | "live" | "ended";

export type RSVPStatus = "pending" | "confirmed" | "waitlisted" | "checked-in";

export interface OrganizerProfile {
  name: string;
  bio: string;
  avatarUrl: string;
  website: string;
  twitter: string;
}

export interface Event {
  title: string;
  description: string;
  
  date: string;
  
  endDate: string;
  location: string;
  category: string;
  capacity: number;
  
  virtualLink?: string;
  status: EventStatus;
  /** Whether attendees must be manually approved by the organizer before being confirmed */
  requiresRsvp?: boolean;
  /** Optional cover image (data URL or https URL) */
  imageUrl?: string;
}

export interface RSVP {
  eventKey: string;
  attendeeName: string;
  attendeeEmail: string;
  
  message?: string;
}
