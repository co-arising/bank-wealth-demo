// End-to-end verification, PreToolUse anti-cheat guard, and automated mutation kill suite
// for the bank-wealth-demo co-arising 2.0 EARS-native pilot.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { evaluateWriteGuard } from '../tools/coarising-guard-write.mjs';
import { runV2VerifyGate } from '../../metarch-truthsrc/lib/v2/verify-gate.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PILOT_DIR = join(ROOT, 'v2-pilot');
const CANONICAL_FILE = join(PILOT_DIR, '.truthsrc/canonical-v2.json');
const DB_FILE = join(PILOT_DIR, '.truthsrc/knowledge.sqlite');

test('v2 pilot passes full Stop Hook triple gate across TypeScript + Scala and records SQLite provenance', () => {
  const gate = runV2VerifyGate({
    rootDir: PILOT_DIR,
    targets: ['typescript', 'scala'],
    canonicalFile: CANONICAL_FILE,
    dbFile: DB_FILE,
  });

  assert.equal(gate.passed, true, JSON.stringify(gate, null, 2));
  assert.equal(gate.manifestCheck.passed, true);
  assert.equal(gate.manifestCheck.verifiedFiles, 8);
  assert.equal(gate.tsCheck.passed, true);
  assert.equal(gate.tsCheck.specFiles.length, 3);
  assert.equal(gate.scalaCheck.passed, true);
  assert.equal(gate.scalaCheck.suiteClasses.length, 2);
  assert.equal(gate.provenanceCheck.passed, true);
  assert.equal(gate.provenanceCheck.clozeSlots.every(s => !s.unimplemented), true);

  // Confirm SQLite dependency graph has recorded provenance on both Channel 4B @cloze slots
  const db = new DatabaseSync(DB_FILE, { readOnly: true });
  try {
    const slots = db.prepare('SELECT slot_id, provenance FROM cloze_slots ORDER BY slot_id').all();
    assert.equal(slots.length, 2);
    for (const row of slots) {
      const prov = JSON.parse(row.provenance);
      assert.equal(prov.passed, true);
    }
  } finally {
    db.close();
  }
});

test('PreToolUse anti-cheat guard enforces locked v2 territories and @cloze boundaries', () => {
  const lockedScaffold = evaluateWriteGuard({
    tool_input: { file_path: 'v2-pilot/generated-scaffold/ts/fund-quota.behavior.ts' },
  }, { rootDir: ROOT });
  assert.equal(lockedScaffold.allowed, false);
  assert.equal(lockedScaffold.code, 'TERRITORY_LOCKED');

  const lockedTests = evaluateWriteGuard({
    tool_input: { file_path: 'v2-pilot/generated-tests/ts/cash-fund-purchase.ears.spec.ts' },
  }, { rootDir: ROOT });
  assert.equal(lockedTests.allowed, false);
  assert.equal(lockedTests.code, 'TERRITORY_LOCKED');

  const outOfBounds = evaluateWriteGuard({
    tool_input: {
      file_path: 'v2-pilot/handwritten/cash-fund-purchase.cloze.ts',
      old_string: 'import { dec, decCmp } from "../generated-scaffold/ts/exact.ts";',
      new_string: '// mutated import',
    },
  }, { rootDir: ROOT, activeCloze: 'cash-fund-purchase' });
  assert.equal(outOfBounds.allowed, false);
  assert.equal(outOfBounds.code, 'CLOZE_OUT_OF_BOUNDS');

  const markerTamper = evaluateWriteGuard({
    tool_input: {
      file_path: 'v2-pilot/handwritten/cash-fund-purchase.cloze.ts',
      old_string: '// @cloze:start(cash-fund-purchase)',
      new_string: '// removed marker',
    },
  }, { rootDir: ROOT, activeCloze: 'cash-fund-purchase' });
  assert.equal(markerTamper.allowed, false);
  assert.equal(markerTamper.code, 'CLOZE_MARKER_TAMPER');

  const insideCloze = evaluateWriteGuard({
    tool_input: {
      file_path: 'v2-pilot/handwritten/cash-fund-purchase.cloze.ts',
      old_string: 'return { ok: false, code: "CASH_SOURCE_CONFLICT", ruleId: "US-CFP-05" };',
      new_string: 'return { ok: false, code: "CASH_SOURCE_CONFLICT", ruleId: "US-CFP-05" };',
    },
  }, { rootDir: ROOT, activeCloze: 'cash-fund-purchase' });
  assert.equal(insideCloze.allowed, true);
});

test('mutation kill gate: locked BDD oracles catch 100% of injected L2/application bugs and test tampering', () => {
  const work = mkdtempSync(join(tmpdir(), 'coarising-v2-mutants-'));
  try {
    const runMutant = (name, mutateFn) => {
      const copyDir = join(work, name);
      cpSync(PILOT_DIR, copyDir, { recursive: true });
      mutateFn(copyDir);
      return runV2VerifyGate({
        rootDir: copyDir,
        targets: ['typescript'],
        canonicalFile: join(copyDir, '.truthsrc/canonical-v2.json'),
      });
    };

    // Mutant 1: L2 QF_NIA floor-division off-by-one (> 0 mutated to >= 0)
    const m1 = runMutant('m1-qf-nia-off-by-one', dir => {
      const p = join(dir, 'handwritten/fund-order-confirm-tashares.cloze.ts');
      const src = readFileSync(p, 'utf8');
      const mutated = src.replace('decCmp(decMul(nextSharesDec, navDec), netAmountDec) > 0', 'decCmp(decMul(nextSharesDec, navDec), netAmountDec) >= 0');
      assert.notEqual(mutated, src);
      writeFileSync(p, mutated, 'utf8');
    });
    assert.equal(m1.passed, false, 'Mutant 1 (QF_NIA off-by-one) must be killed');
    assert.equal(m1.tsCheck.passed, false);

    // Mutant 2: Application replay bug violating SHALL NOT dispatch Settlement (US-CFP-04)
    const m2 = runMutant('m2-replay-double-dispatch', dir => {
      const p = join(dir, 'handwritten/cash-fund-purchase.cloze.ts');
      const src = readFileSync(p, 'utf8');
      const mutated = src.replace(
        'if (externs.payloadMatchesOriginal(principal, clientRequestId, fundCode, sanitizedPayload.amount)) {\n      return {',
        'if (externs.payloadMatchesOriginal(principal, clientRequestId, fundCode, sanitizedPayload.amount)) {\n      effects.dispatch("FundOrder.RequestFundPurchaseSettlement", sanitizedPayload);\n      return {',
      );
      assert.notEqual(mutated, src);
      writeFileSync(p, mutated, 'utf8');
    });
    assert.equal(m2.passed, false, 'Mutant 2 (SHALL NOT dispatch violation) must be killed');
    assert.ok(m2.tsCheck.failedSpecIds.includes('US-CFP-04'));

    // Mutant 3: Wrong rejection code on conflict branch (US-CFP-05)
    const m3 = runMutant('m3-wrong-conflict-code', dir => {
      const p = join(dir, 'handwritten/cash-fund-purchase.cloze.ts');
      const src = readFileSync(p, 'utf8');
      const mutated = src.replace('code: "CASH_SOURCE_CONFLICT"', 'code: "INVALID_CASH_SUBMIT"');
      assert.notEqual(mutated, src);
      writeFileSync(p, mutated, 'utf8');
    });
    assert.equal(m3.passed, false, 'Mutant 3 (wrong conflict error code) must be killed');
    assert.ok(m3.tsCheck.failedSpecIds.includes('US-CFP-05'));

    // Mutant 4: Tampering with locked BDD oracle caught by SHA-256 manifest check
    const m4 = runMutant('m4-locked-oracle-tamper', dir => {
      const p = join(dir, 'generated-tests/ts/fund-quota-reserve-subscription-quota.ears.spec.ts');
      writeFileSync(p, readFileSync(p, 'utf8') + '\n// unauthorized edit\n', 'utf8');
    });
    assert.equal(m4.passed, false, 'Mutant 4 (locked oracle tamper) must be killed');
    assert.equal(m4.manifestCheck.passed, false);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});
