# SermonSmith AI — Production Readiness Report

**Program:** SermonSmith AI by Axiom BioLabs  
**Agent:** production-agent-sermonsmith  
**Date:** 2026-08-08  
**Source of truth:** `buckeye7066/sermonsmith` default branch `main`  
**Baseline SHA (start):** `2dffdcd2c47e95c58ffde5ffc2a1584f3c0913c6` (#90 public routing / truthful foundations)  
**Working branch:** `production-ready/sermonsmith`  
**Deployed app:** https://sermonsmith.vercel.app  
**Local worktree:** `C:\Users\firer\sermonsmith-production-ready`

## Purpose / destination

Pastor-led sermon workspace from passage to review-ready outline while preserving prayer, exegesis, pastoral judgment, denominational context, exact provider-sourced Scripture text, and explicit human review across web, desktop, and mobile.

## Phase A — Source of truth

- Prior agent connection failed; local `C:\Users\firer\sermonsmith` was on `agent/fix-security-dependency-alerts` (open draft PR #91) and was **not** treated as SoT.
- Confirmed GitHub `main` via MCP: tip `2dffdcd` — “Fix public routing and establish truthful product foundations (#90)”.
- Continued work in existing git worktree `sermonsmith-production-ready` already tracking `origin/main` at that SHA.
- Unrelated local stash on the security-deps branch was preserved (`preserve-local-security-work`).

## Phase B — Audit vs bridge 60–65 / ready 66–69

| Criterion | Status at baseline | Gap |
| --- | --- | --- |
| 60 Public Home/Pricing/Login/Privacy (+ register/reset) before auth gate | Mostly done (#90); Login waited on auth loader | Login must render before auth settles |
| 61 Truthful claims / timing coach | Done (#90 + marketingIntegrity tests) | Soften in-app Premium overclaim in Settings |
| 62 Exact provider verse wording + wrong-wording test | Missing (canon/ref only) | Add provider wording verify |
| 63 Logging minimize / registration / deletion | Logging minimized; DELETE /me existed; no Settings UI; weak email shape check | Wire deletion UI + registration email validation |
| 64 SEO / Terms / crawlable layer | SEO solid; **no Terms** | Add Terms + crawl metadata |
| 65 Production smoke on exact deployed SHA | Not run this wave | Needs owner smoke account / live secrets |
| 66 Public ungated / private protected | Largely true | Strengthen Login public path |
| 67 Provider wording + accurate canon description | Incomplete | Implement + document |
| 68 No unsupported claims | Mostly | Settings wording |
| 69 Full surface journeys on RC | Partial | Electron/Android/billing/deletion live smoke still external |

Open draft PR #91 (React 19 / Electron security bumps) is **out of scope** for this production-ready branch and remains separate.

## Phase C — Plan (executed)

1. Make `/Login` (register/forgot/reset modes) public before auth gate; add route tests.
2. Add `verifyVerseWording` service + API + tests (valid ref + wrong quote → mismatch).
3. Add Terms page + static document + sitemap/robots/vercel/vite entries.
4. Add Settings account-deletion UI wired to `DELETE /api/auth/me`.
5. Tighten registration email validation.
6. Document readiness; open PR from `production-ready/sermonsmith`.

## Phase D — Implemented changes

- `apps/web/src/App.jsx` — `/login` and `/terms` public before auth gate; Terms metadata.
- `apps/web/src/pages/TermsOfUse.jsx`, `apps/web/terms.html`, sitemap/robots/vercel/vite/e2e/seo tests.
- `services/api/src/services/verseWording.js` + route `POST /api/functions/verifyVerseWording` + rate limit + tests.
- `apps/web/src/pages/Settings.jsx` — Delete account UI; truthful Premium copy.
- `services/api/src/routes/auth.js` — email shape validation on register.
- Docs: `docs/BIBLE_SOURCES_AND_LICENSES.md`, Downloads copy distinguishing canon vs wording checks.

## Phase E — Verify

Local commands (run in worktree):

- API: `verseWording`, `functions`, `auth` vitest suites
- Web: `App.test`, `seoIntegrity`, `marketingIntegrity`
- Build: `npm run build:web` (includes `terms.html`)
- Live probe: public routes on https://sermonsmith.vercel.app (post-deploy SHA check required)

## Phase F — Review notes

- Canon/reference validation remains in `@sermonsmith/shared/scripture`; wording verification is an explicit second gate.
- Account deletion is soft-delete + session revoke (documented in Privacy).
- Signup email **verification gate** (confirm link before access) is **not** implemented; password-reset delivery path already exists when Resend is configured.

## Phase G — Integrate / release

- Open PR → merge to `main` → Vercel/Railway auto-deploy → confirm live SHA equals merged commit.
- Do **not** mark criteria 66–69 complete until live smoke (65/69) passes on that SHA.

## Blockers (honest)

1. **Owner production smoke (65/69):** registration → reset → first sermon → pastoral review → PDF open → upgrade → cancellation → deletion on the exact deployed SHA. Requires live Stripe/Resend/test mailbox credentials.
2. **Brand/trademark review (64):** required before substantial paid promotion.
3. **Desktop/mobile RC packaging journeys (69):** Electron/Android release-candidate pass not re-executed in this wave.
4. **Optional follow-up:** dedicated signup email-verification tokens (schema + Resend) if product wants gated activation beyond password-reset delivery.
5. **Separate:** draft PR #91 security dependency upgrades (React 19 / Electron) — do not conflate with this readiness PR.

## Ready criteria self-score (software)

| ID | Software state after this PR |
| --- | --- |
| 66 | Met in code + tests; confirm on deployed SHA |
| 67 | Met in code + tests; confirm provider keys on prod |
| 68 | Met for audited public + Settings surfaces |
| 69 | **Not fully met** — blocked on live multi-surface smoke |

**Status recommendation after merge+deploy of software:** `SOFTWARE COMPLETE, EXTERNAL RELEASE BLOCKER` until owner smoke (and trademark if promoting) clear.
