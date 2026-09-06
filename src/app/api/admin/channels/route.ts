import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import {
  ensureDefaultChannels,
  getAllChannels,
} from "@/payments/channels";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });

  await ensureDefaultChannels();
  const channels = await getAllChannels();
  return Response.json({
    channels: channels.map((c) => ({
      id: c.id,
      slug: c.slug,
      label: c.label,
      method: c.method,
      provider: c.provider,
      channelType: c.channelType,
      isActive: c.isActive,
      sortOrder: c.sortOrder,
      config: c.config,
      credentialReady: c.credentialReady,
    })),
  });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as {
    slug?: string;
    label?: string;
    method?: string;
    provider?: string;
    channelType?: string;
    sortOrder?: number;
    config?: Record<string, unknown>;
  } | null;

  const slug = String(body?.slug ?? "").trim().toLowerCase();
  const label = String(body?.label ?? "").trim();
  const method = String(body?.method ?? "").trim().toUpperCase();
  const provider = String(body?.provider ?? "").trim().toUpperCase();
  if (!slug || !/^[a-z0-9-]+$/.test(slug) || !label || !method || !provider) {
    return Response.json(
      { error: "slug, label, method and provider are required" },
      { status: 400 }
    );
  }
  const exists = await db.paymentChannel.findUnique({ where: { slug } });
  if (exists) return Response.json({ error: "Channel slug already exists" }, { status: 409 });

  const channel = await db.paymentChannel.create({
    data: {
      slug,
      label,
      method,
      provider,
      channelType: body?.channelType ?? "",
      sortOrder: Math.round(body?.sortOrder ?? 50),
      config: body?.config ? JSON.stringify(body.config) : null,
      isActive: false, // new channels start disabled until reviewed
    },
  });
  return Response.json({ channel }, { status: 201 });
}

import { db } from "@/lib/db";
