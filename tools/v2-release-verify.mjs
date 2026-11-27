#!/usr/bin/env node
/**
 * Single pilot verification & evidence lock producer for bank-wealth-demo.
 * Runs v2:audit-coverage and v2:tck, reads canonical-v2.json, knowledge.sqlite,
 * and v2-provenance.json, checks .truthsrc-pin.json, and writes a sanitized
 * machine-readable pilot-evidence.lock.json (zero local machine paths).
 */
import { createHash } from 'node:crypto';
import { execFileSync, execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const opts = {
    outFile: join(ROOT, 'v2-pilot', '.truthsrc', 'pilot-evidence.lock.json'),
    truthsrcDir: resolve(ROOT, '..', 'metarch-truthsrc'),
    strictPin: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--out' && argv[i + 1]) opts.outFile = resolve(argv[++i]);
    else if (argv[i] === '--truthsrc' && argv[i + 1]) opts.truthsrcDir = resolve(argv[++i]);
    else if (argv[i] === '--strict-pin') opts.strictPin = true;
  }
  return opts;
}

function runGit(repoDir, args) {
  const candidates = ['/Library/Developer/CommandLineTools/usr/bin/git', 'git'];
  for (const bin of candidates) {
    try {
      return execFileSync(bin, ['-C', repoDir, ...args], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    } catch {
      // try next git binary
    }
  }
  return null;
}

function sha256File(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function runJsonCommand(cmd) {
  const stdout = execSync(cmd, { cwd: ROOT, encoding: 'utf8' });
  const firstBrace = stdout.indexOf('{');
  const lastBrace = stdout.lastIndexOf('}');
  if (firstBrace < 0 || lastBrace < firstBrace) {
    throw new Error(`Expected JSON output from "${cmd}"`);
  }
  return JSON.parse(stdout.slice(firstBrace, lastBrace + 1));
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const pinPath = join(ROOT, '.truthsrc-pin.json');
  const provenancePath = join(ROOT, 'v2-pilot', '.truthsrc', 'v2-provenance.json');
  const canonicalPath = join(ROOT, 'v2-pilot', '.truthsrc', 'canonical-v2.json');
  const dbPath = join(ROOT, 'v2-pilot', '.truthsrc', 'knowledge.sqlite');

  for (const required of [pinPath, provenancePath, canonicalPath, dbPath]) {
    if (!existsSync(required)) {
      throw new Error(`Missing required pilot artifact: ${required}`);
    }
  }

  const pin = JSON.parse(readFileSync(pinPath, 'utf8'));
  const provenance = JSON.parse(readFileSync(provenancePath, 'utf8'));
  const canonicalSha256 = sha256File(canonicalPath);

  const bankCommit = runGit(ROOT, ['rev-parse', 'HEAD']);
  const bankShort = bankCommit ? bankCommit.slice(0, 7) : null;
  const bankBranch = runGit(ROOT, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const truthsrcCommit = runGit(opts.truthsrcDir, ['rev-parse', 'HEAD']);
  const truthsrcShort = truthsrcCommit ? truthsrcCommit.slice(0, 7) : null;
  const pinMatched = Boolean(truthsrcCommit && pin.commit && truthsrcCommit === pin.commit);

  const coverage = runJsonCommand('npm run v2:audit-coverage --silent');
  const tck = runJsonCommand('npm run v2:tck --silent');

  const db = new DatabaseSync(dbPath, { readOnly: true });
  let graph;
  try {
    const nodes = db.prepare('SELECT COUNT(*) AS n FROM nodes').get().n;
    const kinds = db.prepare('SELECT COUNT(DISTINCT kind) AS n FROM nodes').get().n;
    const edges = db.prepare('SELECT COUNT(*) AS n FROM edges').get().n;
    const clozeSlots = db.prepare('SELECT COUNT(*) AS n FROM cloze_slots').get().n;
    const metadataRows = db.prepare('SELECT COUNT(*) AS n FROM metadata').get().n;
    graph = { nodes, kinds, edges, clozeSlots, metadataRows };
  } finally {
    db.close();
  }

  const payloadCore = {
    schemaVersion: 'co-arising.pilot-evidence/v1',
    truthsrc: {
      pinnedCommit: pin.commit,
      pinnedVersion: pin.version,
      actualCommit: truthsrcCommit,
      actualShort: truthsrcShort,
      pinMatched,
    },
    bank: {
      commit: bankCommit,
      short: bankShort,
      branch: bankBranch,
      canonicalSha256,
    },
    graph,
    coverage: {
      passed: coverage.passed === true,
      totalGovernedFiles: coverage.totalGovernedFiles,
      classifiedFiles: coverage.classifiedFiles,
      coverageRatio: coverage.coverageRatio,
      countsByTier: coverage.countsByTier,
      countsByStage: coverage.countsByStage,
      countsByEvidence: coverage.countsByEvidence,
      importViolations: coverage.effectBindingSummary?.importViolations ?? 0,
    },
    tck: {
      protocol: tck.protocol,
      passed: tck.passed === true,
      total: tck.total,
      passedCount: tck.passedCount,
    },
    provenance: {
      passed: provenance.passed === true,
      strict: provenance.strict === true,
      canonicalSha256: provenance.canonicalSha256 ?? null,
      lockedFiles: provenance.manifestCheck?.verifiedFiles ?? 0,
      tsSuites: provenance.tsCheck?.specFiles?.length ?? 0,
      tsPassed: provenance.tsCheck?.passed === true,
      scalaSuites: provenance.scalaCheck?.suiteClasses?.length ?? 0,
      scalaPassed: provenance.scalaCheck?.passed === true,
      sbtRuntimeFilesCount: provenance.scalaCheck?.sbtRuntimeFilesCount ?? 0,
      onionCheckedFiles: provenance.onionCheck?.checkedCount ?? 0,
      onionViolations: provenance.onionCheck?.violations?.length ?? 0,
      testabilityCheckedCount: provenance.testabilityCheck?.checkedCount ?? 0,
      testabilityViolations: provenance.testabilityCheck?.violations?.length ?? 0,
      mutationTs: provenance.mutationCheck?.ts
        ? {
            total: provenance.mutationCheck.ts.total,
            killed: provenance.mutationCheck.ts.killed,
            killRate: provenance.mutationCheck.ts.killRate,
          }
        : null,
      mutationScala: provenance.mutationCheck?.scala
        ? {
            total: provenance.mutationCheck.scala.total,
            killed: provenance.mutationCheck.scala.killed,
            killRate: provenance.mutationCheck.scala.killRate,
          }
        : null,
      verifiedAt: provenance.verifiedAt ?? null,
    },
  };

  const evidenceSha256 = createHash('sha256').update(JSON.stringify(payloadCore)).digest('hex');
  const fullPayload = {
    ...payloadCore,
    evidenceSha256,
    capturedAt: new Date().toISOString(),
  };

  const serialized = JSON.stringify(fullPayload, null, 2) + '\n';
  if (/\/Users\/|\/home\//u.test(serialized)) {
    throw new Error('Private local path leaked into pilot-evidence.lock.json');
  }
  writeFileSync(opts.outFile, serialized, 'utf8');

  const failures = [];
  if (!fullPayload.coverage.passed || fullPayload.coverage.coverageRatio !== 1) {
    failures.push('coverage audit did not pass 100%');
  }
  if (!fullPayload.tck.passed) {
    failures.push('S1 effect TCK did not pass');
  }
  if (!fullPayload.provenance.passed) {
    failures.push('v2-provenance.json passed is false');
  }
  if (opts.strictPin && !pinMatched) {
    failures.push(`truthsrc commit ${truthsrcCommit} does not match .truthsrc-pin.json ${pin.commit}`);
  }

  console.log(serialized.trim());
  if (failures.length > 0) {
    console.error('Failures:', failures.join('; '));
    process.exit(1);
  }
}

main();
