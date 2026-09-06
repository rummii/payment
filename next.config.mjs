/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep native/CLI-ish packages out of the bundler graph.
  serverExternalPackages: ["@prisma/client", "bcryptjs", "node-cron"],
  eslint: {
    // Linting is handled by `npm run lint` (tsc --noEmit) separately.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
