#!/usr/bin/env node
// Assembles a Zoho Catalyst AppSail deployment artifact at <repo root>/dist.
//
// Catalyst AppSail's "build path" is resolved relative to the synced source
// directory and must already exist by the time it's checked — Catalyst
// doesn't run `next build` for us. This script runs the normal Next.js
// build (output: 'standalone' in apps/web/next.config.js) and copies the
// result into a flat, self-contained `dist/` folder: a pruned node_modules,
// server.js, and the static/public assets standalone output leaves out.
// Doesn't touch `next dev`, `next build`, or `next start`.
//
// Catalyst AppSail config should be set to:
//   build path:        dist
//   startup command:    node server.js
'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const webDir = path.join(repoRoot, 'apps', 'web');
// outputFileTracingRoot in next.config.js is the monorepo root, so standalone
// output mirrors the path from that root down to the app.
const standaloneAppDir = path.join(webDir, '.next', 'standalone', 'apps', 'web');
const standaloneRootModules = path.join(webDir, '.next', 'standalone', 'node_modules');
const distDir = path.join(repoRoot, 'dist');

function run(cmd) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { cwd: repoRoot, stdio: 'inherit' });
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

run('npm run build --workspace apps/web');

if (!fs.existsSync(standaloneAppDir)) {
  console.error(
    `\nExpected standalone output at ${standaloneAppDir} but it doesn't exist. ` +
      `Check that apps/web/next.config.js still has output: 'standalone'.`,
  );
  process.exit(1);
}

console.log(`\nAssembling ${distDir} ...`);
fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

copyDir(standaloneAppDir, distDir);
copyDir(standaloneRootModules, path.join(distDir, 'node_modules'));
copyDir(path.join(webDir, 'public'), path.join(distDir, 'public'));
copyDir(path.join(webDir, '.next', 'static'), path.join(distDir, '.next', 'static'));

if (!fs.existsSync(path.join(distDir, 'server.js'))) {
  console.error(`\ndist/server.js is missing after assembly — standalone output layout may have changed.`);
  process.exit(1);
}

console.log(`\ndist/ ready. Run with: node dist/server.js (respects the PORT env var).`);
