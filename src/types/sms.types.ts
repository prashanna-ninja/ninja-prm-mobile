/**
 * Messages (CrazyTel SMS) shapes.
 *
 * Checked 2026-10-18 against the route CODE in ../ninja_prm (branch
 * feat/sms-api, uncommitted): src/app/api/v1/sms/** wrapping
 * src/app/actions/sms.ts. Not yet checked against live JSON — the routes
 * aren't deployed.
 */

/** One of the user's own CrazyTel numbers ("Ben CLS LEGACY"). */
export type SmsLine = {
  key: string;
  label: string;
  display: string;
  isDefault: boolean;
};

/** `GET /api/v1/sms/setup` — never 409s; `configured:false` when unconnected. */
export type SmsSetup = {
  configured: boolean;
  source: "connection" | "legacy" | null;
  lines: SmsLine[];
};

export type SmsDirection = "INBOUND" | "OUTBOUND";

/** SmsMessageStatus in the Prisma schema. */
export type SmsStatus = "RECEIVED" | "QUEUED" | "SENT" | "DELIVERED" | "FAILED";

/**
 * A thread is everything exchanged with ONE PERSON: every number of a linked
 * contact merged together, or a single number that isn't a contact yet.
 */
export type SmsThread = {
  /** "contact:<contactId>" | "conv:<conversationId>" — changes when a number is saved to a contact. */
  id: string;
  contact: { id: string; name: string; image: string | null } | null;
  phones: { conversationId: string; phone: string; display: string }[];
  /** The number replies go to (most recently used). */
  replyPhone: string;
  replyLineKey: string;
  /** false for sender-name threads ("QANTAS", "Telstra") — carriers can't take replies. */
  canReply: boolean;
  /** Which of the user's lines this person has texted with. */
  lineKeys: string[];
  lastDirection: SmsDirection | null;
  lastMessageAt: string;
  lastMessagePreview: string | null;
  unreadCount: number;
};

export type SmsFilter = "all" | "unread" | "contacts" | "unknown";

export type SmsThreadListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  filter?: SmsFilter;
  /** Omit for "All my numbers". */
  lineKey?: string;
};

export type SmsThreadListResponse = {
  threads: SmsThread[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  /**
   * THREADS with anything unread (not unread messages), across all threads
   * before filtering/paging — the same number as the web's "Unread N" tab.
   */
  unreadTotal: number;
};

export type SmsMessage = {
  id: string;
  direction: SmsDirection;
  status: SmsStatus | string;
  /** Empty when `contentAvailable` is false. */
  body: string;
  /** false: CrazyTel only reported that a text happened, not what it said. */
  contentAvailable: boolean;
  createdAt: string;
  lineKey: string | null;
  peerDisplay: string;
};

export type SmsThreadMessagesResponse = {
  messages: SmsMessage[];
  /**
   * The thread's own row, so a thread can open without the list loaded.
   * ⚠️ null when the thread exists but has no texts on a SYNCED line — the
   * inbox doesn't list it, and the app shows it read-only (no composer).
   */
  thread: SmsThread | null;
};

export type SendSmsInput = {
  to: string;
  body: string;
  lineKey?: string;
  /** Idempotency key — the SAME value on a retry, so CrazyTel never sends twice. */
  clientRequestId?: string;
};

export type SendSmsResponse = {
  success: true;
  threadId: string;
  /** The saved row. Always sent by the route; null only defensively. */
  message: SmsMessage | null;
};

export type LinkThreadInput = { contactId: string } | { newContactName: string };
