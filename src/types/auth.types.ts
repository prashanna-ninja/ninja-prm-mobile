import type { z } from "zod";

import type { signInSchema } from "@/schemas/auth.schema";

/** What the sign-in form collects. Inferred, so it can't drift from the schema. */
export type SignInValues = z.input<typeof signInSchema>;

/** Which half of the sign-in flow the user is looking at. */
export type SignInStep = "email" | "sent";
