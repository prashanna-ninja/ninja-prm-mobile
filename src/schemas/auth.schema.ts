import { z } from "zod";

/**
 * The single source of truth for the sign-in form's shape.
 * Types are inferred from this in src/types/auth.types.ts — never declared twice.
 */
export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email address")
    .email("That doesn't look like an email address")
    // The server lowercases anyway; doing it here keeps the "sent to" line honest.
    .transform((value) => value.toLowerCase()),
});
