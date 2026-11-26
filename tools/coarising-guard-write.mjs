#!/usr/bin/env node
// Thin project wrapper delegating to first-class `truthsrc guard-write` in metarch-truthsrc.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateWriteGuard as coreEvaluateWriteGuard, parseClozeRanges } from '../../metarch-truthsrc/lib/v2/guard-write.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export { parseClozeRanges };

export function evaluateWriteGuard(payload, options = {}) {
  return coreEvaluateWriteGuard(payload, { rootDir: ROOT, ...options });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let raw = '';
  try {
    raw = readFileSync(0, 'utf8').trim();
  } catch {
    process.exit(0);
  }
  if (!raw) process.exit(0);
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (err) {
    process.stderr.write(`[coarising-guard-write] invalid hook JSON: ${err.message}\n`);
    process.exit(2);
  }
  const decision = evaluateWriteGuard(payload);
  if (!decision.allowed) {
    process.stderr.write(`[coarising-guard-write][${decision.code}] ${decision.reason}\n`);
    process.exit(2);
  }
  process.exit(0);
}
