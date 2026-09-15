/**
 * Public runtime config.
 *
 * `EXPO_PUBLIC_*` vars are read from `.env` at BUILD time and inlined into the
 * JS bundle. They are NOT secret — never put an API key or signing secret here.
 *
 * Set this in `.env` at the project root (copy `.env.example`), then restart
 * Metro with the cache cleared: `npx expo start -c`.
 */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "";

if (!API_BASE_URL) {
  console.warn(
    "[env] EXPO_PUBLIC_API_BASE_URL is not set. Copy .env.example to .env and " +
      "restart with `npx expo start -c`. Auth and API calls will fail until then.",
  );
}
