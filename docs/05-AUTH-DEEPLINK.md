# 05 — Auth: Magic Link + Deep-Link Sign-In

This is the most important doc, because auth is where web and native differ most. The pattern is
**already solved** in `ref/ninja-crm-mobile` — we port it, we don't redesign it.

Goal: the user types their email, taps the link in their inbox, and lands **inside the app**,
signed in. No password, no copy-pasting a code.

---

## 1. The happy path

```
  APP                         BACKEND                       EMAIL / OS
   │  1. email entered            │                              │
   ├─ POST /api/auth/sign-in/     │                              │
   │    magic-link                │                              │
   │    { email,                  │                              │
   │      callbackURL:            │                              │
   │        "ninjaprm://" }  ───► │                              │
   │                              ├─ 2. Resend sends the ──────► │
   │                              │      magic-link email        │
   │  "Check your inbox" screen   │                              │
   │                              │                              │  3. user taps link
   │                              │ ◄── GET /api/auth/magic-link/verify?token=…&callbackURL=ninjaprm://
   │                              ├─ 4. verifies token, creates  │
   │                              │      the session             │
   │                              ├─ 5. 302 → ninjaprm://?cookie=<set-cookie>
   │                              │                              │
   │ ◄─ 6. OS opens the app with that URL                        │
   ├─ 7. use-auth-deep-link parses `cookie`, writes it to SecureStore
   ├─ 8. authClient.useSession().refetch() → session appears
   └─ 9. Stack.Protected swaps (auth) → (app). Done.
```

Steps 5–8 are where web and native diverge, and are the part people get wrong.

---

## 2. What the PRM backend has today

Read from `ref/prm/src/auth.ts`:

```ts
export const auth = betterAuth({
  appName: "Ninja PRM",
  baseURL,                                   // BETTER_AUTH_URL || NEXT_PUBLIC_APP_URL
  session: { expiresIn: 30 days, updateAge: 6h, cookieCache: { enabled: true, maxAge: 5m } },
  advanced: { defaultCookieAttributes: { sameSite: "lax" } },
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  socialProviders: { google, microsoft, linkedin },
  trustedOrigins: [ baseURL, …dev localhost, …process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(",") ],
  plugins: [
    nextCookies(),
    admin({ … }),
    magicLink({ expiresIn: 900, sendMagicLink }),   // 15 minutes
  ],
  rateLimit: { customRules: { "/sign-in/magic-link": { window: 60, max: 3 } } },
});
```

Good news:

- ✅ Magic link is **already the primary web sign-in** (`components/auth/magic-link-auth-form.tsx`)
  and `sendMagicLink` passes through whatever `callbackURL` the caller supplies — the same email
  works for web and mobile, unchanged.
- ✅ `trustedOrigins` already reads the **`BETTER_AUTH_TRUSTED_ORIGINS` env var**, so trusting
  `ninjaprm://` needs **no code change** — just an env value.
- ✅ `/api/auth/[...all]/route.ts` is already patched for mobile: it handles CORS preflight and
  injects an `Origin` header when a native client sends none.
- ✅ Sessions last 30 days with a rolling 6-hour refresh, so people stay signed in.

Missing:

- ❌ **No `@better-auth/expo` plugin.** Without it the server won't emit the
  `ninjaprm://?cookie=…` redirect, and native clients aren't first-class.
- ❌ `ninjaprm://` isn't in `BETTER_AUTH_TRUSTED_ORIGINS` yet (env, not code).

Both are in [implementation/BACKEND-CHANGES.md](implementation/BACKEND-CHANGES.md). Neither
changes any existing web behaviour.

### The backend change, exactly

```ts
// ref/prm/src/auth.ts
import { expo } from "@better-auth/expo";     // ← new import  (pnpm add @better-auth/expo)

  plugins: [
    expo(),                // ← ADD. Must come BEFORE nextCookies().
    nextCookies(),         //   nextCookies() stays LAST.
    admin({ … }),
    magicLink({ … }),      // unchanged
  ],
```

> ⚠️ In the current file `nextCookies()` is listed **first**. Better Auth's documented ordering is
> `nextCookies()` **last**. Moving it is the correct fix, but it touches the web login path —
> verify web sign-in still works after the change before shipping.

```bash
# server env
BETTER_AUTH_TRUSTED_ORIGINS=ninjaprm://
```

---

## 3. The mobile client

```ts
// src/lib/auth-client.ts
import { expoClient } from "@better-auth/expo/client";
import { magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";
import { API_BASE_URL } from "@/constants/env";

export const authClient = createAuthClient({
  baseURL: API_BASE_URL,           // must equal the server's NEXT_PUBLIC_APP_URL
  plugins: [
    magicLinkClient(),
    expoClient({
      scheme: "ninjaprm",          // MUST match app.json + trustedOrigins + callbackURL
      storagePrefix: "ninjaprm",   // → SecureStore key "ninjaprm_cookie"
      storage: SecureStore,
    }),
  ],
});
```

**Sending the link** (from `components/login/login-form.tsx`):

```ts
await authClient.signIn.magicLink({
  email: normalizedEmail,
  callbackURL: "ninjaprm://",
  newUserCallbackURL: "ninjaprm://",
  errorCallbackURL: "ninjaprm://?error=magic-link",
});
```

**Capturing the return** — port `ref/ninja-crm-mobile/src/hooks/use-auth-deep-link.ts` and
`src/lib/session-cookie.ts` almost verbatim, changing only the scheme and the SecureStore key:

```ts
// src/lib/session-cookie.ts
import { getSetCookie, storageAdapter } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";

const COOKIE_KEY = "ninjaprm_cookie";              // must match storagePrefix + "_cookie"
const cookieStorage = storageAdapter(SecureStore); // the exact wrapper the Expo client reads back

export async function storeSessionCookie(setCookie: string) {
  const prev = cookieStorage.getItem(COOKIE_KEY) ?? undefined;
  await cookieStorage.setItem(COOKIE_KEY, getSetCookie(setCookie, prev));
}
```

`use-auth-deep-link.ts` then, on both cold start (`Linking.getInitialURL()`) and warm resume
(`Linking.addEventListener("url")`):

1. `Linking.parse(url)` → read `queryParams.cookie`.
2. Non-empty → `storeSessionCookie(cookie)` → `refetch()` the session. **Signed in.**
3. Empty, but the URL still carries `error` / `token` / an empty `cookie` → it *was* an auth
   callback that failed → alert **"This sign-in link is invalid or has expired."**
4. Neither → a normal app open; do nothing.

Call it **once**, high in the tree, in `src/app/_layout.tsx`.

---

## 4. Why this hand-rolled capture is necessary

> **The Better Auth Expo client does not auto-capture magic links.** It only auto-captures OAuth,
> via `openAuthSessionAsync`. A magic link is tapped in the *email app*, opens the *system
> browser*, and comes back to the app as a plain deep link. Nothing in the library is watching for
> that — the app has to parse `?cookie=` itself. (better-auth issue #6936.)

Two more non-negotiables, both already paid for on Ninja CRM Mobile:

1. **`apiFetch` must send `Cookie: authClient.getCookie()` manually.** The Expo client only
   attaches the cookie to its own `authClient.*` calls; a plain `fetch` gets nothing and every
   authed endpoint 401s.
2. **`apiFetch` must set `credentials: "omit"`.** On iOS, NSURLSession keeps its own cookie jar
   and appends *its* copy on top of our header, producing `__Secure-…=a,__Secure-…=b` — which the
   server can't parse, so it 500s and the user looks logged out. Android is unaffected either way.
   **Removing `omit` re-breaks every authenticated call on iOS.**

---

## 5. App config

```jsonc
// app.json
{
  "expo": {
    "name": "Ninja PRM",
    "slug": "ninja-prm-mobile",
    "scheme": "ninjaprm",
    "ios":     { "bundleIdentifier": "com.adviceninja.ninjaprm" },
    "android": { "package": "com.adviceninja.ninjaprm" },
    "plugins": ["expo-router", "expo-secure-store", "expo-web-browser", ["expo-splash-screen", { … }]]
  }
}
```

**The scheme appears in four places and they must be identical:**
`app.json` · `lib/auth-client.ts` · the sign-in `callbackURL` · the server's trusted origins.

---

## 6. Session guard & routing

```tsx
// src/app/_layout.tsx (shape — see ref/ninja-crm-mobile for the full file)
const { data: session, isPending } = authClient.useSession();
const isSignedIn = !!session?.user;
useAuthDeepLink();
const [fontsLoaded, fontError] = useFonts(appFonts);
const isBooting = isPending || (!fontsLoaded && !fontError);

<Stack screenOptions={{ headerShown: false }}>
  <Stack.Protected guard={isSignedIn}><Stack.Screen name="(app)" /></Stack.Protected>
  <Stack.Protected guard={!isSignedIn}><Stack.Screen name="(auth)" /></Stack.Protected>
</Stack>
```

While `isBooting`, show the branded splash, not a bare spinner — this is the first thing a user
sees on every cold start. Sign out with `authClient.signOut()`; the guard flips automatically.

---

## 7. Gotchas & open items

| Item | Detail |
| ---- | ------ |
| **Expo Go can't do this** | Expo Go doesn't own the `ninjaprm://` scheme. "Send link" works in Expo Go; the return trip needs a **dev build** (`eas build --profile development`). |
| **Rate limit** | `/sign-in/magic-link` is capped at **3 per 60s** server-side. The UI must show a resend cooldown (the web form uses 60s) or users hit a confusing 429. |
| **Link TTL** | 15 minutes (`magicLink({ expiresIn: 900 })`). Say so on the "check your inbox" screen, like the web does. |
| **Browser bounce** | The email link opens the system browser for a moment before redirecting to `ninjaprm://`. Unavoidable with custom schemes. **Universal Links / App Links** (AASA + assetlinks.json on the PRM domain) would remove the bounce — worth doing post-v1, not in v1. |
| **New users** | Magic link **creates accounts automatically** (the web copy says so). A brand-new user has `onboardingCompleted: false`, which only affects the *web* layout redirect — `/api/v1/me` and the recordings endpoints don't check it. If v1 should refuse un-onboarded users, that's a product decision to make explicitly. |
| **`nextCookies()` ordering** | Currently first in `ref/prm/src/auth.ts`; should be last. Changing it touches web login — re-test web sign-in. |
| **Email deliverability** | `RESEND_API_KEY` + a verified sender must be set on whatever environment we test against, or nothing arrives. |
| **Don't build a reviewer bypass yet** | Ninja CRM Mobile shipped a gated `POST /api/reviewer-login` backdoor for App Store review. If we submit to the stores, we'll need the same thing — but it is a deliberate, time-boxed backdoor, added at submission time and killed after approval. Not now. |
