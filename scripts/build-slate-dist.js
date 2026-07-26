#!/usr/bin/env node
// Assembles a Zoho Catalyst Slate deployment artifact at <repo root>/dist.
//
// Slate is a static-build-and-serve service: it runs a build command, then
// serves whatever's in the configured build path, with no rewrite/fallback
// support for arbitrary paths. apps/web/next.config.js sets
// output: 'export' so `next build` produces a full static site (every
// route is a client component with no server-only features — the old
// per-record [id] routes were replaced with query-string routes, e.g.
// /persons/view?id=..., specifically so this works). This script just
// stages that static export at dist/, which is what Slate's build path
// should point at. Doesn't touch `next dev`, `next build`, or `next start`
// — Vercel and local dev are unaffected.
//
// Catalyst Slate config should be set to:
//   build path: dist
'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const exportDir = path.join(repoRoot, 'apps', 'web', 'out');
const distDir = path.join(repoRoot, 'dist');

function run(cmd) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { cwd: repoRoot, stdio: 'inherit' });
}

run('npm run build --workspace apps/web');

if (!fs.existsSync(exportDir)) {
  console.error(
    `\nExpected static export output at ${exportDir} but it doesn't exist. ` +
      `Check that apps/web/next.config.js still has output: 'export'.`,
  );
  process.exit(1);
}

console.log(`\nStaging ${distDir} ...`);
fs.rmSync(distDir, { recursive: true, force: true });
fs.cpSync(exportDir, distDir, { recursive: true });

if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  console.error(`\ndist/index.html is missing after staging — static export layout may have changed.`);
  process.exit(1);
}

console.log(`\ndist/ ready — a static site, servable by any static file host.`);
