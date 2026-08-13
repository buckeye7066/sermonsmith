# SermonSmith AI — Production Readiness Report

**Program:** SermonSmith AI by Axiom BioLabs  
**Agent:** production-agent-sermonsmith (`38a2e9f5-3a13-4b2a-a3d7-f46c26e77026`)  
**Date:** 2026-08-08 / 2026-08-09  
**Source of truth:** `buckeye7066/sermonsmith` default branch `main`  
**Baseline SHA (start):** `2dffdcd2c47e95c58ffde5ffc2a1584f3c0913c6` (#90)  
**Merged production SHA:** `1ad92a17f9bd583e6c6639bde83590f442295d16` (#92)  
**Working branch:** `production-ready/sermonsmith`  
**PR:** https://github.com/buckeye7066/sermonsmith/pull/92 (MERGED)  
**Deployed app:** https://sermonsmith.vercel.app  
**Local worktree:** `C:\Users\firer\sermonsmith-production-ready`  
**Status:** `SOFTWARE COMPLETE, EXTERNAL RELEASE BLOCKER`

## Purpose / destination

Pastor-led sermon workspace from passage to review-ready outline while preserving prayer, exegesis, pastoral judgment, denominational context, exact provider-sourced Scripture text, and explicit human review across web, desktop, and mobile.

## Phase A — Source of truth

- Prior agent connection failed; `C:\Users\firer\sermonsmith` was on `agent/fix-security-dependency-alerts` (draft PR #91) and was **not** SoT.
- Confirmed GitHub `main` tip at start: `2dffdcd` — “Fix public routing and establish truthful product foundations (#90)”.
- Continued in worktree `sermonsmith-production-ready` on `production-ready/sermonsmith`.
- Unrelated security-deps branch left untouched.

## Phase B — Audit vs bridge 60–65 / ready 66–69

| Criterion | Baseline gap | Resolution in #92 |
| --- | --- | --- |
| 60 Public Home/Pricing/Login/Privacy (+ register/reset) | Login waited on auth loader | `/login` renders before auth settles (session-hint exception only) |
| 61 Truthful claims / timing coach | Soften Settings Premium overclaim | Settings copy corrected |
| 62 Exact provider verse wording | Missing | `verifyVerseWording` + mismatch tests |
| 63 Logging / registration / deletion | No Settings deletion UI; weak email | DELETE UI + email shape validation |
| 64 SEO / Terms / crawlable | No Terms | Terms page + `terms.html` + sitemap/robots |
| 65 Production smoke on exact SHA | Not run | Still owner-gated |
| 66 Public ungated / private protected | Mostly | Strengthened Login/Terms public path |
| 67 Provider wording + canon honesty | Incomplete | Implemented + documented |
| 68 No unsupported claims | Mostly | Settings + Terms wording |
| 69 Full surface RC journeys | Partial | External: Electron/Android/billing smoke |

## Phase C — Plan (executed)

1. Public `/login` + `/terms` before auth gate  
2. Provider wording verify API + tests  
3. Terms static/crawl surface  
4. Settings account deletion  
5. Registration email validation  
6. Pin `nanoid@3.3.17` to clear CI security-audit (GHSA-2v37-7h3g-55p8) without React 19 migration (#91)

## Phase D — Implemented (merged in #92)

- Public Login/Terms routing; Terms page + crawlable `terms.html`
- `services/api/src/services/verseWording.js` + `POST /api/functions/verifyVerseWording`
- Bugbot follow-up: reject quote-superset matches; Terms claim adjusted to API/provider compare
- Settings deletion UI; registration email validation; Premium copy honesty
- `package.json` override `nanoid: 3.3.17`

## Phase E — Verify (evidence)

Local (worktree):

- API vitest: verseWording + functions + auth — **35 passed** (initial); wording/functions recheck after Bugbot — **13 passed**
- Web vitest: App + seoIntegrity + marketingIntegrity — **24 passed**
- `npm run build:web` produced `dist/terms.html` with title “SermonSmith Terms of Use”
- `npm run audit` OK after nanoid pin (fast-uri remain allowlisted to 2026-09-15)

CI on PR #92 (head after nanoid fix):

- lint-and-typecheck, test, security-audit, build-web, integration-test, e2e — all **pass**
- Cursor Approval + Security agents — **pass**

Post-merge on `main` @ `1ad92a17…`:

- CI run `31285808235` — **success**
- Railway Deploy Monitor `31285808230` / `verify-deploy` — **success** (fresh successful `sermonsmith-api` deploy)
- Android build — **success**

Live probes https://sermonsmith.vercel.app (after merge):

| Path | HTTP | Content evidence |
| --- | --- | --- |
| `/` | 200 | Marketing shell |
| `/login` | 200 | Public |
| `/pricing` | 200 | Public |
| `/privacy` | 200 | Public |
| `/terms` | 200 | Public SPA route |
| `/downloads` | 200 | Public |
| `/terms.html` | 200 | **Title: SermonSmith Terms of Use** (was app shell before deploy) |
| `/robots.txt` | 200 | Allows `/terms` |
| `/sitemap.xml` | 200 | Includes `/terms` lastmod 2026-08-08 |

Pre-merge `/terms.html` returned signed-in app shell title; post-merge returns Terms title — Vercel production updated for #92 surfaces.

## Phase F — Review

- Canon/reference validation (`@sermonsmith/shared/scripture`) remains separate from provider wording verify.
- Wording match = exact normalized equality OR quoted excerpt ⊆ provider text (superset quotes rejected).
- Account deletion = soft-delete + session revoke.
- Signup email **verification tokens** not implemented (password-reset path exists when Resend configured).
- Draft PR #91 (React 19 / Electron) remains **out of scope**.

## Phase G — Integrate / release

1. Pushed `production-ready/sermonsmith`
2. Opened PR #92 → CI green after nanoid pin
3. Squash-merged to `main` → SHA `1ad92a17f9bd583e6c6639bde83590f442295d16`
4. Vercel live Terms/sitemap/robots updated; Railway API deploy monitor **success**
5. Exact embedded git SHA string is not exposed in the static HTML; deploy correlation is via merge time + new Terms artifact + Railway verify-deploy success + main CI success on that commit

## Blockers (honest) → EXTERNAL RELEASE BLOCKER

1. **Owner production smoke (65/69):** register → reset → first sermon → pastoral review → PDF → upgrade → cancel → delete on deployed SHA — needs live Stripe/Resend/test mailbox.
2. **Brand/trademark review (64)** before substantial paid promotion.
3. **Desktop/mobile RC packaging journeys (69)** not re-executed this wave.
4. Optional: signup email-verification tokens if product wants gated activation.
5. Separate: draft PR #91 security dependency upgrades.

## Ready criteria self-score

| ID | State |
| --- | --- |
| 66 | Met in code + tests + live public route HTTP 200 |
| 67 | Met in code + tests; prod Bible provider keys assumed from existing Railway deploy success |
| 68 | Met for audited public + Settings + Terms surfaces |
| 69 | **Not fully met** — live multi-surface smoke external |

**Final status:** `SOFTWARE COMPLETE, EXTERNAL RELEASE BLOCKER`
