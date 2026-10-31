// Server only: checks Firebase ID tokens from Google sign-in with jose. Import from route handlers, never from a client component.
import { createRemoteJWKSet, jwtVerify } from "jose";
import { normalizeEmail } from "@/lib/auth/password";

// Google publishes the keys that sign Firebase ID tokens here. jose caches the key set between calls.
const FIREBASE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

const GOOGLE_PROVIDER = "google.com";
const MAX_UID_LENGTH = 128;
const CLOCK_TOLERANCE_S = 60;

export type FirebaseIdentity = {
  uid: string;
  email: string;
  name: string | null;
  picture: string | null;
};

/**
 * Verifies a Firebase ID token issued for a Google sign-in and returns the identity it proves.
 * Throws on any failure. The message is a short reason for the server log and never contains the token.
 */
export async function verifyFirebaseIdToken(idToken: string): Promise<FirebaseIdentity> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("NEXT_PUBLIC_FIREBASE_PROJECT_ID is not set");

  const { payload } = await jwtVerify(idToken, FIREBASE_JWKS, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
    algorithms: ["RS256"],
    clockTolerance: CLOCK_TOLERANCE_S,
  });

  const uid = payload.sub;
  if (typeof uid !== "string" || uid.length === 0 || uid.length > MAX_UID_LENGTH) {
    throw new Error("subject claim is missing or malformed");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (typeof payload.auth_time !== "number" || payload.auth_time > nowSeconds + CLOCK_TOLERANCE_S) {
    throw new Error("auth_time claim is missing or in the future");
  }

  if (typeof payload.email !== "string" || payload.email.length === 0) {
    throw new Error("email claim is missing");
  }
  if (payload.email_verified !== true) {
    throw new Error("email is not verified");
  }

  const firebase = payload.firebase as { sign_in_provider?: unknown } | undefined;
  if (firebase?.sign_in_provider !== GOOGLE_PROVIDER) {
    throw new Error("token was not issued for Google sign-in");
  }

  return {
    uid,
    email: normalizeEmail(payload.email),
    name: typeof payload.name === "string" ? payload.name : null,
    picture: typeof payload.picture === "string" ? payload.picture : null,
  };
}
