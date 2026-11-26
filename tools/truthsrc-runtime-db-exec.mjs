import assert from 'node:assert/strict';
import { request } from 'node:http';
import { PassThrough } from 'node:stream';

const SOCKET = '/var/run/docker.sock';
const pause = ms => new Promise(done => setTimeout(done, ms));
const diagnosticErrors = new WeakMap(), closedErrorTransports = new WeakSet();
const fail = (code, phase, details = {}) => {
  const error = new Error('Owned Docker exec operation failed.');
  diagnosticErrors.set(error, Object.freeze({ code, phase, ...details }));
  return error;
};

// Only locally constructed classifications reach receipts; never daemon bodies,
// exception messages, stream bytes, command arguments or environment values.
export function dockerExecDiagnostic(error) {
  return diagnosticErrors.get(error) ?? { code: 'DOCKER_EXEC_UNKNOWN', phase: 'unknown' };
}

export function dockerExecTransportClosed(error) { return closedErrorTransports.has(error); }

export function dockerJson(method, path, body, timeoutMs = 10_000) {
  assert.ok(/^\/v1\.41\/(?:containers\/[0-9a-f]{64}\/exec|exec\/[0-9a-f]{64}\/json)$/.test(path));
  assert.ok(Number.isFinite(timeoutMs) && timeoutMs > 0 && timeoutMs <= 10_000);
  const phase = path.endsWith('/json') ? 'exec-inspect' : 'exec-create';
  return new Promise((done, reject) => {
    const deadline = Date.now() + timeoutMs;
    let settled = false, response, responseExit, requestExit, timer;
    const finish = (error, value) => {
      if (settled) return; settled = true; clearTimeout(timer);
      if (error) {
        response?.destroy(); req.destroy();
        void (async () => { await requestExit; await responseExit; closedErrorTransports.add(error); reject(error); })();
      } else done(value);
    };
    const data = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const req = request({ socketPath: SOCKET, method, path, headers: { Connection: 'close',
      ...(data ? { 'Content-Type': 'application/json', 'Content-Length': data.length } : {}) } }, res => {
      response = res; responseExit = new Promise(resolve => res.once('close', resolve));
      if (settled) { res.destroy(); return; }
      let size = 0; const chunks = [];
      res.on('error', () => finish(fail('DOCKER_CONTROL_RESPONSE', phase)));
      res.on('aborted', () => finish(fail('DOCKER_CONTROL_ABORTED', phase)));
      res.on('data', bytes => {
        size += bytes.length;
        if (size > 65536) finish(fail('DOCKER_CONTROL_LIMIT', phase)); else chunks.push(bytes);
      });
      res.on('end', () => {
        if (Date.now() >= deadline) { finish(fail('DOCKER_CONTROL_DEADLINE', phase)); return; }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          finish(fail('DOCKER_CONTROL_HTTP', phase, { httpStatus: res.statusCode })); return;
        }
        try { finish(null, JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch { finish(fail('DOCKER_CONTROL_JSON', phase)); }
      });
    });
    requestExit = new Promise(resolve => req.once('close', resolve));
    timer = setTimeout(() => finish(fail('DOCKER_CONTROL_DEADLINE', phase)), timeoutMs);
    req.once('error', () => finish(fail('DOCKER_CONTROL_CONNECTION', phase)));
    req.end(data);
  });
}

export function dockerFrameReader(emit, stderr) {
  let pending = Buffer.alloc(0), failed = false;
  return {
    write(bytes) {
      if (failed) return false;
      pending = Buffer.concat([pending, bytes]);
      while (pending.length >= 8) {
        const type = pending[0], length = pending.readUInt32BE(4);
        if (![0, 1, 2].includes(type) || pending[1] || pending[2] || pending[3] || length > 1024 * 1024) { failed = true; return false; }
        if (pending.length < 8 + length) break;
        const payload = pending.subarray(8, 8 + length);
        if (type === 1) emit(payload); else if (type === 2) stderr(length);
        pending = pending.subarray(8 + length);
      }
      return true;
    },
    end() { if (pending.length) failed = true; return !failed; },
  };
}

export async function openDatabaseExec(containerId, containerPort) {
  assert.match(containerId, /^[0-9a-f]{64}$/);
  assert.ok([3306, 27017].includes(containerPort));
  const script = 'exec 3<>/dev/tcp/127.0.0.1/' + containerPort + '; cat <&3 & reader=$!; cat <&0 >&3 & writer=$!; wait -n "$reader" "$writer"; kill "$reader" "$writer" 2>/dev/null; wait "$reader" "$writer" 2>/dev/null; exit 0';
  const created = await dockerJson('POST', '/v1.41/containers/' + containerId + '/exec', {
    AttachStdin: true, AttachStdout: true, AttachStderr: true, Tty: false, Cmd: ['bash', '-c', script],
  });
  assert.match(created.Id, /^[0-9a-f]{64}$/);
  const execId = created.Id, output = new PassThrough();
  let socket, transportExit, ended = false, failure = false, streamDiagnostic = null, stderrBytes = 0, closing;
  const streamFailure = code => { failure = true; streamDiagnostic ??= { code, phase: 'exec-stream' }; };
  const frames = dockerFrameReader(bytes => {
    if (!output.write(bytes)) { socket.pause(); output.once('drain', () => { if (!socket.destroyed) socket.resume(); }); }
  }, count => { stderrBytes += count; });
  const finish = () => { if (!ended) { ended = true; if (!frames.end()) streamFailure('DOCKER_STREAM_TRUNCATED'); output.end(); } };
  await new Promise((done, reject) => {
    const data = Buffer.from('{"Detach":false,"Tty":false}'), deadline = Date.now() + 10_000;
    let settled = false, timer, requestExit, rejectedStreamExit;
    const rejectUpgrade = code => {
      if (settled) return; settled = true; clearTimeout(timer);
      const error = fail(code, 'exec-start');
      req.destroy(); output.destroy();
      void (async () => { await requestExit; await rejectedStreamExit; closedErrorTransports.add(error); reject(error); })();
    };
    const req = request({ socketPath: SOCKET, method: 'POST', path: '/v1.41/exec/' + execId + '/start',
      headers: { Connection: 'Upgrade', Upgrade: 'tcp', 'Content-Type': 'application/json', 'Content-Length': data.length } });
    requestExit = new Promise(resolve => req.once('close', resolve));
    timer = setTimeout(() => rejectUpgrade('DOCKER_EXEC_START_DEADLINE'), 10_000);
    req.once('error', () => rejectUpgrade('DOCKER_EXEC_START_CONNECTION'));
    req.once('response', res => {
      rejectedStreamExit = new Promise(resolve => res.once('close', resolve));
      res.destroy(); rejectUpgrade('DOCKER_EXEC_START_NO_UPGRADE');
    });
    req.once('upgrade', (res, stream, head) => {
      if (settled || Date.now() >= deadline) {
        rejectedStreamExit = new Promise(resolve => stream.once('close', resolve));
        stream.destroy(); rejectUpgrade('DOCKER_EXEC_START_DEADLINE'); return;
      }
      settled = true; clearTimeout(timer); socket = stream;
      transportExit = new Promise(resolve => socket.once('close', resolve));
      const consume = bytes => {
        if (!frames.write(bytes)) { streamFailure('DOCKER_STREAM_FRAME'); socket.destroy(); finish(); }
      };
      socket.on('data', consume);
      socket.on('error', () => { streamFailure('DOCKER_STREAM_CONNECTION'); finish(); });
      socket.on('end', finish); socket.on('close', finish);
      if (head.length) consume(head);
      done();
    });
    req.end(data);
  });
  return {
    execId, output, input: socket,
    close() {
      return closing ??= (async () => {
        const started = Date.now(), until = started + 10_000;
        let status, diagnostic = null, observations = 0;
        try {
          socket.end();
          do {
            const remaining = until - Date.now();
            if (remaining <= 0) throw fail('DOCKER_EXEC_CLOSE_DEADLINE', 'exec-close');
            status = await dockerJson('GET', '/v1.41/exec/' + execId + '/json', undefined, remaining);
            observations++;
            if (status?.ID !== execId || status?.ContainerID !== containerId) throw fail('DOCKER_EXEC_IDENTITY', 'exec-inspect');
            if (typeof status.Running !== 'boolean' || !status.Running && !Number.isInteger(status.ExitCode)) {
              throw fail('DOCKER_EXEC_STATUS', 'exec-inspect', { running: typeof status.Running === 'boolean' ? status.Running : null,
                exitCodeType: status.ExitCode === null ? 'null' : typeof status.ExitCode === 'number' ? 'number' : 'other' });
            }
            if (Date.now() >= until) throw fail('DOCKER_EXEC_CLOSE_DEADLINE', 'exec-close');
            if (!status.Running) break;
            await pause(Math.min(50, until - Date.now()));
          } while (true);
        } catch (error) {
          failure = true; diagnostic = dockerExecDiagnostic(error);
        } finally {
          socket.destroy(); await transportExit; finish();
        }
        return { execId, closed: diagnostic === null && status?.Running === false,
          code: diagnostic === null ? status.ExitCode : null, failure, stderrBytes, transportClosed: socket.destroyed, streamDiagnostic,
          closeObservation: { observations, elapsedMs: Date.now() - started, deadlineMs: 10_000, diagnostic } };
      })();
    },
  };
}
