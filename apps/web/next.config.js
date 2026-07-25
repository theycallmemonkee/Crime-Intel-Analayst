const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pins the workspace root explicitly — this machine's home directory (an
  // unrelated project) has its own package-lock.json, which Next.js would
  // otherwise mistake for the monorepo root.
  outputFileTracingRoot: path.join(__dirname, '../../'),
};

module.exports = nextConfig;
