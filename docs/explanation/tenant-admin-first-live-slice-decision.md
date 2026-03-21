# Tenant Admin First Live Slice Decision

> Status: APPROVED_WITH_STOP_BOUNDARY
> Date: 2026-03-21
> Depends on: `vista-evolved-vista-distro/docs/explanation/live-vista-capability-probe-report.md`

## Decision

The first truthful live tenant-admin slice is not a broad feature page and not a
scheduling-admin surface. It is a narrow broker-semantic proof slice that moves
live VistA data through the intended tenant-admin path for:

- current user detail via `XUS GET USER INFO`
- division discovery via `XUS DIVISION GET`

## Why This Slice Wins

- The distro live probe already proved that the UTF-8 lane is healthy,
  interactive, and contains real user and division data.
- Those two RPCs are registered live in File 8994 and match the smallest,
  lowest-parameter read path needed to validate the platform integration.
- They exercise the real bottleneck now blocking feature claims: end-to-end
  broker semantics from the intended client path.
- They are smaller and less failure-prone than `ORWU NEWPERS` or
  `ORWU CLINLOC`, which adds search semantics or broader location payloads.

## Why Other Candidates Lose

`ORWU NEWPERS` first:
Adds search behavior and parameter-shape risk before the client path is proven.

`ORWU CLINLOC` first:
Useful later, but broader than needed for the first proof slice.

SDES scheduling slice first:
Rejected. The distro probe found the relevant SDES RPCs missing in the live
UTF-8 lane.

Any write or guided-write slice first:
Rejected. No write path is proven and the queue rules forbid fake progress.

## Task 3 Entry Criteria

Task 3 should only implement enough code to prove this end-to-end path:

1. platform-side client path reaches live UTF-8 broker on port `9434`
2. authentication succeeds with the intended runtime credentials
3. `XUS GET USER INFO` returns live user data
4. `XUS DIVISION GET` returns live division data
5. tenant-admin runtime displays that live data without falling back to fixtures

## Stop Rule

If the platform-side broker path times out, mis-frames, or cannot execute the
two read RPCs above, stop the queue. Reclassify the next bounded slice as a
broker semantic repair/proof slice, not a tenant-admin feature slice.

## Bottom Line

The highest-truth next step is to prove live broker semantics for current user
and divisions. Anything larger would skip the actual risk boundary.