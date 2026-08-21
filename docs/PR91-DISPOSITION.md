# PR #91 disposition (SermonSmith)

**PR:** https://github.com/buckeye7066/sermonsmith/pull/91  
**Branch:** `agent/fix-security-dependency-alerts` @ `456f3b2`  
**State at inspection:** open draft, mergeable_state=dirty vs main  
**Decision: SUPERSEDE / CLOSE AS OBSOLETE**

## Why not merge the old one-commit migration

PR #91 bundled:
1. Electron → 41.10.4 + electronBuilder pin sync
2. React 19.2.8 + react-router 8.3.0 migration
3. Root overrides for `fast-uri@3.1.5` and `js-yaml@4.3.1`

Current `main` @ `49d026d` already carries the security-relevant pins without the React 19 / router 8 rewrite:

- `apps/desktop` electron **41.10.4**
- root `overrides`: `nanoid@3.3.17` (via #92), `fast-uri@3.1.5`, `js-yaml@4.3.1`

Blindly merging the draft would re-litigate a large React/router surface that is not required to clear the currently addressed advisories, and would conflict with concurrent OTA (#94) package edits.

## Valid work preserved

| Item | Disposition |
|------|-------------|
| Electron 41.10.4 | Already on main — keep |
| fast-uri / js-yaml overrides | Already on main — keep |
| nanoid pin | Already on main via #92 — keep |
| React 19 + react-router 8 | **Not ported** — defer until a dedicated, fully regression-tested migration; not required for current audit allowlist / nanoid/fast-uri posture |

## Follow-up

Close PR #91 with comment pointing at this note and `main@49d026d` (or the post-merge SHA after the exec branch lands). Any remaining Dependabot alerts after that merge are handled as focused follow-ups, not by resurrecting the draft migration.
