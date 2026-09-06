import { NextResponse, type NextRequest } from "next/server";
import { consumeMagicLink, createSessionToken } from "@/lib/auth";

/**
 * Magic-link handoff: GET /api/auth/magic/<token>
 * Single-use, 15-minute TTL — lands the user pre-authenticated on the SPA.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params;
  const clientId = await consumeMagicLink(token);
  if (!clientId) {
    return NextResponse.redirect(new URL("/login?error=expired", req.url));
  }
  const client = await dbFind(clientId);
  if (!client) {
    return NextResponse.redirect(new URL("/login?error=expired", req.url));
  }
  const jwt = await createSessionToken(client.id, client.email);
  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.set("billing_session", jwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}

async function dbFind(clientId: string) {
  const { db } = await import("@/lib/db");
  return db.client.findUnique({ where: { id: clientId } });
}
