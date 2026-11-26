import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parseEars } from '../../metarch-truthsrc/lib/ears/parser.mjs';
import { normalizeEars } from '../../metarch-truthsrc/lib/ears/normalize.mjs';
import { bindEarsSpec, loadStandaloneSymbolTable, loadSymbolTableFromProject } from '../../metarch-truthsrc/lib/ears/binder.mjs';
import { verifyEarsWithSmt } from '../../metarch-truthsrc/lib/ears/clarification-card.mjs';
import { evaluateWriteGuard } from '../tools/coarising-guard-write.mjs';
import { runClozeVerification, verifyLockedManifest } from '../tools/coarising-verify-cloze.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EARS_DIR = join(ROOT, 'truth/ears');

const BILINGUAL_PAIRS = [
  ['fund-order-settlement.ears', 'fund-order-settlement.zh.ears'],
  ['fund-order-refund.ears', 'fund-order-refund.zh.ears'],
  ['fund-quota-reserve.ears', 'fund-quota-reserve.zh.ears'],
  ['fund-order-confirm-ta-shares.ears', 'fund-order-confirm-ta-shares.zh.ears'],
  ['sip-plan-stream-batch.ears', 'sip-plan-stream-batch.zh.ears'],
  ['cash-fund-purchase.story.ears', 'cash-fund-purchase.story.zh.ears'],
];

test('all 6 bank-wealth-demo EN/CN benchmark pairs compile to 100% identical AST and .smt2', () => {
  for (const [enFile, cnFile] of BILINGUAL_PAIRS) {
    const enNorm = normalizeEars(parseEars(readFileSync(join(EARS_DIR, enFile), 'utf8'), { file: enFile }));
    const cnNorm = normalizeEars(parseEars(readFileSync(join(EARS_DIR, cnFile), 'utf8'), { file: cnFile }));

    assert.deepEqual(enNorm.diagnostics, [], `diagnostics in ${enFile}`);
    assert.deepEqual(cnNorm.diagnostics, [], `diagnostics in ${cnFile}`);
    assert.deepEqual(enNorm.canonicalForm, cnNorm.canonicalForm, `AST mismatch between ${enFile} and ${cnFile}`);
    assert.equal(enNorm.canonicalSha256, cnNorm.canonicalSha256, `hash mismatch between ${enFile} and ${cnFile}`);

    const enSmt = verifyEarsWithSmt(enNorm, { solver: 'z3', bmcSteps: 0, checkGaps: false });
    const cnSmt = verifyEarsWithSmt(cnNorm, { solver: 'z3', bmcSteps: 0, checkGaps: false });
    assert.equal(enSmt.combinedSmt2, cnSmt.combinedSmt2, `SMT-LIB 2 mismatch between ${enFile} and ${cnFile}`);
  }
});

test('binds FundOrder, SipPlan, CashFundPurchase to real bank-wealth truthsrc symbol table and FundQuota to standalone types', () => {
  const projectSym = loadSymbolTableFromProject(join(ROOT, 'truthsrc.project.json'));
  const standaloneSym = loadStandaloneSymbolTable(join(EARS_DIR, 'standalone-types.json'));
  for (const [k, v] of standaloneSym.aggregates) projectSym.aggregates.set(k, v);

  for (const file of ['fund-order-settlement.ears', 'fund-order-refund.ears', 'fund-quota-reserve.ears', 'sip-plan-stream-batch.ears', 'cash-fund-purchase.story.ears']) {
    const norm = normalizeEars(parseEars(readFileSync(join(EARS_DIR, file), 'utf8'), { file }));
    const bound = bindEarsSpec(norm, projectSym);
    const errors = bound.diagnostics.filter(d => d.severity === 'error');
    assert.equal(bound.bound, true, `expected ${file} to bind`);
    assert.deepEqual(errors, [], `binding errors in ${file}: ${JSON.stringify(errors)}`);
  }
});

test('Z3 verifies FundQuota 5-check green, ConfirmTAShares QF_NIA, and SipPlan 6.1 gap card + 4-step BMC', () => {
  // 3.2(1) FundQuota: full 5 checks green
  const quota = normalizeEars(parseEars(readFileSync(join(EARS_DIR, 'fund-quota-reserve.ears'), 'utf8')));
  const quotaSmt = verifyEarsWithSmt(quota, { solver: 'z3' });
  assert.equal(quotaSmt.passed, true, JSON.stringify(quotaSmt.findings, null, 2));
  assert.equal(quotaSmt.logic, 'QF_AUFLIA');
  assert.equal(quotaSmt.checks.invariants.every(i => i.passed), true);
  assert.equal(quotaSmt.checks.witnesses.length, 4);

  // 3.2(2) ConfirmTAShares: QF_NIA isolated + exact floor witnesses
  const taShares = normalizeEars(parseEars(readFileSync(join(EARS_DIR, 'fund-order-confirm-ta-shares.ears'), 'utf8')));
  const taSmt = verifyEarsWithSmt(taShares, { solver: 'z3', checkGaps: false });
  assert.equal(taSmt.logic, 'QF_NIA');
  assert.equal(taSmt.passed, true, JSON.stringify(taSmt.findings, null, 2));
  assert.equal(taSmt.checks.witnesses.length, 3);

  // 3.3 SipPlan: Z3 catches Spec 6.1 gap (plan.scheduleSealed = false) AND 4-step BMC proves skipped never resurrects
  const sip = normalizeEars(parseEars(readFileSync(join(EARS_DIR, 'sip-plan-stream-batch.ears'), 'utf8')));
  const sipSmt = verifyEarsWithSmt(sip, { solver: 'z3', bmcSteps: 4, checkGaps: true });
  const skipGap = sipSmt.findings.find(f => f.kind === 'gap' && f.command === 'SkipPausedSipDueSlot');
  assert.ok(skipGap, 'expected Z3 to catch Spec 6.1 gap on SkipPausedSipDueSlot');
  assert.ok(sipSmt.clarificationCards.some(c => c.command === 'SkipPausedSipDueSlot' && /选项 A/.test(c.markdown)));
  assert.equal(sipSmt.bmc.checked, true);
  assert.ok(sipSmt.bmc.properties.some(p => p.id.includes('bmc-no-resurrect') && p.passed), JSON.stringify(sipSmt.bmc.properties));
});

test('PreToolUse hook blocks locked territories & out-of-bounds @cloze edits with exit 2 and allows in-slot edits', () => {
  // Direct unit check on territory locks
  assert.equal(evaluateWriteGuard({ tool_input: { file_path: 'generated-tests/features/fund-quota-reserve.feature' } }).allowed, false);
  assert.equal(evaluateWriteGuard({ tool_input: { file_path: 'projections/ac/fund-quota-reserve.md' } }).allowed, false);

  // Process-level exit 2 check on generated-tests/
  const guardScript = join(ROOT, 'tools/coarising-guard-write.mjs');
  const blockedProc = spawnSync(process.execPath, [guardScript], {
    input: JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: 'generated-tests/manifest.sha256.json' } }),
    encoding: 'utf8',
  });
  assert.equal(blockedProc.status, 2);
  assert.match(blockedProc.stderr, /TERRITORY_LOCKED/);

  // Temporary sandbox with a @cloze-protected handwritten file
  const sandbox = mkdtempSync(join(tmpdir(), 'coarising-cloze-'));
  try {
    const hwDir = join(sandbox, 'handwritten/scala');
    mkdirSync(hwDir, { recursive: true });
    const hwFile = join(hwDir, 'SampleLogic.scala');
    writeFileSync(hwFile, [
      'package demo',
      'object SampleLogic {',
      '  // @cloze:start(QUOTA_CHECK)',
      '  def check(amount: Long): Boolean = amount > 0',
      '  // @cloze:end(QUOTA_CHECK)',
      '  val lockedFooter = true',
      '}',
    ].join('\n'), 'utf8');

    const inside = evaluateWriteGuard({
      tool_input: {
        file_path: 'handwritten/scala/SampleLogic.scala',
        old_string: '  def check(amount: Long): Boolean = amount > 0',
        new_string: '  def check(amount: Long): Boolean = amount >= 100',
      },
    }, { rootDir: sandbox, activeCloze: 'QUOTA_CHECK' });
    assert.equal(inside.allowed, true);

    const outside = evaluateWriteGuard({
      tool_input: {
        file_path: 'handwritten/scala/SampleLogic.scala',
        old_string: '  val lockedFooter = true',
        new_string: '  val lockedFooter = false',
      },
    }, { rootDir: sandbox, activeCloze: 'QUOTA_CHECK' });
    assert.equal(outside.allowed, false);
    assert.equal(outside.code, 'CLOZE_OUT_OF_BOUNDS');

    const markerTamper = evaluateWriteGuard({
      tool_input: {
        file_path: 'handwritten/scala/SampleLogic.scala',
        old_string: '  // @cloze:start(QUOTA_CHECK)',
        new_string: '  // removed',
      },
    }, { rootDir: sandbox, activeCloze: 'QUOTA_CHECK' });
    assert.equal(markerTamper.allowed, false);
    assert.equal(markerTamper.code, 'CLOZE_MARKER_TAMPER');
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

test('Stop hook verifies locked manifest SHA-256 + verify-handwritten-map and detects tampering with exit 2', async () => {
  const manifestPath = join(ROOT, 'generated-tests/manifest.sha256.json');
  const check = verifyLockedManifest(manifestPath);
  assert.equal(check.passed, true, JSON.stringify(check.errors));
  assert.ok(check.verifiedFiles >= 12);

  const full = await runClozeVerification({ rootDir: ROOT, skipSbt: true, skipHandwrittenMap: false });
  assert.equal(full.passed, true, JSON.stringify(full, null, 2));
  assert.equal(full.handwrittenCheck.passed, true);

  // Tamper test in isolated temp directory
  const sandbox = mkdtempSync(join(tmpdir(), 'coarising-tamper-'));
  try {
    const gt = join(sandbox, 'generated-tests');
    mkdirSync(gt, { recursive: true });
    writeFileSync(join(gt, 'sample.feature'), 'Feature: original\n', 'utf8');
    writeFileSync(join(gt, 'manifest.sha256.json'), JSON.stringify({
      schemaVersion: 'co-arising.locked-tests-manifest/v1',
      files: [{ path: 'sample.feature', sha256: '0000000000000000000000000000000000000000000000000000000000000000' }],
    }), 'utf8');
    const tampered = await runClozeVerification({ rootDir: sandbox, skipSbt: true, skipHandwrittenMap: true, provenanceOut: null });
    assert.equal(tampered.passed, false);
    assert.match(tampered.manifestCheck.errors[0], /tamper detected/);
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});
