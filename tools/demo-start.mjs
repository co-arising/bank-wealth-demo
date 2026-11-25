#!/usr/bin/env node
/**
 * Local interactive-demo launcher for bank-wealth-demo.
 *
 * Prerequisites:
 *   1. docker compose -f docker-compose.demo.yml up -d
 *   2. npm run project && (cd generated/current && sbt stage)   (or pass --build)
 *
 * Usage:
 *   node tools/demo-start.mjs
 *   node tools/demo-start.mjs --scenario rejected
 *   node tools/demo-start.mjs --smoke
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { exerciseProductionHttp, exerciseTransportAuth } from './truthsrc-runtime-http.mjs';

const VALID_SCENARIOS = new Set([
  'confirmed',
  'rejected',
  'delayed',
  'unknown',
  'accepted',
  'duplicate-identical',
  'duplicate-conflicting',
]);

const BANK_ROOT = fs.realpathSync.native(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const GENERATED_DIR = path.join(BANK_ROOT, 'generated', 'current');
const STAGE_BIN = path.join(GENERATED_DIR, 'target', 'universal', 'stage', 'bin', 'root');
const TA_WORKER = fs.realpathSync.native(path.join(BANK_ROOT, 'tools', 'demo-ta-worker.mjs'));
const NODE_BIN = fs.realpathSync.native(process.execPath);

function parseArgs(argv) {
  const opts = {
    scenario: 'confirmed',
    port: 19000,
    mongoPort: 19001,
    mysqlPort: 19002,
    namespace: 'bankdemo',
    mysqlSchema: 'bankdemo',
    mongoUser: 'bankdemo',
    mongoPassword: 'bankdemopass',
    mysqlUser: 'bankdemo',
    mysqlPassword: 'bankdemopass',
    build: false,
    smoke: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[++i];
    };
    switch (arg) {
      case '--scenario': opts.scenario = next(); break;
      case '--port': opts.port = Number(next()); break;
      case '--mongo-port': opts.mongoPort = Number(next()); break;
      case '--mysql-port': opts.mysqlPort = Number(next()); break;
      case '--namespace': opts.namespace = next(); break;
      case '--mysql-schema': opts.mysqlSchema = next(); break;
      case '--build': opts.build = true; break;
      case '--smoke': opts.smoke = true; break;
      case '-h':
      case '--help': opts.help = true; break;
      default: throw new Error(`Unknown option: ${arg}`);
    }
  }
  if (!VALID_SCENARIOS.has(opts.scenario)) {
    throw new Error(`Invalid --scenario "${opts.scenario}". Allowed: ${[...VALID_SCENARIOS].join(', ')}`);
  }
  if (!/^[A-Za-z][A-Za-z0-9_]{0,55}$/.test(opts.namespace)) {
    throw new Error(`Invalid --namespace "${opts.namespace}" (must match /^[A-Za-z][A-Za-z0-9_]{0,55}$/)`);
  }
  for (const [label, port] of [['--port', opts.port], ['--mongo-port', opts.mongoPort], ['--mysql-port', opts.mysqlPort]]) {
    if (!Number.isInteger(port) || port <= 1024 || port >= 65536) {
      throw new Error(`Invalid ${label}: ${port}`);
    }
  }
  return opts;
}

function printHelp() {
  console.log(`Bank Wealth local interactive demo launcher

Usage:
  node tools/demo-start.mjs [options]

Options:
  --scenario <name>     Mock TA scenario (default: confirmed)
                        Values: confirmed, rejected, delayed, unknown, accepted,
                                duplicate-identical, duplicate-conflicting
  --port <port>         Play HTTP port on 127.0.0.1 (default: 19000)
  --mongo-port <port>   MongoDB 4.4 port on 127.0.0.1 (default: 19001)
  --mysql-port <port>   MySQL 8.0 port on 127.0.0.1 (default: 19002)
  --namespace <name>    Isolated business namespace / Mongo DB (default: bankdemo)
  --build               Run 'sbt --batch stage' in generated/current before starting
  --smoke               Start server, run end-to-end UI + HTTP oracle, then shut down
  -h, --help            Show this help
`);
}

function checkTcpPort(host, port, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const done = (ok) => { socket.destroy(); resolve(ok); };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

function runSyncLike(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} exited with code ${code}`))));
  });
}

async function waitForHttp(url, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.status === 200) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Timed out waiting for Play server at ${url}`);
}

const opts = parseArgs(process.argv.slice(2));
if (opts.help) {
  printHelp();
  process.exit(0);
}

// 1. Ensure staged Play distribution exists
if (opts.build || !fs.existsSync(STAGE_BIN)) {
  if (!fs.existsSync(path.join(GENERATED_DIR, 'build.sbt'))) {
    console.error('Missing generated/current/build.sbt. Run `npm run project` first.');
    process.exit(1);
  }
  console.log('Building Play stage distribution (sbt --batch stage)...');
  await runSyncLike('sbt', ['--batch', 'stage'], GENERATED_DIR);
}

// 2. Verify MongoDB 4.4 and MySQL 8.0 ports are reachable
const [mongoUp, mysqlUp] = await Promise.all([
  checkTcpPort('127.0.0.1', opts.mongoPort),
  checkTcpPort('127.0.0.1', opts.mysqlPort),
]);
if (!mongoUp || !mysqlUp) {
  console.error(`Database ports not reachable (mongo 127.0.0.1:${opts.mongoPort}=${mongoUp ? 'UP' : 'DOWN'}, mysql 127.0.0.1:${opts.mysqlPort}=${mysqlUp ? 'UP' : 'DOWN'}).`);
  console.error('Start the demo databases first:');
  console.error('  docker compose -f docker-compose.demo.yml up -d');
  process.exit(1);
}

// 3. Prepare non-symlink Mock TA root under .local/mock-ta/ (required by simulator/journal.mjs)
const namespace = opts.smoke ? `smoke_${Date.now().toString(36)}` : opts.namespace;
const mockTaBase = path.join(BANK_ROOT, '.local', 'mock-ta');
fs.mkdirSync(mockTaBase, { recursive: true });
const ownedRoot = path.join(fs.realpathSync.native(mockTaBase), `demo-${namespace}`);
fs.mkdirSync(ownedRoot, { recursive: true });
const lockFile = path.join(ownedRoot, 'ta.jsonl.lock');
if (fs.existsSync(lockFile)) {
  console.warn(`Removing stale Mock TA lock file: ${lockFile}`);
  fs.rmSync(lockFile, { force: true });
}

const stamp = `${Date.now()}-${process.pid}`;
const origin = `http://127.0.0.1:${opts.port}`;
const mongoUri = `mongodb://${encodeURIComponent(opts.mongoUser)}:${encodeURIComponent(opts.mongoPassword)}@127.0.0.1:${opts.mongoPort}/${namespace}?authSource=admin`;
const mysqlUrl = `jdbc:mysql://127.0.0.1:${opts.mysqlPort}/${opts.mysqlSchema}?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC`;
const playSecret = 'bank-wealth-local-demo-secret-key-at-least-32-chars-001';

const credentials = {
  customer: { token: 'demo-customer-token', csrf: 'demo-customer-csrf' },
  collection: { token: 'demo-collection-token', csrf: 'demo-collection-csrf' },
  operator: { token: 'demo-operator-token', csrf: 'demo-operator-csrf' },
};

const confPath = path.join(ownedRoot, `demo-${stamp}.conf`);
const confContent = [
  'include "application.conf"',
  `play.http.secret.key = ${JSON.stringify(playSecret)}`,
  'play.server.pidfile.path = "/dev/null"',
  'play.filters.hosts.allowed = ["."]',
  `service.connections."bank-mongo-connection" = ${JSON.stringify(mongoUri)}`,
  `service.connections."bank-mysql-connection" = ${JSON.stringify(mysqlUrl)}`,
  `akka.contrib.persistence.mongodb.mongo.mongouri = ${JSON.stringify(mongoUri)}`,
  'db.default.driver = "com.mysql.cj.jdbc.Driver"',
  `db.default.url = ${JSON.stringify(mysqlUrl)}`,
  `db.default.username = ${JSON.stringify(opts.mysqlUser)}`,
  `db.default.password = ${JSON.stringify(opts.mysqlPassword)}`,
  'akka.actor.provider = "local"',
  'akka.loglevel = "WARNING"',
  'akka.stdout-loglevel = "WARNING"',
  `bank.namespace = ${JSON.stringify(namespace)}`,
  'bank.demo.authMode = "fixed-local-demo"',
  'bank.demo.version = "bank-truthsrc-runtime-v1"',
  `bank.demo.origin = ${JSON.stringify(origin)}`,
  'bank.demo.principals = [',
  `  { id = "customer", accountId = "customer", roles = ["customer"], token = ${JSON.stringify(credentials.customer.token)}, csrfToken = ${JSON.stringify(credentials.customer.csrf)} },`,
  `  { id = "collection", accountId = "collection", roles = ["customer"], token = ${JSON.stringify(credentials.collection.token)}, csrfToken = ${JSON.stringify(credentials.collection.csrf)} },`,
  `  { id = "operator", accountId = "operator", roles = ["operator"], token = ${JSON.stringify(credentials.operator.token)}, csrfToken = ${JSON.stringify(credentials.operator.csrf)} }`,
  ']',
  'bank.demo.funds = [',
  '  { code = "fund", collectionAccountId = "collection" }',
  ']',
  'bank.demo.seeds = [',
  '  { accountId = "customer", minorUnits = "100000" },',
  '  { accountId = "collection", minorUnits = "0" },',
  '  { accountId = "operator", minorUnits = "0" }',
  ']',
  `bank.mockTa.node = ${JSON.stringify(NODE_BIN)}`,
  `bank.mockTa.worker = ${JSON.stringify(TA_WORKER)}`,
  `bank.mockTa.ownedRoot = ${JSON.stringify(ownedRoot)}`,
  `bank.mockTa.journal = ${JSON.stringify(path.join(ownedRoot, 'ta.jsonl'))}`,
  `bank.mockTa.transcript = ${JSON.stringify(path.join(ownedRoot, `worker-${stamp}.jsonl`))}`,
  `bank.mockTa.stderr = ${JSON.stringify(path.join(ownedRoot, `worker-${stamp}.stderr.log`))}`,
  `bank.mockTa.scenario = ${JSON.stringify(opts.scenario)}`,
  'bank.recovery.authorization = "demo-machine-recovery-token"',
  '',
].join('\n');
fs.writeFileSync(confPath, confContent, 'utf8');

const serverLogPath = path.join(ownedRoot, `server-${stamp}.log`);
const serverLogFd = opts.smoke ? fs.openSync(serverLogPath, 'a') : null;

console.log(`Starting Bank Wealth Demo (namespace=${namespace}, scenario=${opts.scenario}, origin=${origin})...`);
const server = spawn(
  STAGE_BIN,
  [
    `-Dconfig.file=${confPath}`,
    '-Dhttp.address=127.0.0.1',
    `-Dhttp.port=${opts.port}`,
    '-Dpidfile.path=/dev/null',
  ],
  {
    cwd: GENERATED_DIR,
    env: {
      ...process.env,
      PLAY_SECRET: playSecret,
      MONGO_URI: mongoUri,
      MYSQL_JDBC_URL: mysqlUrl,
      MYSQL_USER: opts.mysqlUser,
      MYSQL_PASSWORD: opts.mysqlPassword,
    },
    stdio: opts.smoke ? ['ignore', serverLogFd, serverLogFd] : 'inherit',
  }
);
if (serverLogFd !== null) fs.closeSync(serverLogFd);

let stopping = false;
function shutdown(signal = 'SIGTERM') {
  if (stopping) return;
  stopping = true;
  if (!server.killed) server.kill(signal);
}
async function stopServerGracefully(timeoutMs = 15000) {
  shutdown('SIGTERM');
  if (server.exitCode !== null || server.signalCode !== null) return;
  await Promise.race([
    new Promise((resolve) => server.once('exit', resolve)),
    new Promise((resolve) => setTimeout(() => {
      try { server.kill('SIGKILL'); } catch {}
      resolve();
    }, timeoutMs)),
  ]);
}
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => shutdown(sig));
}

try {
  await waitForHttp(`${origin}/bank/v1`);
} catch (err) {
  shutdown('SIGTERM');
  throw err;
}

console.log('');
console.log('====================================================================');
console.log('  Bank Wealth Demo is LIVE');
console.log('====================================================================');
console.log(`  Browser UI : ${origin}/bank/v1`);
console.log(`  TA Scenario: ${opts.scenario}  (namespace: ${namespace})`);
console.log('  Seed Funds : customer = 100000 minor units (1,000.00 CNY), fundCode = "fund"');
console.log('');
console.log('  Customer sign-in credentials:');
console.log(`    Bearer token : ${credentials.customer.token}`);
console.log(`    CSRF token   : ${credentials.customer.csrf}`);
console.log('');
console.log('  Operator sign-in credentials (business-clock tick / pending ops):');
console.log(`    Bearer token : ${credentials.operator.token}`);
console.log(`    CSRF token   : ${credentials.operator.csrf}`);
console.log('====================================================================');
console.log('');

if (opts.smoke) {
  let exitCode = 0;
  try {
    const shellRes = await fetch(`${origin}/bank/v1`);
    assert.equal(shellRes.status, 200, 'GET /bank/v1');
    const scriptRes = await fetch(`${origin}/bank/v1/client-script`);
    assert.equal(scriptRes.status, 200, 'GET /bank/v1/client-script');
    console.log('PASS [smoke] Browser shell (/bank/v1) and client script (/bank/v1/client-script) HTTP 200');

    const auth = await exerciseTransportAuth({ origin, credentials, namespace: 'demo-auth' });
    console.log(`PASS [smoke] Transport & auth negative oracle: ${auth.counts.requests}/${auth.counts.requests}`);

    const flow = await exerciseProductionHttp({ origin, credentials, mode: 'initial', namespace: 'demo-smoke' });
    console.log(`PASS [smoke] Four-flow production HTTP oracle: ${flow.counts.requests} requests, customer=${flow.accounts.customer.available.minorUnits}, collection=${flow.accounts.collection.available.minorUnits}, sipSuccess=${flow.plan.successTotal}`);
  } catch (err) {
    exitCode = 1;
    console.error('SMOKE FAILED:', err);
  } finally {
    await stopServerGracefully();
    if (exitCode === 0) fs.rmSync(ownedRoot, { recursive: true, force: true });
    else console.error(`Server log preserved at: ${serverLogPath}`);
    process.exit(exitCode);
  }
} else {
  console.log('Press Ctrl+C to stop the demo server.');
  server.on('exit', (code) => process.exit(code ?? 0));
}
