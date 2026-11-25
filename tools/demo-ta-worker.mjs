#!/usr/bin/env node
/**
 * Local interactive-demo Mock TA worker.
 * Speaks the line-delimited JSON stdin/stdout protocol expected by MockTAClient.scala,
 * reusing simulator/mock-ta-core.mjs and the 7-scenario fixture in test/fixtures/truthsrc-actor-ta.json.
 * Not used by formal workshop/acceptance verifiers.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PersistentMockTACore } from '../simulator/mock-ta-core.mjs';
import { canonicalJson, exactObject, safeTick } from '../simulator/contract.mjs';

const BANK_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_PATH = path.join(BANK_ROOT, 'test', 'fixtures', 'truthsrc-actor-ta.json');
const MAX_REQUEST_BYTES = 65536;

const [journalPath] = process.argv.slice(2);
if (!journalPath || !path.isAbsolute(journalPath)) {
  process.stderr.write('WORKER_PATH: absolute journal path required\n');
  process.exit(1);
}

const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
const ta = new PersistentMockTACore({ configuration: fixture.configuration, journalPath });

const reply = (msg) => new Promise((resolve, reject) => {
  process.stdout.write(`${canonicalJson(msg)}\n`, (err) => (err ? reject(err) : resolve()));
});

let closed = false;
function closeCleanly() {
  if (closed) return;
  closed = true;
  try { ta.close(); } catch {}
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    closeCleanly();
    process.exit(0);
  });
}

async function* requestLines(input) {
  let pending = Buffer.alloc(0);
  for await (const chunk of input) {
    let start = 0;
    while (start < chunk.length) {
      const nl = chunk.indexOf(10, start);
      const end = nl === -1 ? chunk.length : nl;
      const part = chunk.subarray(start, end);
      const size = pending.length + part.length;
      if (size > MAX_REQUEST_BYTES + 1) throw Object.assign(new Error('worker input capacity exceeded'), { code: 'WORKER_CAPACITY' });
      pending = Buffer.concat([pending, part], size);
      if (nl === -1) break;
      yield pending.at(-1) === 13 ? pending.subarray(0, -1) : pending;
      pending = Buffer.alloc(0);
      start = nl + 1;
    }
  }
  if (pending.length) yield pending.at(-1) === 13 ? pending.subarray(0, -1) : pending;
}

process.stdout.on('error', () => {});
try {
  for await (const raw of requestLines(process.stdin)) {
    const msg = JSON.parse(raw.toString('utf8'));
    safeTick(msg?.id, 'worker request sequence');
    try {
      exactObject(msg, ['id', 'op', 'input'], [], 'worker request');
      let result;
      switch (msg.op) {
        case 'submit': result = ta.submit(msg.input); break;
        case 'query': result = ta.query(msg.input); break;
        case 'advance': result = ta.advanceBusinessClock(msg.input); break;
        case 'close':
          closeCleanly();
          result = { closed: true };
          break;
        default:
          throw Object.assign(new Error(`unknown op: ${msg.op}`), { code: 'WORKER_REQUEST' });
      }
      await reply({ id: msg.id, ok: true, result });
    } catch (err) {
      await reply({ id: msg.id, ok: false, error: { code: err.code ?? 'WORKER_REQUEST', message: err.message } });
    }
    if (closed) break;
  }
  closeCleanly();
} catch (err) {
  process.exitCode = 1;
  process.stderr.write(`${err.code ?? 'WORKER_FAILURE'}: ${err.message}\n`);
  closeCleanly();
} finally {
  process.stdin.destroy();
}
