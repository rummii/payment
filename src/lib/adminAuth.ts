// Admin authorization — any route/page under /admin funnels through here.

import { getSessionClient } from "./auth";
import type { Client } from "@prisma/client";

/**
 * Resolve the logged-in admin. Returns null when there is no session or the
 * client lacks the isAdmin flag — callers respond with 403 / redirect.
 */
export async function requireAdmin(): Promise<Client | null> {
  const client = await getSessionClient();
  if (!client || !client.isAdmin) return null;
  return client;
}
