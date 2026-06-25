#!/usr/bin/env node
/**
 * CHOS-407: deterministic client-bundle size gate.
 *
 * Sums every emitted client JS chunk under `${distDir}/static` after a
 * production build and fails if the total exceeds the budget. This is the hard,
 * version-stable bundle threshold (the Lighthouse `resource-summary:script:size`
 * assertion is a per-page complement, and @next/bundle-analyzer produces the
 * visual report for triage).
 *
 * Budget is configurable via BUNDLE_MAX_BYTES; distDir via NEXT_DIST_DIR.
 * Baseline at introduction: ~2.17 MB raw across the static chunks, so the
 * default 2.86 MB budget leaves ~30% headroom while still catching a large
 * regression (e.g. an accidental heavy dependency).
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';

const DIST = process.env.NEXT_DIST_DIR || '.next';
const STATIC_DIR = join(DIST, 'static');
const MAX_BYTES = Number(process.env.BUNDLE_MAX_BYTES || 3_000_000);

function walk(dir) {
  let files = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) files = files.concat(walk(full));
    else if (e.isFile() && e.name.endsWith('.js')) files.push(full);
  }
  return files;
}

const jsFiles = walk(STATIC_DIR);
if (jsFiles.length === 0) {
  console.error(
    `✗ No JS chunks found under ${STATIC_DIR}. Did the build run? ` +
      `(NEXT_DIST_DIR=${DIST})`,
  );
  process.exit(1);
}

let raw = 0;
let gzip = 0;
const sized = jsFiles.map((f) => {
  const buf = readFileSync(f);
  raw += buf.length;
  gzip += gzipSync(buf).length;
  return { f, size: statSync(f).size };
});

const mb = (n) => (n / 1048576).toFixed(2);
console.log(`Client JS chunks: ${jsFiles.length} files`);
console.log(`  raw:  ${mb(raw)} MB`);
console.log(`  gzip: ${mb(gzip)} MB`);
console.log(`  budget (raw): ${mb(MAX_BYTES)} MB`);

sized
  .sort((a, b) => b.size - a.size)
  .slice(0, 5)
  .forEach(({ f, size }) => console.log(`  • ${(size / 1024).toFixed(0)} KB  ${f}`));

if (raw > MAX_BYTES) {
  console.error(
    `\n✗ Bundle over budget: ${mb(raw)} MB > ${mb(MAX_BYTES)} MB. ` +
      `Investigate with \`pnpm analyze\` (opens the bundle analyzer report).`,
  );
  process.exit(1);
}
console.log(`\n✓ Bundle within budget.`);
