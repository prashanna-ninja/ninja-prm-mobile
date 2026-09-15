import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { Pressable, Text, View } from "react-native";

import { AUTH } from "@/components/login/auth-palette";
import { AuthButton } from "@/components/login/auth-button";
import { EmailField } from "@/components/login/email-field";
import { FadeIn } from "@/components/login/fade-in";
import { authClient } from "@/lib/auth-client";
import { ArrowLeft, Check, MailOpen, RefreshCw, ShieldCheck } from "@/lib/icons";
import { signInSchema } from "@/schemas/auth.schema";
import type { SignInStep, SignInValues } from "@/types/auth.types";

/**
 * Where the magic link sends the user back to. Must match, exactly:
 *   - app.json          → expo.scheme
 *   - lib/auth-client   → expoClient({ scheme })
 *   - the server's        BETTER_AUTH_TRUSTED_ORIGINS
 * Matching is `startsWith`, so the trailing `//` matters.
 */
const MAGIC_LINK_CALLBACK = "ninjaprm://";

/**
 * The backend caps /sign-in/magic-link at 3 requests per 60s
 * (rateLimit.customRules in the PRM's src/auth.ts). Matching that with a visible
 * countdown is the difference between "wait a moment" and an unexplained error.
 */
const RESEND_COOLDOWN_SECONDS = 60;

/** magicLink({ expiresIn: 900 }) on the server. Say it out loud on the screen. */
const LINK_TTL_MINUTES = 15;

/**
 * Turn a thrown send failure into something a human can act on.
 *
 * The common real-world cases, in the order they actually happen:
 *  - no network / wrong EXPO_PUBLIC_API_BASE_URL → fetch rejects with a
 *    TypeError, which is otherwise the most baffling error in the app
 *  - 403 INVALID_CALLBACKURL → the server hasn't got `ninjaprm://` in
 *    BETTER_AUTH_TRUSTED_ORIGINS (a config problem, not a user problem)
 */
function describeSendFailure(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err ?? "");

  if (/network request failed|fetch failed|failed to fetch/i.test(message)) {
    return "Can't reach Ninja PRM. Check your connection and try again.";
  }
  if (/callbackurl/i.test(message)) {
    return "Sign-in isn't configured for this app yet. Please contact your administrator.";
  }
  return message || "We couldn't send that link. Please try again.";
}

const INBOX_STEPS = [
  "Open the email we just sent",
  "Tap the secure sign-in link",
  "You'll land back here, signed in",
];

export type LoginFormState = {
  step: SignInStep;
  /** The hero copy changes with the step, so the screen owns it. */
  heroTitle: string;
  heroSubtitle: string;
};

export function useLoginForm() {
  const [step, setStep] = React.useState<SignInStep>("email");
  const [sentTo, setSentTo] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);
  const [cooldown, setCooldown] = React.useState(0);

  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "" },
    mode: "onSubmit",
  });

  const {
    control,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = form;

  // Tick the resend cooldown down to zero.
  React.useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const sendLink = React.useCallback(async (email: string) => {
    setFormError(null);

    const { error } = await authClient.signIn.magicLink({
      email,
      // All three MUST be the bare scheme. `ninjaprm://` is what the server
      // trusts (BETTER_AUTH_TRUSTED_ORIGINS) — anything else returns
      // 403 INVALID_CALLBACKURL before an email is ever sent.
      callbackURL: MAGIC_LINK_CALLBACK,
      newUserCallbackURL: MAGIC_LINK_CALLBACK,
      // ⚠️ Deliberately bare, with no query of its own. Better Auth appends
      // `?error=<code>` WITHOUT checking for an existing query string, so
      // passing "ninjaprm://?error=magic-link" yields the malformed
      // `ninjaprm://?error=magic-link?error=INVALID_TOKEN` (two `?`, no `&`).
      // Verified against production 2026-09-15. Bare in → clean
      // `ninjaprm://?error=INVALID_TOKEN` out.
      errorCallbackURL: MAGIC_LINK_CALLBACK,
    });

    if (error) {
      const message = error.message || "Failed to send sign-in link.";
      const isRateLimited =
        error.status === 429 ||
        /rate|too many/i.test(message);

      // On a rate limit the server HAS started a window, so show the cooldown
      // rather than letting the user hammer a button that can't succeed.
      if (isRateLimited) {
        setSentTo(email);
        setCooldown(RESEND_COOLDOWN_SECONDS);
        setStep("sent");
        setFormError(
          "That was a lot of requests — wait for the timer before trying again.",
        );
        return;
      }

      throw new Error(message);
    }

    setSentTo(email);
    setCooldown(RESEND_COOLDOWN_SECONDS);
    setStep("sent");
  }, []);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await sendLink(values.email.trim().toLowerCase());
    } catch (err) {
      setFormError(describeSendFailure(err));
    }
  });

  const onResend = React.useCallback(async () => {
    if (cooldown > 0 || isSubmitting) return;
    try {
      await sendLink(getValues("email").trim().toLowerCase());
    } catch (err) {
      setFormError(describeSendFailure(err));
    }
  }, [cooldown, isSubmitting, getValues, sendLink]);

  const onChangeEmail = React.useCallback(() => {
    setStep("email");
    setFormError(null);
    setCooldown(0);
  }, []);

  const hero =
    step === "email"
      ? {
          heroTitle: "Welcome back",
          heroSubtitle:
            "Every call, meeting and recording — summarised and searchable, in your pocket.",
        }
      : {
          heroTitle: "Almost there",
          heroSubtitle: "One tap in your inbox and you're in.",
        };

  return {
    step,
    ...hero,
    sheet: (
      <View>
        {step === "email" ? (
          <EmailStep
            control={control}
            error={errors.email?.message}
            formError={formError}
            submitting={isSubmitting}
            onSubmit={onSubmit}
          />
        ) : (
          <SentStep
            email={sentTo}
            cooldown={cooldown}
            resending={isSubmitting}
            formError={formError}
            onResend={onResend}
            onChangeEmail={onChangeEmail}
          />
        )}
      </View>
    ),
  };
}

/* ------------------------------------------------------------------ */
/* Step 1 — enter your email                                           */
/* ------------------------------------------------------------------ */

function EmailStep({
  control,
  error,
  formError,
  submitting,
  onSubmit,
}: {
  control: ReturnType<typeof useForm<SignInValues>>["control"];
  error?: string;
  formError: string | null;
  submitting: boolean;
  onSubmit: () => void;
}) {
  return (
    <View style={{ gap: 22 }}>
      <FadeIn delay={180}>
        <View style={{ gap: 10 }}>
          <Text
            style={{
              fontFamily: "Bricolage_700Bold",
              fontSize: 25,
              lineHeight: 31,
              letterSpacing: -0.5,
              color: AUTH.ink,
            }}
          >
            Sign in to your account
          </Text>
          <Text
            style={{
              fontFamily: "Bricolage_400Regular",
              fontSize: 15,
              lineHeight: 23,
              color: AUTH.inkSoft,
            }}
          >
            Enter your email and we'll send you a secure link to sign in — no
            password required.
          </Text>
        </View>
      </FadeIn>

      <FadeIn delay={240}>
        <View style={{ gap: 16 }}>
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <EmailField
                label="Email address"
                placeholder="you@company.com"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                onSubmitEditing={onSubmit}
                editable={!submitting}
                error={error}
              />
            )}
          />

          {formError ? <ErrorNote message={formError} /> : null}

          <AuthButton
            label={submitting ? "Sending link…" : "Login"}
            loading={submitting}
            onPress={onSubmit}
          />

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
            }}
          >
            <ShieldCheck size={14} color={AUTH.muted} strokeWidth={2} />
            <Text
              style={{
                fontFamily: "Bricolage_400Regular",
                fontSize: 13,
                color: AUTH.muted,
              }}
            >
              Secure, passwordless sign-in
            </Text>
          </View>
        </View>
      </FadeIn>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Step 2 — check your inbox                                           */
/* ------------------------------------------------------------------ */

function SentStep({
  email,
  cooldown,
  resending,
  formError,
  onResend,
  onChangeEmail,
}: {
  email: string;
  cooldown: number;
  resending: boolean;
  formError: string | null;
  onResend: () => void;
  onChangeEmail: () => void;
}) {
  return (
    <View style={{ gap: 22 }}>
      <FadeIn delay={60}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          {/* Plain style OBJECT, not the function form — NativeWind's wrapper
              drops function styles. See the note in auth-button.tsx. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Use a different email address"
            onPress={onChangeEmail}
            hitSlop={12}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: AUTH.line,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ArrowLeft size={18} color={AUTH.inkSoft} strokeWidth={2.2} />
          </Pressable>

          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: AUTH.brandSoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MailOpen size={22} color={AUTH.brand} strokeWidth={2} />
          </View>
        </View>
      </FadeIn>

      <FadeIn delay={120}>
        <View style={{ gap: 8 }}>
          <Text
            style={{
              fontFamily: "Bricolage_700Bold",
              fontSize: 25,
              lineHeight: 31,
              letterSpacing: -0.5,
              color: AUTH.ink,
            }}
          >
            Check your inbox
          </Text>
          <Text
            style={{
              fontFamily: "Bricolage_400Regular",
              fontSize: 15,
              lineHeight: 23,
              color: AUTH.inkSoft,
            }}
          >
            We sent a sign-in link to
          </Text>
          {/* The address is the hero: the user's one worry right now is
              "did I type it right?" */}
          <Text
            selectable
            style={{
              fontFamily: "Bricolage_600SemiBold",
              fontSize: 17,
              lineHeight: 23,
              color: AUTH.ink,
            }}
          >
            {email}
          </Text>
        </View>
      </FadeIn>

      <FadeIn delay={180}>
        <View
          style={{
            borderWidth: 1,
            borderColor: AUTH.line,
            borderRadius: 16,
            padding: 16,
            gap: 13,
            backgroundColor: AUTH.fieldBg,
          }}
        >
          {INBOX_STEPS.map((label, index) => (
            <View
              key={label}
              style={{ flexDirection: "row", alignItems: "center", gap: 11 }}
            >
              <View
                style={{
                  width: 21,
                  height: 21,
                  borderRadius: 11,
                  backgroundColor: AUTH.brandSoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    fontFamily: "Bricolage_600SemiBold",
                    fontSize: 11,
                    color: AUTH.brand,
                  }}
                >
                  {index + 1}
                </Text>
              </View>
              <Text
                style={{
                  flex: 1,
                  fontFamily: "Bricolage_400Regular",
                  fontSize: 14,
                  lineHeight: 20,
                  color: AUTH.inkSoft,
                }}
              >
                {label}
              </Text>
            </View>
          ))}

          <View style={{ height: 1, backgroundColor: AUTH.line, marginTop: 1 }} />

          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
            <Check size={14} color={AUTH.muted} strokeWidth={2.4} style={{ marginTop: 2 }} />
            <Text
              style={{
                flex: 1,
                fontFamily: "Bricolage_400Regular",
                fontSize: 13,
                lineHeight: 19,
                color: AUTH.muted,
              }}
            >
              The link expires in {LINK_TTL_MINUTES} minutes. Check spam if it's
              not there.
            </Text>
          </View>
        </View>
      </FadeIn>

      {formError ? <ErrorNote message={formError} /> : null}

      <FadeIn delay={240}>
        <View style={{ gap: 2 }}>
          <AuthButton
            variant="quiet"
            label={
              resending
                ? "Sending…"
                : cooldown > 0
                  ? `Resend in ${cooldown}s`
                  : "Resend the link"
            }
            loading={resending}
            disabled={cooldown > 0}
            onPress={onResend}
            icon={
              cooldown > 0 ? null : (
                <RefreshCw size={15} color={AUTH.inkSoft} strokeWidth={2.2} />
              )
            }
          />
          <AuthButton
            variant="quiet"
            label="Use a different email"
            onPress={onChangeEmail}
          />
        </View>
      </FadeIn>
    </View>
  );
}

/* ------------------------------------------------------------------ */

function ErrorNote({ message }: { message: string }) {
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        backgroundColor: AUTH.dangerSoft,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
      }}
    >
      <Text
        style={{
          fontFamily: "Bricolage_400Regular",
          fontSize: 13,
          lineHeight: 19,
          color: AUTH.danger,
        }}
      >
        {message}
      </Text>
    </View>
  );
}
