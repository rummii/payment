// Client-facing session auth: bcrypt-hashed PINs + httpOnly JWT cookie.

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { env } from "./env";
import { db } from "./db";
import { hashSecret, randomToken, sha256, verifySecret } from "./hash";

export { hashSecret, randomToken, sha256, verifySecret };

const secretKey = new TextEncoder().encode(env.authSecret);
export const SESSION_COOKIE = "billing_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export async function createSessionToken(
  clientId: string,
  email: string
): Promise<string> {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(clientId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey);
}

export async function readSessionToken(
  token: string
): Promise<{ clientId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    if (!payload.sub) return null;
    return { clientId: payload.sub };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

/** Resolve the logged-in client from the session cookie (server context). */
export async function getSessionClient() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await readSessionToken(token);
  if (!session) return null;
  return db.client.findUnique({ where: { id: session.clientId } });
}

/** Create + persist a single-use magic link, returns the raw URL path token. */
export async function issueMagicLink(clientId: string): Promise<string> {
  const token = randomToken(32);
  await db.magicLinkToken.create({
    data: {
      tokenHash: sha256(token),
      clientId,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });
  return token;
}

export async function consumeMagicLink(token: string): Promise<string | null> {
  const record = await db.magicLinkToken.findUnique({
    where: { tokenHash: sha256(token) },
  });
  if (!record) return null;
  if (record.usedAt || record.expiresAt.getTime() < Date.now()) return null;
  await db.magicLinkToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });
  return record.clientId;
}
