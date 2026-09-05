# CLAUDE.md — SermonSmith

Multi-platform sermon-prep app. npm-workspaces monorepo. Auto-generated map.

## Tech stack
React 18 + Vite 6 + TS + Tailwind + Radix + TanStack Query (web) · Express + Prisma + PostgreSQL (api) · JWT via httpOnly cookies · OpenAI (GPT-4o-mini) · Stripe · Electron (desktop) · Capacitor (mobile) · Deploy: Vercel (web) + Railway (api+PG).
Web also uses `idb` (IndexedDB offline persistence) and `jspdf` (PDF export).

## Monorepo layout
- `apps/web` — React/Vite, → Vercel
- `apps/desktop` — Electron wrapper (CommonJS `main.cjs`/`preload.cjs`)
- `apps/mobile` — Capacitor, wraps built web
- `services/api` — Express + Prisma, → Railway
- `packages/shared` — shared utils (minimal)

## Run / build / test
```bash
npm run dev               # web @ :5173
npm run dev:api           # api @ :3001 (--watch)
npm run build             # build:web + check:api
npm run test              # api + web vitest workspaces
npm run lint              # web + api ESLint
npm run typecheck         # web + api
npm run test:e2e          # Playwright (web)
npm run db:generate       # Prisma client generate
npm run db:migrate        # Prisma dev migrate
npm run db:migrate:deploy # prod
npm run db:seed -w @sermonsmith/api   # no root db:seed script
npm run electron:dev
npm run cap:sync
npm run release:check
```
Engines: node >=20, npm >=10 (root `engines`).

## Entry points
- Web: `apps/web/src/main.jsx` → `App.jsx` (Router + pagesConfig + AuthProvider); `apps/web/src/api/apiClient.js` (fetch wrapper, resolves API base: Electron config → `VITE_API_URL` → origin)
- API: `services/api/src/index.js` → `buildApp()` (helmet, compression, CORS, rate-limiters, 5 route groups)
- Desktop: `apps/desktop/electron/main.cjs`

## Directory map
- `apps/web/src/` — ai/ (Larry sermon builder, Arlynn series builder), api/, components/, hooks/, lib/ (AuthContext, query-client), pages/
- `services/api/src/` — config/env.js (Zod, hard-fails in prod), middleware/ (auth, rateLimitStore), routes/ (auth, entities, ai, functions, community), services/email.js
- `services/api/prisma/schema.prisma` — User, Entity (JSON blobs, type-indexed), PasswordReset

## Where things live
| Feature | Location |
|---|---|
| Auth | `services/api/src/routes/auth.js`, `middleware/auth.js`, `apps/web/src/lib/AuthContext.jsx` (httpOnly cookies) |
| DB / migrations | `services/api/prisma/` (`schema.prisma`, `migrations/`) |
| Env vars | `services/api/.env.example` + `src/config/env.js` (Zod) |
| API client | `apps/web/src/api/apiClient.js` |
| AI | `apps/web/src/ai/` + `routes/ai.js` (OpenAI, `OPENAI_MODEL`) |
| Billing | `routes/functions.js` webhook `/api/stripe/webhook` (raw body, idempotent) |
| Email | `services/api/src/services/email.js` (Resend) |
| Rate limits | `middleware/rateLimitStore.js` (auth 20/15m, register 10/1h, reset 5/15m, ai 30/1m, public 60/1m) |

## Mobile OTA updates (Android + iOS) — restored 2026-08-19

This app shipped an OTA updater in **PR #94** and removed it in **PR #96**
("remove unsigned OTA update path") because it applied a bundle it could not
verify. The owner asked for the in-app update back on 2026-08-19, so the
capability is restored — **with the missing verification**, not without it.

- **Publish:** `scripts/build-mobile-bundle.mjs` zips `apps/web/dist` to
  `dist/mobile/bundle-<version>.zip` and writes `dist/mobile/latest.json`
  (`version`, absolute `url`, **`sha256`**, `minNativeVersion`, `notes`,
  `builtAt`). It runs on the DEPLOY build only — `npm run build:web:deploy`,
  which `vercel.json`'s `buildCommand` uses (and `scripts/verify-vercel-config.mjs`
  asserts). It is deliberately NOT a `postbuild` on `@sermonsmith/web`: `npm run
  cap:sync` runs that same build before `cap sync`, and `android-build.yml`
  rejects `assets/public/mobile/` or any packaged `.zip` in the APK **and** the
  AAB. That half of PR #96 stays — the feed is a deploy artifact, never baked
  into the signed package.
- **Consume:** `apps/web/src/lib/mobileUpdater.js` (pure, unit-tested) +
  `components/settings/MobileUpdateCard.jsx` (Settings) +
  `components/MobileUpdatePrompt.jsx` (in-app banner, mounted in `Layout.jsx`).
- **Integrity, fail CLOSED:** a manifest without a valid 64-hex `sha256` is
  rejected before any download; the checksum is passed to
  `@capgo/capacitor-updater`'s `download()` (which hashes the file and throws on
  mismatch) AND re-compared against `BundleInfo.checksum` afterwards. A mismatch
  deletes the bundle and refuses to apply it. Nothing calls `set()` on
  unverified bytes. **Do not weaken this — it is the entire reason the updater
  could come back.** `android-build.yml` now asserts the plugin IS present with
  `autoUpdate: false` and empty `updateUrl`/`statsUrl` (no Capgo cloud).
- **Notify:** `lib/mobileUpdateNotifier.js` checks on launch and on resume
  (`visibilitychange`, so no extra plugin), raises ONE
  `@capacitor/local-notifications` notice per published version, and dispatches
  `sermonsmith:mobile-update-available` for the banner. A denied notification
  permission is silent, never re-prompted, and never blocks the in-app path.
- **Native floor:** `minNativeVersion` (the `1.0.<run_number>` Android lineage,
  default `1.0`, override with `MOBILE_MIN_NATIVE_VERSION`). Below the floor the
  UI says "a new app version is required" and links to signed releases instead
  of offering a web update that cannot carry a native change.
- **Traps:** the Capacitor plugin handle is a Proxy that answers `then`, so
  returning it bare from an `async` function makes the runtime call
  `CapacitorUpdater.then()` (UNIMPLEMENTED) — `lib/capacitorUpdaterPlugin.js`
  returns it wrapped, and is also the seam tests mock. The Capacitor CLI on
  Windows writes BACKSLASH paths into `apps/mobile/ios/App/CapApp-SPM/Package.swift`;
  they must be forward slashes (the committed file had this bug for
  splash-screen/status-bar and is now fixed). iOS cannot be built or signed from
  Windows — that needs a Mac plus an Apple Developer account.

## Gotchas
- **Deploys:** web → Vercel (GitHub integration, builds from repo root → `apps/web/dist`) is genuinely automatic. API → Railway's GitHub source was found disconnected on 2026-07-05 (`sermonsmith-api` service had no repo linked — every past "auto-deploy" was actually a manual `railway up`, confirmed by a 13.5-hour gap with zero deploy activity across a merged PR). Reconnected via Railway's GraphQL `serviceConnect` mutation (repo `buckeye7066/sermonsmith`, branch `main`) — auto-deploy on merge to main should now work going forward, but after any high-stakes merge, still check `railway status --json` (service `source.repo` should read `buckeye7066/sermonsmith`) or deployment timestamps before assuming it fired, since this has silently regressed before. Do not re-add a deploy GitHub Action: a prior no-op "Deploy API (Railway)" workflow was removed because it reported a green check while doing nothing.
- **httpOnly cookie auth:** frontend never touches the JWT; Electron resolves API base at runtime via `window.electron.getApiUrl()`.
- **Electron files MUST stay `.cjs`** (`main.cjs`/`preload.cjs`) while rest of desktop is ESM — renaming to `.js` breaks startup.
- **Password reset tokens** SHA-256-hashed at rest; `tokenVersion` bump invalidates all old JWTs on password change.
- **Stripe webhook** needs raw-body mount for signature verification; idempotent.
- **Feature flags** `DISABLE_AI`/`DISABLE_BILLING`/`DISABLE_PASSWORD_RESET` skip env validation of their secrets in dev/test.
- **CORS** `CORS_ORIGIN` allowlist + `COOKIE_SAMESITE` ("none" cross-domain Railway/Vercel, "lax" same-domain); `COOKIE_DOMAIN` for subdomain sharing.
- Entity table = JSON blobs keyed by `(type, userId)`.

## Nightly self-test sweep (agents)

GrantFlow-style self-testing, right-sized for this repo (added 2026-08-02):

- `node tools/agents/sweep.mjs` runs the REAL gates — config:verify, typecheck, lint, api+web vitest, production web build, Playwright journeys (login loads, register reachable, **Bible Reader link renders scripture** — regression guard for the 2026-08-02 stale-chunk bug, sermon builder core+warning flows), security audit — then writes a health-score findings report to `tools/agents/reports/` (gitignored). `--no-fix` = observe only; `--email` sends the report via Resend when `RESEND_API_KEY` is configured.
- **Auto-fix lane** (safe classes only): `eslint --fix` on a clean tree; commits land on a fresh `agents/autofix-*` branch ONLY if the full gate re-passes (otherwise every edit is reverted). It never pushes — review and merge the branch yourself.
- Scheduled: Windows task **"SermonSmith Nightly Sweep"** daily 03:30 → `tools/agents/sweep.cmd` (logs to `tools/agents/reports/last-run.log`). The task runs whatever branch is checked out — it exists outside git.
- **Stale-chunk self-heal**: every lazy route goes through `apps/web/src/lib/lazyWithReload.js`. A deploy that rotates asset hashes used to leave open tabs/PWAs on an ErrorBoundary ("Bible reader is a broken link"); now a chunk-load failure triggers exactly one guarded reload. Don't switch pages.config.js back to bare `lazy()`.
- EVA (GrantFlow's portfolio QA runner) can now reach this app: user-scope `EVA_APP_ENV` carries a `sermonsmith` DATABASE_URL pointing at the throwaway local DB `sermonsmith_eva` (migrated). If Prisma migrations change shape, re-run `npm run db:migrate:deploy` against that DB or EVA's journeys will hit drift.

## Test-suite traps

- The API suite's `serves every chapter of every multi-token book` test makes 711
  supertest requests (237 chapters x 3 translations). It carries an explicit 120s
  timeout because it lands just over vitest's 15s default on a slow or busy box.
  If it fails, read the assertion - do not assume the timeout is the problem again.
- `qs` is pinned by a root `overrides` entry because express 4 constrains it to
  `~6.15.1`, which caps below the patched 6.16.0. npm will NOT apply a newly added
  override to an existing tree: the lockfile and node_modules both have to be
  removed and reinstalled before the override takes effect.

## Obsidian AI Bus — recall before you derive

This repo shares the machine's Obsidian vault (`G:\Obsidian Vault`) with every other
agent here (Claude Code, Codex, Cursor, Copilot, subagents). The vault is the CHEAP
substrate: a conclusion already written there costs a search, not a re-derivation.

**Before non-trivial work in this repo, recall first:**

```bash
python C:\Users\firer\aibus\aibus.py recall <terms>
```

It searches the whole vault — agent notes AND the owner's hand-written notes. If the
answer is already a note, quote the note instead of re-reading the repo, re-running the
audit, or re-explaining a known trap.

**Post decisions, blockers and handoffs** (never narration):

```bash
python C:\Users\firer\aibus\aibus.py post --from <agent> --topic sermonsmith "..."
python C:\Users\firer\aibus\aibus.py note --from <agent> --title "..." --tag sermonsmith "..."
```

Use the topic `sermonsmith` for this repo — one topic per subject of work, not per session.
Post a handoff before finishing substantial work so the next agent does not restart from zero.

`AI Bus/messages.jsonl` is the append-only authority; `Threads/*.md` are generated by
`aibus.py sync` and must never be hand-edited.
