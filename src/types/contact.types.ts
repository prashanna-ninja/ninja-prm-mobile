/**
 * Contact shapes.
 *
 * Source of truth: `ref/prm/src/app/api/v1/contacts/**`. Verified against the
 * route code 2026-09-28 — the list `select` and the full row differ, so they
 * are separate types here rather than one optimistic interface.
 */

export const RELATIONSHIP_TYPES = [
  "FRIEND",
  "FAMILY",
  "CLIENT",
  "LEAD",
  "VENDOR",
  "COLLABORATOR",
  "COLLEAGUE",
  "OTHER",
] as const;
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

/** Wire format is SCREAMING_CASE; this is only for display. */
export const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  FRIEND: "Friend",
  FAMILY: "Family",
  CLIENT: "Client",
  LEAD: "Lead",
  VENDOR: "Vendor",
  COLLABORATOR: "Collaborator",
  COLLEAGUE: "Colleague",
  OTHER: "Other",
};

export type Tag = { id: string; name: string; color: string };

/**
 * A row in the list. Note it has NO `archived` or `updatedAt` — the list
 * `select` omits them. Don't assume the detail shape here.
 */
export type ContactListItem = {
  id: string;
  createdAt: string;
  name: string;
  email: string | null;
  phone: string | null;
  image: string | null;
  relationshipType: RelationshipType;
  company: { name: string } | null;
  _count: {
    interactions: number;
    taskContacts: number;
    importantDates: number;
  };
  tags: Tag[];
};

export type ContactListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  /** Omit for all. An INVALID value 500s server-side, so only send real ones. */
  relationshipType?: RelationshipType;
  archived?: boolean;
  sortBy?: "name" | "relationshipType" | "updatedAt" | "createdAt";
  sortOrder?: "asc" | "desc";
};

export type ContactListResponse = {
  contacts: ContactListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type ContactTask = {
  id: string;
  title: string;
  status: "OPEN" | "DONE" | "CANCELLED";
  priority: "LOW" | "NORMAL" | "HIGH";
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ContactInteraction = {
  id: string;
  type: string;
  occurredAt: string;
  summary: string | null;
  createdAt: string;
};

export type ImportantDate = {
  id: string;
  label: string;
  date: string;
  reminderOffsetDays: number | null;
};

/** The full row, returned by GET [id] / POST / PATCH / archive / unarchive. */
export type ContactDetail = {
  id: string;
  ownerId: string;
  visibility: "PRIVATE" | "SHARED";
  name: string;
  relationshipType: RelationshipType;
  companyId: string | null;
  email: string | null;
  phone: string | null;
  socials: unknown;
  location: string | null;
  timezone: string | null;
  dateOfBirth: string | null;
  image: string | null;
  about: string | null;
  /** ⚠️ JSON-ENCODED STRINGS on the wire, e.g. "[\"golf\"]" — not arrays. */
  likes: string | null;
  dislikes: string | null;
  notes: unknown;
  archived: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;

  /** Present on GET [id]; absent from POST/PATCH/archive responses. */
  company?: { id: string; name: string } | null;
  tags?: Tag[];
  tasks?: ContactTask[];
  interactions?: ContactInteraction[];
  importantDates?: ImportantDate[];
};

/** What POST /contacts accepts. `name` is the only required field. */
export type CreateContactInput = {
  name: string;
  relationshipType?: RelationshipType;
  email?: string;
  phone?: string;
  location?: string;
  dateOfBirth?: string;
  about?: string;
  /** Sent as arrays; the server JSON-encodes them for storage. */
  likes?: string[];
  dislikes?: string[];
  tagIds?: string[];
};

export type UpdateContactInput = Partial<CreateContactInput>;

/**
 * `likes`/`dislikes` come back as a JSON-encoded string, not an array.
 * Older rows may hold plain text, so fall back rather than throwing.
 */
export function parseStringList(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((v): v is string => typeof v === "string");
    }
  } catch {
    // Not JSON — treat it as a single free-text entry.
  }
  return value.trim() ? [value.trim()] : [];
}
