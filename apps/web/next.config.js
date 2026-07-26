const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pins the workspace root explicitly — this machine's home directory (an
  // unrelated project) has its own package-lock.json, which Next.js would
  // otherwise mistake for the monorepo root.
  outputFileTracingRoot: path.join(__dirname, '../../'),
  // Static HTML export: every route is a client component with no
  // server-only features (no API routes, no middleware, no dynamic
  // segments without generateStaticParams — see app/*/view/page.tsx for
  // the query-string-based replacements for the old [id] routes), so this
  // works with zero functional loss. Needed for static-only hosts (e.g.
  // Zoho Catalyst Slate); Vercel serves a static export natively too.
  output: 'export',
  // next/image's optimizer requires a running server; unused here (no
  // next/image in the app) but set for correctness under static export.
  images: { unoptimized: true },
};

module.exports = nextConfig;
