# Database relay closure diagnostics

## Scope and preserved evidence

This change is limited to the bank's Docker exec relay and its lifecycle consumers.
It does not change financial rules, generated Scala, fixed business tests, published
0.3.0 artifacts, database images, or the 90-second application readiness oracle.
The Docker control/exec-close budget remains 10 seconds and relay client-idle
budget remains 120 seconds. A close loop now shares one 10-second budget rather
than granting another full request timeout near its end.

Workshop07 passed on its original exact pair. Independent session08 completed the
cash/TA browser flow but failed stop: MySQL relay sequence16 lacked a successful
exec-close observation. That failure remains immutable. Its original exception
category was discarded; a later Docker404 does not establish the original cause.
Neither the diagnostics below nor a successful later run can recover that missing
historical fact.

## Close and resource-return contract

- Close records preserve bounded, locally classified phase/error information.
  HTTP status codes, observation counts and elapsed time may be recorded; daemon
  response bodies, raw errors, commands, credentials and stream payloads are not.
- Exec identity must match both the requested exec and container. Running execs
  may not have an exit code yet; final stop requires a valid exit code.
- Failure, timeout, malformed status, or404 never means successful exec closure.
  The owned transport is destroyed and its close event awaited even on failure.
- `database-stop.json.stopped` remains the successful database/relay outcome and
  now also rejects relay stream failures. `resourcesExited` is a separate cleanup
  observation: owned containers stopped, local relay transports/listeners closed,
  no unresolved creations, and unchanged controls.
- Runtime/session leases may be returned after that independent physical-exit
  observation, while the original operation stays failed (`passed:false`, exit2).
  Missing or false exit evidence retains leases; there is no stale-lock takeover.
- Existing sealed receipts are neither rewritten nor retrospectively re-evaluated
  with new support code. A changed candidate needs fresh verification and owners.

## Narrow public diagnostic entry

Use a complete, explicitly paired bank/tool source copy and Node22.13 or later.
This CLI starts only the existing owner-labelled MySQL/Mongo containers and TCP
relays, with fresh private data and credentials; it starts no JVM or banking UI.
It does not accept existing containers, credentials, arbitrary destinations, or
fault injection flags.

```sh
node tools/bank-database-relay.mjs --help
node tools/bank-database-relay.mjs \
  --owner NEW_OWNER \
  --mysql-port 19962 --mongo-port 19963 \
  --evidence "$PWD/target/truthsrc-runtime-NEW_OWNER" \
  --shared-registry /absolute/metarch-truthsrc/.rounds/shared-jvm-leases
```

Choose a genuinely new owner and absent evidence directory. The shared registry
must be the agreed workspace registry, not a fresh alternative to bypass another
owner. Ports remain subject to cooperative leases and actual binding. Stop this
foreground command with Ctrl-C/SIGTERM. It writes ready/closed/database-stop
receipts and preserves data. Failed operations can return leases only after
physical exit is verified. Do not treat lease return as acceptance.

## Observations from 2026-11-14

Evidence root (workspace-relative):
`metarch-truthsrc/.rounds/minimal-030-finish-20261112-6DPJC9/relay-close-672/`.

- **09 baseline:** real CLI and TCP, 48 MySQL connections spanning half-close,
  unauthenticated quit and reset; 8 correlated Mongo hello responses. All closed,
  exit0,34.249s. Session08's intermittent failure was not reproduced.
- **10 first patch:** rejected a legal in-progress exec with no exit code. This
  regression was found by actual execution, retained as failed, and corrected.
  Containers/transports exited and leases returned; success was not manufactured.
- **11 corrected candidate:** same56 TCP interactions passed, exit0,36.604s.
- **12 HTTP404 negative:** an isolated debugger changed one real exec-inspect HTTP
  status to404. The CLI returned exit2; the record retained
  `DOCKER_CONTROL_HTTP / exec-inspect /404`, `closed:false`, and
  `transportClosed:true`. Physical cleanup and lease return passed. This is
  deliberate fault injection, not a claimed reproduction of session08's cause.
- **13 stalled-response negative:** an isolated debugger paused one real inspect
  response. `DOCKER_CONTROL_DEADLINE` was recorded at10002ms against a10000ms
  deadline (event-loop completion overhead, not an enlarged limit). The CLI
  remained failed, transports/containers closed and leases returned.

These narrow observations do not certify a full banking workshop or independent
browser-session lifecycle. The final patched pair must run those separately.
No new runtime publication, public download channel or human onboarding approval
is implied. Node contract source was updated but was not run in this runtime
verification round; it is not reported as green CI.
