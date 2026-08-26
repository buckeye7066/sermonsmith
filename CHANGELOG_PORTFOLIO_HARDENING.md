# Historical hardening log

This file previously duplicated several obsolete workflow states and implementation details. The dated history remains available in Git.

Current evidence lives in:

- `docs/COMPETITIVE-MATRIX-2026-08-25.md` for official-source capability comparisons and remaining gaps.
- `docs/production-readiness/sermonsmith.md` for the current core-path status.
- The pull request and exact-head CI results for the precise change set under evaluation.

## 2.0.0 — 2026-08-26

- Establishes a coordinated major-version boundary for web, desktop, mobile,
  API, and shared packages after removing the former intermediate lifecycle
  endpoint and client action.
- Keeps ordinary create/update payloads from older installations recoverable by
  mapping the retired lifecycle value to a private draft and removing obsolete
  metadata.
- Requires installed 1.x clients to upgrade before the 2.x API cutover; see
  `docs/V2-MIGRATION.md` for the deployment order and current write paths.
