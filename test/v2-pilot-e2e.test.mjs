// End-to-end verification, 100% full-coverage governance audit (E1-E4), S1 8-scenario fault-injection TCK,
// PreToolUse anti-cheat guard, and automated mutation kill suite for the bank-wealth-demo co-arising 2.0 pilot.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { evaluateWriteGuard } from '../tools/coarising-guard-write.mjs';
import { runV2VerifyGate } from '../../metarch-truthsrc/lib/v2/verify-gate.mjs';
import { auditFullCoverageV2 } from '../../metarch-truthsrc/lib/v2/coverage-audit.mjs';
import { runThreePhaseEffectTck } from '../../metarch-truthsrc/lib/v2/effect-tck.mjs';
import { createEffectAdapter } from '../v2-pilot/handwritten/ta-effect-adapter.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PILOT_DIR = join(ROOT, 'v2-pilot');
const CANONICAL_FILE = join(PILOT_DIR, '.truthsrc/canonical-v2.json');
const DB_FILE = join(PILOT_DIR, '.truthsrc/knowledge.sqlite');
const COVERAGE_MANIFEST = join(PILOT_DIR, 'governance/coverage-manifest.json');

test('v2 pilot passes full Stop Hook gate across TypeScript (6 suites incl. interfaces HTTP) + Scala (6 suites) + Onion DIP and records SQLite provenance', () => {
  const gate = runV2VerifyGate({
    rootDir: PILOT_DIR,
    targets: ['typescript', 'scala'],
    canonicalFile: CANONICAL_FILE,
    dbFile: DB_FILE,
    strict: true,
  });

  assert.equal(gate.passed, true, JSON.stringify(gate, null, 2));
  assert.equal(gate.manifestCheck.passed, true);
  assert.equal(gate.manifestCheck.verifiedFiles, 17);
  assert.equal(gate.tsCheck.passed, true);
  assert.equal(gate.tsCheck.specFiles.length, 6);
  assert.equal(gate.scalaCheck.passed, true);
  assert.equal(gate.scalaCheck.suiteClasses.length, 6);
  assert.equal(gate.onionCheck.passed, true);
  assert.equal(gate.provenanceCheck.passed, true);
  assert.equal(gate.provenanceCheck.clozeSlots.every(s => !s.unimplemented), true);

  // Confirm SQLite dependency graph has recorded provenance on all 3 Channel 4B @cloze slots
  const db = new DatabaseSync(DB_FILE, { readOnly: true });
  try {
    const slots = db.prepare('SELECT slot_id, provenance FROM cloze_slots ORDER BY slot_id').all();
    assert.equal(slots.length, 3);
    for (const row of slots) {
      const prov = JSON.parse(row.provenance);
      assert.equal(prov.passed, true);
    }
  } finally {
    db.close();
  }
});

test('full-coverage governance audit achieves 100% classification across all 76 files (36 legacy handwritten + 40 v2-pilot Onion 5-layer) with 0 arch violations', () => {
  const audit = auditFullCoverageV2({
    rootDir: ROOT,
    manifestFile: COVERAGE_MANIFEST,
    dbFile: DB_FILE,
  });

  assert.equal(audit.passed, true, JSON.stringify(audit.diagnostics, null, 2));
  assert.equal(audit.totalGovernedFiles, 76);
  assert.equal(audit.classifiedFiles, 76);
  assert.equal(audit.coverageRatio, 1);
  assert.equal(audit.effectBindingSummary.importViolations, 0);
  assert.equal(audit.countsByEvidence.E4, 2);
  assert.equal(audit.dbRecord.count, 76);

  const db = new DatabaseSync(DB_FILE, { readOnly: true });
  try {
    const rows = db.prepare('SELECT COUNT(*) AS n FROM file_coverage').get();
    assert.equal(rows.n, 76);
  } finally {
    db.close();
  }
});

test('S1 8-scenario fault-injection TCK passes 8/8 on ta-effect-adapter and kills blind timeout-refund mutant', () => {
  const green = runThreePhaseEffectTck(createEffectAdapter);
  assert.equal(green.passed, true, JSON.stringify(green.results.filter(r => !r.passed), null, 2));
  assert.equal(green.passedCount, 8);

  // S1 Mutant: blindly triggering independent refund on UNKNOWN_TIMEOUT without absence proof MUST be killed by TCK-04
  const blindRefundMutantFactory = deps => {
    const base = createEffectAdapter(deps);
    return {
      ...base,
      submit(key, payload) {
        const res = base.submit(key, payload);
        if (res.status === 'PENDING_RECONCILE') {
          deps.downstream.triggerCompensation(key, 'BLIND_TIMEOUT_REFUND');
        }
        return res;
      },
    };
  };
  const mutantRes = runThreePhaseEffectTck(blindRefundMutantFactory);
  assert.equal(mutantRes.passed, false);
  assert.ok(mutantRes.failedIds.includes('TCK-04-TIMEOUT-NO-BLIND-COMPENSATION'));
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

    // Mutant 4: TA Bridge blind refund on timeout violating [TA-BR-05] SHALL NOT dispatch RequestIndependentRefund
    const m4 = runMutant('m4-ta-bridge-blind-refund', dir => {
      const p = join(dir, 'handwritten/ta-bridge-settlement.cloze.ts');
      const src = readFileSync(p, 'utf8');
      const mutated = src.replace(
        '    return {\n      ok: true,\n      ruleId: "TA-BR-05",',
        '    effects.dispatch("FundOrder.RequestIndependentRefund", sanitized);\n    return {\n      ok: true,\n      ruleId: "TA-BR-05",',
      );
      assert.notEqual(mutated, src);
      writeFileSync(p, mutated, 'utf8');
    });
    assert.equal(m4.passed, false, 'Mutant 4 (TA bridge blind timeout refund) must be killed');
    assert.ok(m4.tsCheck.failedSpecIds.includes('TA-BR-05'));

    // Mutant 5: Tampering with locked BDD oracle caught by SHA-256 manifest check
    const m5 = runMutant('m5-locked-oracle-tamper', dir => {
      const p = join(dir, 'generated-tests/ts/fund-quota-reserve-subscription-quota.ears.spec.ts');
      writeFileSync(p, readFileSync(p, 'utf8') + '\n// unauthorized edit\n', 'utf8');
    });
    assert.equal(m5.passed, false, 'Mutant 5 (locked oracle tamper) must be killed');
    assert.equal(m5.manifestCheck.passed, false);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});
