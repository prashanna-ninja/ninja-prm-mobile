/**
 * Task shapes.
 *
 * Source of truth: `ref/prm/src/app/api/v1/tasks/**`. Verified against the
 * route code 2026-09-29. The web app calls these "Tasks"; recording action
 * items become tasks automatically on the server
 * (`ref/prm/src/lib/recordings/auto-tasks.ts`), which is what the `source*`
 * fields are for.
 */

import type { RecordingSource } from "@/types/recording.types";

export const TASK_STATUSES = ["OPEN", "DONE", "CANCELLED"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["LOW", "NORMAL", "HIGH"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/** Wire format is SCREAMING_CASE; these are only for display. */
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  OPEN: "Open",
  DONE: "Done",
  CANCELLED: "Cancelled",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
};

/**
 * Free text on the server (`String?`), but the web form only ever writes
 * these four — keep them identical so both apps show the same value.
 */
export const REPEAT_INTERVALS = ["daily", "weekly", "monthly", "yearly"] as const;
export type RepeatInterval = (typeof REPEAT_INTERVALS)[number];

export const REPEAT_LABELS: Record<RepeatInterval, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

/**
 * A linked contact, as embedded under `contacts[].contact`.
 * `email`/`phone` are only selected by GET [id] — list, POST and PATCH omit them.
 */
export type TaskContactRef = {
  id: string;
  name: string;
  image: string | null;
  email?: string | null;
  phone?: string | null;
};

/**
 * The full row. Every task endpoint (list, GET [id], POST, PATCH) returns this
 * — `findMany` / `create` / `update` all use `include`, so every scalar comes
 * back, including the provenance fields.
 */
export type Task = {
  id: string;
  userId: string;
  title: string;
  /** ⚠️ HTML — the web form is a rich-text editor. Render via `htmlToText`. */
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  /** Start of the due DAY in the user's profile timezone, as a UTC instant. */
  dueAt: string | null;
  repeatInterval: string | null;
  opportunityId: string | null;
  /**
   * Set when the task was generated from a recording's action items — `sourceId`
   * is that recording's id, so together they route to its detail screen. The
   * schema comment lists call|plaud|granola, but Fieldy sync writes it too.
   */
  sourceType: RecordingSource | null;
  sourceId: string | null;
  sourceLabel: string | null;
  createdAt: string;
  updatedAt: string;
  contacts: { id: string; contact: TaskContactRef }[];
  tags?: { id: string; name: string; color: string }[];
};

export type TaskListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  /** Omit for all. */
  status?: TaskStatus;
  priority?: TaskPriority;
  contactId?: string;
  sortBy?: "dueAt" | "title" | "status" | "priority" | "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
};

/** Note: NOT the same envelope as `/contacts/[id]/tasks` (skip/take/hasMore). */
export type TaskListResponse = {
  tasks: Task[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/** What POST /tasks accepts. `title` is the only required field. */
export type CreateTaskInput = {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  /** ISO instant. The server keeps only the calendar day — see `dueAtForDay`. */
  dueAt?: string | null;
  repeatInterval?: RepeatInterval | null;
  contactIds?: string[];
};

/**
 * PATCH. Every field is optional and only what's sent changes.
 *
 * ⚠️ `contactIds` REPLACES the whole set (delete-all then re-create), and the
 * server does that BEFORE it validates `dueAt`, outside a transaction — a bad
 * date after a contactIds change loses the links. The app only ever sends a
 * `dueAt` it built itself, and only sends `contactIds` when they changed.
 * Backend fix: docs/implementation/BACKEND-CHANGES.md §10.
 */
export type UpdateTaskInput = Partial<CreateTaskInput>;
