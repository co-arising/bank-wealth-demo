#!/usr/bin/env node
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireFileLease } from '../../metarch-truthsrc/lib/verification/lease.mjs';
import { inventoryEvidence, compareEvidenceInventories } from '../../metarch-truthsrc/lib/verification/inventory.mjs';
import { safePath } from './truthsrc-evidence.mjs';
import { assertRuntimePortFree } from './truthsrc-runtime-lease.mjs';
import { OwnedRuntimeDatabases } from './truthsrc-runtime-databases.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TOOL = resolve(ROOT, '../metarch-truthsrc');
const pause = ms => new Promise(done => setTimeout(done, ms));
const usage = 'bank-database-relay --owner NEW_OWNER --mysql-port PORT --mongo-port PORT --evidence ABSENT_OWNER_ROOT --shared-registry ABSOLUTE_REGISTRY\n' +
  'Foreground owned database relays only; no JVM or business acceptance. SIGINT/SIGTERM closes this owner. Data and failure receipts are retained.\n';

async function main(args) {
  if (args.length === 1 && args[0] === '--help') { process.stdout.write(usage); return; }
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    assert.ok(['--owner', '--mysql-port', '--mongo-port', '--evidence', '--shared-registry'].includes(key) &&
      !Object.hasOwn(options, key) && typeof args[i + 1] === 'string' && !args[i + 1].startsWith('--'), 'Invalid or duplicate option.');
    options[key] = args[i + 1];
  }
  assert.equal(Object.keys(options).length, 5, 'All five options are required.');
  const owner = options['--owner'], evidence = options['--evidence'];
  assert.match(owner, /^[a-z][a-z0-9_-]{0,59}$/);
  const ports = Object.fromEntries(['mysql', 'mongo'].map(kind => {
    assert.match(options['--' + kind + '-port'], /^[1-9][0-9]{3,4}$/);
    const port = Number(options['--' + kind + '-port']);
    assert.ok(port > 1024 && port <= 65535 && ![9000, 2551, 3306, 27017].includes(port));
    return [kind, port];
  }));
  assert.notEqual(ports.mysql, ports.mongo);
  assert.equal(evidence, join(ROOT, 'target', 'truthsrc-runtime-' + owner));
  safePath(evidence, 'new'); safePath(options['--shared-registry']);
  const registry = join(ROOT, 'target/truthsrc-runtime-leases');
  const roots = [join(ROOT, 'tools'), join(TOOL, 'lib')];
  const before = Object.fromEntries(roots.map(root => [root, inventoryEvidence(root)]));
  const record = { owner, pid: process.pid, evidence, ports, token: randomBytes(24).toString('hex'), acquiredAt: new Date().toISOString() };
  const result = { schemaVersion: 'bank.database-relay-cli/v1', owner, evidence, scope: 'database-relay-only',
    passed: false, ready: false, stoppedByUser: false, inputsUnchanged: false, resourcesExited: false, leaseReleased: false,
    runtimeVerified: false, dataPreserved: true, failure: null };
  const cancellation = new AbortController(), cancel = () => { result.stoppedByUser = true; cancellation.abort(); };
  let slot, held, databases, created = false;
  const save = (name, value) => writeFileSync(join(evidence, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  process.on('SIGINT', cancel); process.on('SIGTERM', cancel);
  try {
    slot = await acquireFileLease({ registry: options['--shared-registry'], lockNames: ['jvm-slot'], usedName: owner + '-used', record });
    held = await acquireFileLease({ registry, record, lockNames: ['owner-' + owner + '.lock',
      ...Object.values(ports).sort((a, b) => a - b).map(port => 'port-' + port + '.lock')], usedName: 'owner-' + owner + '.used.json',
      preflight: async () => { for (const port of Object.values(ports)) await assertRuntimePortFree(port); safePath(evidence, 'new'); } });
    mkdirSync(evidence, { mode: 0o700 }); created = true;
    save('owner.json', record); save('inputs-before.json', before);
    const databaseRoot = join(evidence, 'databases'); mkdirSync(databaseRoot, { mode: 0o700 });
    databases = new OwnedRuntimeDatabases({ evidence: databaseRoot, owner, mysqlPort: ports.mysql, mongoPort: ports.mongo, signal: cancellation.signal });
    const endpoints = await databases.start();
    cancellation.signal.throwIfAborted(); held.assertHeld(); slot.assertHeld();
    result.ready = true;
    const ready = { schemaVersion: result.schemaVersion, owner, pid: process.pid, evidence, scope: result.scope,
      host: '127.0.0.1', ports, containers: Object.fromEntries(['mysql', 'mongo'].map(kind => [kind, endpoints[kind].containerId])) };
    save('ready.json', ready); console.log(JSON.stringify({ status: 'ready', ...ready }));
    while (!cancellation.signal.aborted) { held.assertHeld(); slot.assertHeld(); await pause(100); }
  } catch {
    result.failure = { code: 'DATABASE_RELAY_BLOCKED', message: 'Owned database relay operation failed. Retain evidence and data.' };
  } finally {
    try {
      if (databases) {
        const closed = await databases.stop();
        result.resourcesExited = (closed.resourcesExited ?? closed.stopped) === true;
        if (!closed.stopped) result.failure ??= { code: 'DATABASE_RELAY_CLOSE_FAILED', message: 'Database or exec closure was not verified; failure retained independently of physical resource exit.' };
      } else result.resourcesExited = true;
    } catch { result.failure ??= { code: 'DATABASE_RELAY_CLOSE_FAILED', message: 'Database closure failed; retain owner leases.' }; }
    try {
      const after = Object.fromEntries(roots.map(root => [root, inventoryEvidence(root)]));
      for (const root of roots) compareEvidenceInventories(before[root], after[root]);
      result.inputsUnchanged = true;
      if (created) save('inputs-after.json', after);
    } catch { result.failure ??= { code: 'DATABASE_RELAY_INPUTS_CHANGED', message: 'Relay support inputs changed.' }; }
    try {
      if (result.resourcesExited) { held?.release(); slot?.release(); result.leaseReleased = true; }
    } catch { result.failure ??= { code: 'DATABASE_RELAY_LEASE_CHANGED', message: 'Owner lease could not be released safely.' }; }
    process.off('SIGINT', cancel); process.off('SIGTERM', cancel);
    result.passed = result.ready && result.stoppedByUser && result.inputsUnchanged && result.resourcesExited && result.leaseReleased && !result.failure;
    if (created) save('closed.json', result);
    console.log(JSON.stringify(result)); process.exitCode = result.passed ? 0 : 2;
  }
}

main(process.argv.slice(2)).catch(() => {
  console.error('Database relay options or admission rejected. Use --help; no raw errors or credentials are printed.');
  process.exitCode = 2;
});
