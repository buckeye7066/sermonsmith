# Gate Verification Report

**Branch:** `copilot/gate-verification-security-audit-fix`  
**Base commit:** `031f2f3` (ahead of `969bbb7` / main)  
**Run date:** 2026-08-19  
**Prior state from problem statement:** main at c55dcef scored 100/100 (2026-08-04, stale reference)

---

## PR #89 Status

**PR #89 — "Fix sermon PDF export downloading an unopenable file"** was **merged** to main on 2026-08-04 by @buckeye7066 (SHA `6a00980`). No action required.

The fix replaced a broken backend stub call (which produced an unopenable blob) with a real client-side jsPDF renderer in `apps/web/src/lib/sermonPdf.js`. The security-audit script was updated in that PR to allowlist GHSA-7p8r-x3mc-p8w7 (`fast-uri` via `electron-store → ajv`) with full documented reasoning and a `reviewBy` date.

---

## All Eight Gates

| # | Gate | Command | Result | Notes |
|---|------|---------|--------|-------|
| 1 | **config:verify** | `npm run config:verify` | ✅ PASS | Vercel routing, security headers, cache policy aligned |
| 2 | **typecheck** | `npm run typecheck` | ✅ PASS | web + api, 52 api files parsed |
| 3 | **lint** | `npm run lint` | ✅ PASS | web ESLint + api ESLint, 0 warnings |
| 4 | **test:api** | `npm run test:api` | ✅ PASS | 411 tests across 28 files |
| 5 | **test:web** | `npm run test:web` | ✅ PASS | 315 tests across 24 files |
| 6 | **build:web** | `npm run build:web` | ✅ PASS | Production build in 30.83s |
| 7 | **e2e** | `npm run test:e2e` | ✅ PASS | 8 Playwright journeys (12.9s) |
| 8 | **audit** | `npm run audit` | ✅ PASS | 0 unallowlisted advisories (see below) |

**Overall: 8/8 PASS — 100/100**

---

## Security Audit

### npm audit result
```
found 0 vulnerabilities
```

### Allowlisted advisories (documented in `scripts/security-audit.mjs`)

Both entries were assessed and documented in PR #89 before being added to the allowlist.

#### GHSA-qwww-vcr4-c8h2 — React Router RSC-mode CSRF
- **Why not applicable:** SermonSmith is a classic `BrowserRouter` SPA with no RSC, no server actions, no framework-mode server runtime. The vulnerable code path is never reachable.
- **Real fix:** `react-router@8.3.0` requires `react>=19.2.7` — a React 18→19 migration, not a simple bump.
- **Review by:** 2026-10-01
- **Dependabot:** Alert #176 dismissed as `not_used` on 2026-08-02.

#### GHSA-7p8r-x3mc-p8w7 — fast-uri host confusion
- **Why not applicable:** `fast-uri` is not a direct dependency. Only path: `@sermonsmith/desktop → electron-store → conf → ajv`. The flaw matters where a parsed host drives a security decision (origin allowlists, SSRF); no such decision exists on this path.
- **Real fix:** `fast-uri >= 3.1.5` via npm `overrides`, but npm 11.16.0 did not apply it to the nested ajv copy. Prefer upstream fix from `conf`/`electron-store`.
- **Review by:** 2026-09-15

---

## Security Review: Auth Flow

`apps/web/src/lib/AuthContext.jsx` and `apps/web/src/api/apiClient.js` were reviewed.

- **JWT storage:** No token is stored in localStorage or sessionStorage. The JWT lives exclusively in an `httpOnly` cookie set by the server. ✅
- **localStorage use:** Only a boolean session-hint key (`sermonsmith.authenticated-session = '1'`) is stored — no token, no sensitive data. ✅
- **apiClient:** Uses `withCredentials: true` (or equivalent) so the httpOnly cookie is sent automatically; no manual token attachment. ✅
- **Auth middleware** (`services/api/src/middleware/auth.js`): reads cookie, verifies JWT, checks `tokenVersion` for invalidation on password change. ✅

---

## Security Review: PDF Export Path

`apps/web/src/lib/sermonPdf.js` was reviewed.

- **User content:** Sermon title used in filename is passed through `sanitizeFilename()` which strips `[^\w\s-]`, trims, collapses whitespace, and caps at 60 chars. ✅
- **Filename injection:** No path traversal possible — browser's `jsPDF.save()` only influences the suggested download name. ✅
- **No server round-trip:** PDF is generated entirely client-side from the in-memory sermon object; no user content reaches the backend on this path. ✅
- **scripture entries:** Normalized via `scriptureLabel()` which safely handles strings and objects. ✅

---

## Test Counts

| Suite | Files | Tests |
|-------|-------|-------|
| API (vitest) | 28 | 411 |
| Web (vitest) | 24 | 315 |
| E2E (Playwright) | 2 | 8 |
| **Total** | **54** | **734** |

---

## Dependabot / GitHub Security Alerts

- Dependabot alert #176 (GHSA-qwww-vcr4-c8h2, React Router RSC CSRF) — dismissed as `not_used` on 2026-08-02. ✅
- No other open high/critical alerts affecting production code.

---

## Summary

All eight gates pass. The security audit is clean (0 unallowlisted advisories). Auth flow correctly uses httpOnly cookies with no token in localStorage. PDF export sanitizes filename and generates entirely client-side with no user-content leakage to the backend. The codebase is in a healthy, verified state.
