# Relay event-loop isolation — implementation and pending verification

The independent session19 reached its actual UI but failed database closure. Its
relay's original10s deadlines were observed at81–103s. The owner process performs
full synchronous input inventories after readiness and every60s, in the same event
loop that previously owned Docker/TCP relays. `async assertUnchanged()` itself
contains no await. That is a reachable event-loop blocker, not timestamp-level
proof of each19 failure or of the older08 error whose classification was lost.

## Change

The production `startDatabaseRelay()` now owns the existing API relay in a dedicated
Node Worker. TCP framing, piping/backpressure, the128 active-client limit, fixed
loopback/database ports and original Docker script remain. There is no new public
fault-injection flag, extra network or Docker published port. The legacy injected
spawn seam remains separate and does not certify production behavior.

The Worker receives only an exact full container ID and explicit ports, not database
credentials or application configuration. It uses empty execArgv and a minimal
environment, so debug/preload settings are not inherited. No raw Worker output or
exception text is retained. The protocol accepts ready/close/result/failure with
explicit identity, schema, field and diagnostic checks. Database payload stays
inside the relay; only safe counters and locally generated classifications return.

Original admission, source, cache, supply and classpath checks are unchanged, with
no skipped tree, fresh baseline or weaker oracle. Worker isolation stops these
synchronous main-thread checks from blocking relay I/O, but does not protect against
host suspension, whole-machine starvation or a genuinely slow Docker daemon.

## Lifecycle and failure semantics

- Docker create/start/inspect and exec close retain their original10s bounds;
  client idle remains120s. Late responses cannot become success.
- Worker ready has a10s admission bound. Close gives the existing pending
  create/start/close chain at most30s in total, then only that owned Worker may be
  terminated, with5s for its actual exit event. These are lifecycle budgets, not
  extensions of individual I/O budgets. Forced termination is always failure.
- A successful result alone is insufficient: the parent must also observe the
  Worker exit event, code0, with no forced or protocol failure. Thread identity is
  recorded separately from the host Node process PID.
- Actual Worker exit independently demonstrates that its host sockets are gone.
  This may permit physical cleanup/lease return after exact owned containers also
  stop; it never rewrites a failed exec or missing result into a successful close.
- A startup failure carries its owned handle through a local WeakMap so the
  database owner includes it in shutdown. No unidentified Worker is abandoned or
  generic caller-supplied error property trusted for resource ownership.
- Exec create/upgrade failures await actual control/socket close events. Failed
  creation with no accepted exec ID does not mean the daemon never created an exec.
  The parent still stops the exact owned container. The relay also observes actual
  client close rather than treating `destroy()` as positive closure evidence.
- Frame/truncation/socket classifications are locally constructed and sanitized.
  No daemon response body, raw exception, credential, argv/env or stream payload is
  persisted. Unexpected errors remain failures.

## Source and acceptance boundary

This is a same-module Worker entry in `truthsrc-runtime-db-relay.mjs`; existing
session/runtime support fingerprints cover the executed module. The database owner
retains failed-start handles. No public tool source, runtime artifact, business
truth,35 handwritten Scala files or31 fixed Scala oracles were modified.

Full workshop17 remains PASS on its exact earlier bytes. Session19 remains FAIL;
its five leases were recovered manually after independent physical-exit and exact
owner/marker checks, not normal release. The two ended19 containers and two empty
networks were subsequently removed, preserving bind data, anonymous volume and
all failed receipts. These outcomes must not be re-signed for this new code.

At document creation the first actual CLI/TCP smoke run is in progress. The
controlled main-thread-blocking comparison, Worker404/inspect/create-timeout and
unexpected-exit probes, final full workshop and new independent session are
**not yet verified**. The Node lexical contracts are updated but not executed;
no test/typecheck/import-and-call substitutes for the required real surfaces.
Refer to new owner-specific receipts for later results rather than interpreting
this static implementation note as an acceptance certificate.
