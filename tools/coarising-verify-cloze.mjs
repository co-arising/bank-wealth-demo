#!/usr/bin/env node
// Stop Hook triple verification gate for co-arising EARS 1.0 (Section 7.2):
//   1. SHA-256 tamper verification on generated-tests/manifest.sha256.json
//   2. BDD oracle verification (optional sbt *EarsSpec or skip-sbt for fast hook tests)
//   3. Reverse provenance map check via verify-handwritten-map.mjs
// Exits 2 on any failure so the agent must self-heal before stopping.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyHandwrittenMap } from './verify-handwritten-map.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function sha256File(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

export function verifyLockedManifest(manifestPath) {
  if (!existsSync(manifestPath)) {
    return { passed: false, errors: [`locked manifest missing: ${manifestPath}`], verifiedFiles: 0 };
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const baseDir = dirname(manifestPath);
  const errors = [];

  for (const entry of manifest.files ?? []) {
    const abs = resolve(baseDir, entry.path);
    if (!existsSync(abs)) {
      errors.push(`locked test file missing: ${entry.path}`);
      continue;
    }
    const actual = sha256File(abs);
    if (actual !== entry.sha256) {
      errors.push(`tamper detected in locked test file "${entry.path}" (expected ${entry.sha256.slice(0, 12)}, got ${actual.slice(0, 12)})`);
    }
  }
  return {
    passed: errors.length === 0,
    errors,
    verifiedFiles: (manifest.files ?? []).length,
    manifestSha256: sha256File(manifestPath),
  };
}

export async function runClozeVerification({
  rootDir = ROOT,
  slice = '',
  skipSbt = false,
  skipHandwrittenMap = false,
  provenanceOut = join(ROOT, '.truthsrc/ears-provenance.json'),
} = {}) {
  const manifestPath = join(rootDir, 'generated-tests/manifest.sha256.json');
  const manifestCheck = verifyLockedManifest(manifestPath);

  let sbtCheck = { skipped: true, passed: true, failedSpecs: [] };
  if (!skipSbt) {
    const sbtProjectDir = join(rootDir, 'generated/current');
    if (existsSync(join(sbtProjectDir, 'build.sbt'))) {
      const filter = slice ? `*${slice}*EarsSpec` : '*EarsSpec';
      const proc = spawnSync('sbt', [`testOnly ${filter}`], {
        cwd: sbtProjectDir,
        encoding: 'utf8',
        timeout: 180_000,
      });
      const output = `${proc.stdout ?? ''}\n${proc.stderr ?? ''}`;
      const failedSpecs = [...output.matchAll(/\[([A-Z0-9_-]+)\].*FAILED/gu)].map(m => m[1]);
      sbtCheck = {
        skipped: false,
        passed: proc.status === 0,
        exitCode: proc.status,
        failedSpecs,
      };
    } else {
      sbtCheck = { skipped: true, passed: true, reason: 'generated/current/build.sbt not materialized yet', failedSpecs: [] };
    }
  }

  let handwrittenCheck = { skipped: true, passed: true };
  if (!skipHandwrittenMap) {
    try {
      const res = await verifyHandwrittenMap();
      handwrittenCheck = { skipped: false, passed: Boolean(res.passed), files: res.files, snapshot: res.snapshot };
    } catch (err) {
      handwrittenCheck = { skipped: false, passed: false, error: err.message };
    }
  }

  const passed = manifestCheck.passed && sbtCheck.passed && handwrittenCheck.passed;
  const record = {
    schemaVersion: 'co-arising.cloze-verification/v1',
    slice: slice || null,
    passed,
    manifestCheck,
    sbtCheck,
    handwrittenCheck,
    verifiedAt: new Date().toISOString(),
  };

  if (passed && provenanceOut) {
    mkdirSync(dirname(provenanceOut), { recursive: true });
    writeFileSync(provenanceOut, JSON.stringify(record, null, 2) + '\n', 'utf8');
  }
  return record;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  let slice = '';
  let skipSbt = false;
  let skipHandwrittenMap = false;
  let asJson = false;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--slice' && args[i + 1]) { slice = args[i + 1]; i += 1; }
    else if (args[i] === '--skip-sbt') skipSbt = true;
    else if (args[i] === '--skip-handwritten-map') skipHandwrittenMap = true;
    else if (args[i] === '--json') asJson = true;
  }
  const result = await runClozeVerification({ slice, skipSbt, skipHandwrittenMap });
  if (asJson) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  }
  if (!result.passed) {
    for (const err of result.manifestCheck.errors) {
      process.stderr.write(`[coarising-verify-cloze][TAMPER] ${err}\n`);
    }
    if (!result.sbtCheck.passed) {
      process.stderr.write(`[coarising-verify-cloze][BDD_FAIL] failed @CoArisingSpec IDs: ${result.sbtCheck.failedSpecs.join(', ') || '(see sbt log)'}\n`);
    }
    if (!result.handwrittenCheck.passed) {
      process.stderr.write(`[coarising-verify-cloze][MAP_FAIL] ${result.handwrittenCheck.error}\n`);
    }
    process.exit(2);
  }
  process.exit(0);
}
