const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pins the workspace root explicitly — this machine's home directory (an
  // unrelated project) has its own package-lock.json, which Next.js would
  // otherwise mistake for the monorepo root.
  outputFileTracingRoot: path.join(__dirname, '../../'),
  // Emits .next/standalone: a self-contained server (server.js + pruned
  // node_modules) instead of requiring `next start` + a full node_modules
  // on the host. Needed for Node-runtime deploy targets (e.g. Zoho Catalyst
  // AppSail) that run a prebuilt artifact rather than installing and
  // building on their own. Doesn't change `next dev` or `next start`.
  output: 'standalone',
};

module.exports = nextConfig;
