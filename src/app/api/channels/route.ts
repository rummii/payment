import {
  ensureDefaultChannels,
  getActiveChannels,
  publicChannelDto,
} from "@/payments/channels";

/**
 * GET /api/channels — public, secret-free catalog of active payment
 * channels (tabs in the payment modal, in display order).
 */
export async function GET() {
  await ensureDefaultChannels();
  const channels = await getActiveChannels();
  return Response.json({
    channels: channels
      .filter((c) => c.credentialReady)
      .map(publicChannelDto),
  });
}
