import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { Worker, isMainThread, parentPort, workerData, threadId } from 'node:worker_threads';
import { dockerExecDiagnostic, dockerExecTransportClosed, openDatabaseExec } from './truthsrc-runtime-db-exec.mjs';

const pause = ms => new Promise(done => setTimeout(done, ms));
const WORKER_SCHEMA = 'bank.database-relay-worker/v1';
const failedStarts = new WeakMap();
export function failedDatabaseRelay(error) { return failedStarts.get(error); }

async function startApiRelay({ containerId, hostPort, containerPort }) {
  const active = new Set(), sessions = [], clients = new Set();
  let stopped = false, failed = false, index = 0;
  const server = createServer({ allowHalfOpen: true }, socket => {
    if (stopped || active.size >= 128) { socket.destroy(); return; }
    socket.pause(); clients.add(socket);
    const clientExit = new Promise(resolve => socket.once('close', resolve));
    // An early reset can occur while Docker exec creation is still pending.
    socket.on('error', () => {});
    const record = { sequence: index++, execId: null, closed: false, code: null, bytesToDatabase: 0, bytesFromDatabase: 0 };
    sessions.push(record);
    let exec, closing, creationTransportClosed = false;
    const job = (async () => {
      try {
        exec = await openDatabaseExec(containerId, containerPort); record.execId = exec.execId;
        const finish = () => closing ??= exec.close().then(result => {
          Object.assign(record, result); if (result.failure) failed = true;
        }, error => {
          failed = true; record.failure = true; record.closed = false;
          exec.input.destroy(); exec.output.destroy();
          record.transportClosed = false;
          record.closeObservation = { diagnostic: dockerExecDiagnostic(error) };
        });
        socket.setTimeout(120_000, () => socket.destroy());
        socket.on('data', bytes => { record.bytesToDatabase += bytes.length; });
        exec.output.on('data', bytes => { record.bytesFromDatabase += bytes.length; });
        socket.on('error', () => { void finish(); });
        socket.on('end', () => { void finish(); }); socket.on('close', () => { void finish(); });
        exec.output.on('end', () => { void finish(); socket.end(); });
        exec.output.on('error', () => { failed = true; socket.destroy(); void finish(); });
        socket.pipe(exec.input); exec.output.pipe(socket); socket.resume();
        if (socket.destroyed || stopped) await finish();
        else { while (!closing && !stopped) await pause(25); await finish(); }
      } catch (error) {
        failed = true; record.failure = true; record.diagnostic = dockerExecDiagnostic(error);
        creationTransportClosed = dockerExecTransportClosed(error);
      } finally {
        exec?.input.destroy(); exec?.output.destroy();
        socket.destroy(); await clientExit; clients.delete(socket);
        record.clientClosed = true;
        if (!exec) record.transportClosed = creationTransportClosed;
      }
    })();
    active.add(job); void job.finally(() => active.delete(job));
  });
  server.on('error', () => { failed = true; });
  await new Promise((done, reject) => { server.once('error', reject); server.listen({ host: '127.0.0.1', port: hostPort, exclusive: true }, done); });
  return { address: { host: '127.0.0.1', port: hostPort }, async close() {
    stopped = true;
    const done = new Promise(resolve => server.close(resolve));
    for (const socket of clients) socket.destroy();
    await Promise.all([...active]); await done;
    return { kind: 'owned-docker-api-exec-relay', host: '127.0.0.1', port: hostPort, containerId,
      transportClosed: !server.listening && active.size === 0 && clients.size === 0 && sessions.every(s => s.transportClosed === true),
      closed: !server.listening && active.size === 0 && sessions.every(s => s.closed), failed, sessions };
  } };
}


function relayIdentity(value) {
  assert.match(value.containerId, /^[0-9a-f]{64}$/);
  assert.ok(Number.isSafeInteger(value.hostPort) && value.hostPort > 1024 && value.hostPort <= 65535 &&
    ![9000, 2551, 3306, 27017].includes(value.hostPort));
  assert.ok([3306, 27017].includes(value.containerPort));
}
function fields(value, allowed, required = allowed) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value));
  assert.ok(Object.keys(value).every(key => allowed.includes(key)) && required.every(key => Object.hasOwn(value, key)));
}
function checkedDiagnostic(value) {
  if (value === null) return;
  fields(value, ['code', 'phase', 'httpStatus', 'running', 'exitCodeType'], ['code', 'phase']);
  assert.ok(['DOCKER_EXEC_UNKNOWN', 'DOCKER_CONTROL_RESPONSE', 'DOCKER_CONTROL_ABORTED', 'DOCKER_CONTROL_LIMIT',
    'DOCKER_CONTROL_DEADLINE', 'DOCKER_CONTROL_HTTP', 'DOCKER_CONTROL_JSON', 'DOCKER_CONTROL_CONNECTION',
    'DOCKER_EXEC_START_DEADLINE', 'DOCKER_EXEC_START_CONNECTION', 'DOCKER_EXEC_START_NO_UPGRADE',
    'DOCKER_EXEC_CLOSE_DEADLINE', 'DOCKER_EXEC_IDENTITY', 'DOCKER_EXEC_STATUS',
    'DOCKER_STREAM_TRUNCATED', 'DOCKER_STREAM_FRAME', 'DOCKER_STREAM_CONNECTION'].includes(value.code));
  assert.ok(['unknown', 'exec-create', 'exec-inspect', 'exec-start', 'exec-close', 'exec-stream'].includes(value.phase));
  if (Object.hasOwn(value, 'httpStatus')) assert.ok(Number.isInteger(value.httpStatus) && value.httpStatus >= 100 && value.httpStatus <= 599);
  if (Object.hasOwn(value, 'running')) assert.ok(value.running === null || typeof value.running === 'boolean');
  if (Object.hasOwn(value, 'exitCodeType')) assert.ok(['null', 'number', 'other'].includes(value.exitCodeType));
}
function checkedRelayResult(value, options) {
  fields(value, ['kind', 'host', 'port', 'containerId', 'transportClosed', 'closed', 'failed', 'sessions']);
  assert.equal(value.kind, 'owned-docker-api-exec-relay'); assert.equal(value.host, '127.0.0.1');
  assert.equal(value.port, options.hostPort); assert.equal(value.containerId, options.containerId);
  for (const name of ['transportClosed', 'closed', 'failed']) assert.equal(typeof value[name], 'boolean');
  assert.ok(Array.isArray(value.sessions));
  for (const [index, row] of value.sessions.entries()) {
    fields(row, ['sequence', 'execId', 'closed', 'code', 'bytesToDatabase', 'bytesFromDatabase', 'failure', 'stderrBytes',
      'transportClosed', 'clientClosed', 'closeObservation', 'diagnostic', 'streamDiagnostic'],
    ['sequence', 'execId', 'closed', 'code', 'bytesToDatabase', 'bytesFromDatabase', 'failure', 'transportClosed', 'clientClosed']);
    assert.equal(row.sequence, index); assert.ok(row.execId === null || /^[0-9a-f]{64}$/.test(row.execId));
    assert.ok(row.code === null || Number.isInteger(row.code));
    for (const name of ['closed', 'failure', 'transportClosed', 'clientClosed']) assert.equal(typeof row[name], 'boolean');
    for (const name of ['bytesToDatabase', 'bytesFromDatabase', ...(Object.hasOwn(row, 'stderrBytes') ? ['stderrBytes'] : [])])
      assert.ok(Number.isSafeInteger(row[name]) && row[name] >= 0);
    if (row.closeObservation) {
      fields(row.closeObservation, ['observations', 'elapsedMs', 'deadlineMs', 'diagnostic'], ['diagnostic']);
      for (const name of ['observations', 'elapsedMs']) if (Object.hasOwn(row.closeObservation, name))
        assert.ok(Number.isSafeInteger(row.closeObservation[name]) && row.closeObservation[name] >= 0);
      if (Object.hasOwn(row.closeObservation, 'deadlineMs')) assert.equal(row.closeObservation.deadlineMs, 10_000);
      checkedDiagnostic(row.closeObservation.diagnostic);
    }
    for (const name of ['diagnostic', 'streamDiagnostic']) if (Object.hasOwn(row, name)) checkedDiagnostic(row[name]);
  }
  assert.equal(value.closed, value.sessions.every(row => row.closed));
  assert.equal(value.transportClosed, value.sessions.every(row => row.transportClosed && row.clientClosed));
  if (value.sessions.some(row => row.failure)) assert.equal(value.failed, true);
  return value;
}

async function relayWorkerMain() {
  fields(workerData, ['schemaVersion', 'containerId', 'hostPort', 'containerPort']);
  assert.equal(workerData.schemaVersion, WORKER_SCHEMA); relayIdentity(workerData);
  const { containerId, hostPort, containerPort } = workerData;
  const send = (kind, extra = {}) => parentPort.postMessage({ schemaVersion: WORKER_SCHEMA, containerId, hostPort, containerPort, threadId, kind, ...extra });
  let closing, requested = false;
  const started = startApiRelay(workerData);
  const close = () => closing ??= started.then(relay => relay.close()).then(result => {
    send('result', { result }); parentPort.close();
  }, () => { send('failure'); process.exitCode = 2; parentPort.close(); });
  parentPort.on('message', message => {
    try {
      fields(message, ['schemaVersion', 'kind']); assert.equal(message.schemaVersion, WORKER_SCHEMA);
      assert.equal(message.kind, 'close'); assert.equal(requested, false); requested = true;
      void close();
    } catch { send('failure'); process.exitCode = 2; void close(); }
  });
  parentPort.once('close', () => { if (!closing) { process.exitCode = 2; void close(); } });
  try { await started; if (!requested) send('ready'); }
  catch { send('failure'); process.exitCode = 2; parentPort.close(); }
}

async function startWorkerRelay(options) {
  assert.equal(isMainThread, true); relayIdentity(options);
  const worker = new Worker(new URL(import.meta.url), {
    workerData: { schemaVersion: WORKER_SCHEMA, ...options }, execArgv: [],
    env: { PATH: '/usr/bin:/bin:/usr/sbin:/sbin', LANG: 'en_US.UTF-8' }, stdout: true, stderr: true,
  });
  const id = worker.threadId, started = Date.now();
  let ready = false, exited = false, code = null, forced = false, requested = false, result, diagnostic = null, closing, timer;
  let readyDone, exitDone;
  const readySignal = new Promise(resolve => { readyDone = resolve; });
  const exitSignal = new Promise(resolve => { exitDone = resolve; });
  const failWorker = value => { diagnostic ??= { code: value, phase: 'relay-worker' }; readyDone(false); };
  const terminate = () => {
    if (!exited && !forced) { forced = true; void worker.terminate().catch(() => failWorker('RELAY_WORKER_TERMINATE')); }
  };
  const rejectMessage = () => { failWorker('RELAY_WORKER_PROTOCOL'); terminate(); };
  worker.on('error', () => { failWorker('RELAY_WORKER_ERROR'); terminate(); });
  worker.on('messageerror', rejectMessage);
  // No raw Worker output, exception messages or database bytes become evidence.
  for (const stream of [worker.stdout, worker.stderr]) {
    stream.on('data', rejectMessage); stream.on('error', rejectMessage);
  }
  worker.on('message', message => {
    try {
      fields(message, ['schemaVersion', 'containerId', 'hostPort', 'containerPort', 'threadId', 'kind', 'result'],
        ['schemaVersion', 'containerId', 'hostPort', 'containerPort', 'threadId', 'kind']);
      assert.equal(message.schemaVersion, WORKER_SCHEMA); assert.equal(message.threadId, id);
      for (const name of ['containerId', 'hostPort', 'containerPort']) assert.equal(message[name], options[name]);
      assert.equal(exited, false);
      if (message.kind === 'ready') {
        assert.ok(!ready && !requested && !Object.hasOwn(message, 'result') && !diagnostic && Date.now() - started < 10_000);
        ready = true; clearTimeout(timer); readyDone(true);
      } else if (message.kind === 'result') {
        assert.ok(requested && !result); result = checkedRelayResult(message.result, options);
      } else if (message.kind === 'failure') {
        assert.ok(!Object.hasOwn(message, 'result')); failWorker('RELAY_WORKER_FAILURE'); terminate();
      } else rejectMessage();
    } catch { rejectMessage(); }
  });
  worker.once('exit', exitCode => {
    exited = true; code = exitCode; clearTimeout(timer);
    if (!requested || !result || code !== 0) failWorker('RELAY_WORKER_EXIT');
    readyDone(false); exitDone();
  });
  timer = setTimeout(() => { failWorker('RELAY_WORKER_START_DEADLINE'); terminate(); }, 10_000);
  const waitExit = async timeoutMs => {
    if (exited) return;
    let timeout;
    try { await Promise.race([exitSignal, new Promise(resolve => { timeout = setTimeout(resolve, timeoutMs); })]); }
    finally { clearTimeout(timeout); }
  };
  const handle = { address: { host: '127.0.0.1', port: options.hostPort }, close() {
    return closing ??= (async () => {
      clearTimeout(timer); requested = true;
      if (!exited && !forced) {
        try { worker.postMessage({ schemaVersion: WORKER_SCHEMA, kind: 'close' }); }
        catch { failWorker('RELAY_WORKER_SEND'); terminate(); }
      }
      if (forced) await waitExit(5000);
      else {
        await waitExit(30_000);
        if (!exited) { failWorker('RELAY_WORKER_CLOSE_DEADLINE'); terminate(); await waitExit(5000); }
      }
      const complete = Boolean(result && exited && code === 0 && !forced && !diagnostic);
      return { kind: 'owned-docker-api-exec-relay', host: '127.0.0.1', port: options.hostPort, containerId: options.containerId,
        // An actual thread exit independently closes its host sockets, even when
        // no successful operation result was received. Container exit is separate.
        transportClosed: exited, closed: complete && result.closed,
        failed: !complete || result.failed, sessions: result?.sessions ?? [],
        worker: { schemaVersion: WORKER_SCHEMA, threadId: id, exited, exitCode: code, forced, diagnostic,
          resultReceived: Boolean(result), startDeadlineMs: 10_000, closeDeadlineMs: 30_000, exitDeadlineMs: 5000 } };
    })();
  } };
  if (!await readySignal) {
    await handle.close();
    const error = new Error('Owned database relay Worker did not become ready.');
    failedStarts.set(error, handle); throw error;
  }
  return handle;
}

if (!isMainThread && workerData?.schemaVersion === WORKER_SCHEMA) {
  void relayWorkerMain().catch(() => { process.exitCode = 2; parentPort.close(); });
}

// Docker Desktop does not publish ports on internal networks. An exec stream has
// no container egress and needs no extra network attachment or password argument.
export async function startDatabaseRelay({ docker, containerId, hostPort, containerPort, env, spawnImpl = spawn }) {
  assert.ok(/^[/][A-Za-z0-9/_.-]+$/.test(docker));
  assert.match(containerId, /^[0-9a-f]{64}$/);
  assert.ok(Number.isSafeInteger(hostPort) && hostPort > 1024 && hostPort <= 65535 && ![9000, 2551, 3306, 27017].includes(hostPort),
    'explicit unprivileged nonshared host port required');
  assert.ok([3306, 27017].includes(containerPort), 'fixed database container port required');
  if (spawnImpl === spawn) return startWorkerRelay({ containerId, hostPort, containerPort });
  const active = new Map(), clients = new Set(), sessions = [];
  let stopped = false, sequence = 0, failed = false;
  const server = createServer({ allowHalfOpen: true }, socket => {
    if (stopped || active.size >= 128) { socket.destroy(); return; }
    clients.add(socket);
    socket.setTimeout(120_000, () => socket.destroy());
    const script = 'exec 3<>/dev/tcp/127.0.0.1/' + containerPort + '; cat <&3 & reader=$!; cat >&3; kill "$reader" 2>/dev/null; wait "$reader" 2>/dev/null; exit 0';
    const args = ['--host', 'unix:///var/run/docker.sock', 'exec', '-i', containerId, 'bash', '-c', script];
    const record = { sequence: sequence++, pid: null, code: null, signal: null, closed: false, bytesToDatabase: 0, bytesFromDatabase: 0 };
    let child, killer, escalator, ended = false;
    const stop = () => {
      if (ended) return;
      ended = true; clients.delete(socket); socket.destroy();
      child?.stdin.end();
      killer = setTimeout(() => child?.kill('SIGTERM'), 1500);
      escalator = setTimeout(() => { if (child && active.has(child)) child.kill('SIGKILL'); }, 6500);
    };
    try {
      child = spawnImpl(docker, args, { env: { ...env, NODE_V8_COVERAGE: '' }, stdio: ['pipe', 'pipe', 'pipe'] });
      record.pid = child.pid ?? null;
      active.set(child, { socket, stop, record }); sessions.push(record);
      socket.on('data', bytes => { record.bytesToDatabase += bytes.length; });
      child.stdout.on('data', bytes => { record.bytesFromDatabase += bytes.length; });
      child.stderr.resume();
      child.stderr.on('error', stop); child.stdin.on('error', stop); child.stdout.on('error', stop);
      socket.pipe(child.stdin); child.stdout.pipe(socket);
      socket.on('end', () => child.stdin.end());
      socket.on('error', stop); socket.on('close', () => { clients.delete(socket); stop(); });
      child.once('error', () => { failed = true; stop(); });
      child.once('close', (code, signal) => {
        record.code = code; record.signal = signal; record.closed = true;
        if (code !== 0 && !ended) failed = true;
        clearTimeout(killer); clearTimeout(escalator); ended = true; active.delete(child); clients.delete(socket); socket.destroy();
      });
    } catch { failed = true; stop(); }
  });
  server.on('error', () => { failed = true; });
  await new Promise((done, reject) => { server.once('error', reject); server.listen({ host: '127.0.0.1', port: hostPort, exclusive: true }, done); });
  const address = server.address();
  assert.equal(address.address, '127.0.0.1'); assert.equal(address.port, hostPort);
  return {
    address: { host: address.address, port: address.port },
    async close() {
      stopped = true;
      const closed = new Promise(done => server.close(() => done()));
      for (const { stop } of active.values()) stop();
      for (const socket of clients) socket.destroy();
      const until = Date.now() + 10_000;
      while (active.size && Date.now() < until) await pause(25);
      if (active.size) for (const child of active.keys()) child.kill('SIGKILL');
      const reap = Date.now() + 5000;
      while (active.size && Date.now() < reap) await pause(25);
      await closed;
      return { kind: 'owned-docker-exec-relay', host: '127.0.0.1', port: hostPort, containerId,
        closed: !server.listening && active.size === 0, failed, sessions };
    },
  };
}
