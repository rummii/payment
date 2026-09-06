import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { db } from "@/lib/db";
import { hashSecret } from "@/lib/hash";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });

  const q = new URL(req.url).searchParams.get("query")?.trim().toLowerCase() ?? "";
  const clients = await db.client.findMany({
    where: q
      ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] }
      : undefined,
    include: { _count: { select: { subscriptions: true } } },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  return Response.json({
    clients: clients.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      isAdmin: c.isAdmin,
      subscriptionCount: c._count.subscriptions,
      createdAt: c.createdAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as {
    name?: string;
    email?: string;
    phone?: string;
    pin?: string;
    isAdmin?: boolean;
  } | null;
  const email = String(body?.email ?? "").trim().toLowerCase();
  const name = String(body?.name ?? "").trim();
  if (!email || !name) {
    return Response.json({ error: "name and email are required" }, { status: 400 });
  }
  const exists = await db.client.findUnique({ where: { email } });
  if (exists) return Response.json({ error: "Email already registered" }, { status: 409 });

  const generatedPin = body?.pin ? null : String(Math.floor(100000 + Math.random() * 900000));
  const plainPin = body?.pin ?? generatedPin ?? undefined;
  const client = await db.client.create({
    data: {
      name,
      email,
      phone: body?.phone ?? null,
      isAdmin: Boolean(body?.isAdmin),
      pinHash: plainPin ? await hashSecret(plainPin) : null,
    },
  });
  return Response.json(
    { client: { id: client.id, email: client.email, name: client.name }, generatedPin },
    { status: 201 }
  );
}
