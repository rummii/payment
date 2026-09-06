export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startInServerCron } = await import("@/lib/cronScheduler");
  startInServerCron();
}
