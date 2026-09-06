import { randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { db } from "@/lib/db";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });

  const endpoints = await db.webhookEndpoint.findMany({
    include: { deliveries: { orderBy: { createdAt: "desc" }, take: 5 } },
    orderBy: { createdAt: "asc" },
  });
  return Response.json({
    endpoints: endpoints.map((e) => ({
      id: e.id,
      url: e.url,
      events: e.events,
      isActive: e.isActive,
      createdAt: e.createdAt,
      recentDeliveries: e.deliveries.map((d) => ({
        id: d.id,
        event: d.event,
        status: d.status,
        attempts: d.attempts,
        lastError: d.lastError,
        createdAt: d.createdAt,
      })),
    })),
  });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as {
    url?: string;
    events?: string;
    secret?: string;
  } | null;
  const url = String(body?.url ?? "").trim();
  if (!/^https?:\/\//.test(url)) {
    return Response.json({ error: "A valid http(s) URL is required" }, { status: 400 });
  }
  const secret =
    body?.secret?.trim() || `whsec_${randomBytes(24).toString("hex")}`;
  const endpoint = await db.webhookEndpoint.create({
    data: { url, events: body?.events?.trim() || "*", secret },
  });
  return Response.json(
    { endpoint: { id: endpoint.id, url: endpoint.url, events: endpoint.events, secret: endpoint.secret } },
    { status: 201 }
  );
}
