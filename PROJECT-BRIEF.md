# SermonSmith — Project Brief

**Version:** 1.0  
**Last Updated:** 2026-08-19

---

## Overview

SermonSmith is a multi-platform sermon-preparation and Bible-study workspace for pastors, Bible teachers, and lay Bible students. It supports the full arc from scriptural research through outline drafting, AI-assisted writing, live delivery, and community sharing — available on web, Electron desktop, and Android (Capacitor).

---

## Sermon Creation Workflow

```
Bible Reader → Sermon Builder → Review & Edit → Present Live → Archive & Share
```

### Step 1 — Research (Bible Reader)
- Read Scripture in multiple translations
- Highlight verses and attach notes
- Follow cross-references
- Save reference sets to a sermon draft

### Step 2 — Outline (Sermon Builder — "Larry")
- Select a passage or topic, pick a sermon style
- Larry (GPT-4o-mini) generates a structured outline with introduction, points, illustrations, and conclusion
- Edit sections inline; re-run individual sections
- Scripture references are embedded and linked back to the Reader

### Step 3 — Series Planning (Series Builder — "Arlynn")
- Extend a single sermon into a multi-week series
- Arlynn adapts teaching context per week (youth, adult, mixed)
- Each week's output feeds back into the Sermon Builder

### Step 4 — Delivery Aids
- **Present Live (Teleprompter):** full-screen, keyboard-controlled (arrow keys), adjustable scroll speed and font size — works in web and Electron
- **Study Notes:** condensed outline card for on-platform reference during delivery
- **Collaborative Editor:** real-time co-editing of sermon drafts

### Step 5 — Archive & Discovery
- **My Sermons:** personal library with title, date, and passage metadata; full-text search
- **Sermon Library:** browse and filter your full archive
- **Sermon Analytics:** engagement and delivery statistics per sermon
- **Community / Forum:** share sermons and study content; join or create study groups

---

## Supported Content Formats

| Feature | Format |
|---|---|
| Sermon drafts | Rich text (stored as JSON blobs in PostgreSQL via Prisma) |
| Bible translations | Fetched from Bible API; displayed in Reader |
| Outlines | Structured JSON rendered as editable sections |
| PDF export | Generated client-side via `jspdf`; filename sanitised before save |
| Shared content | Public links (SharedContent page) |
| Quiz questions | Structured JSON, exportable |

---

## Delivery Tools

| Tool | Description |
|---|---|
| Present Live (Teleprompter) | Full-screen mode; arrow-key navigation; adjustable font and speed |
| Study Notes | Condensed notes view for quick reference |
| Collaborative Sermon Editor | Multi-user real-time editing |
| PDF Export | One-click PDF generation and download |
| Downloads | Manage exportable resources |

---

## Archive & Discovery Features

| Feature | Description |
|---|---|
| My Sermons | Personal sermon library; filter by date and passage |
| Sermon Library | Full archive with search |
| Sermon Analytics | View count, engagement, and delivery history per sermon |
| Community | Public sharing; comment threads; study-group collaboration |
| Forum | Discussion boards for shared topics |
| Study Groups | Create or join groups; share study plans and sermons |
| Shared Content | Public permalink for any shared sermon or plan |

---

## Scripture Reference Management

- Verses are embedded in sermon drafts with book / chapter / verse metadata
- Cross-references surfaced inline in the Bible Reader
- Highlights and notes persist per user per verse in the database
- Bible Study page provides multi-perspective analysis (thematic, theological, practical, historical)
- Bible Maps page places events on interactive geographic and chronological timelines
- Christian Ethics page explores passages through multiple theological traditions
- Worldview Explorer compares scriptural interpretation across Christian and world perspectives

---

## AI Assistants

| Name | Scope | Model |
|---|---|---|
| Larry | Sermon outlines, full drafts, individual section rewrites | GPT-4o-mini (`OPENAI_MODEL`) |
| Arlynn | Multi-week series planning | GPT-4o-mini (`OPENAI_MODEL`) |

Both assistants are rate-limited (30 AI requests / 1 min per IP) and gated behind the premium subscription (Stripe). Feature flags `DISABLE_AI` and `DISABLE_BILLING` allow local development without secrets.

---

## Platform Support

| Platform | Toolchain | Status |
|---|---|---|
| Web | React 18 + Vite 6 → Vercel | Production |
| Desktop | Electron (main.cjs / preload.cjs) | Distributable |
| Android | Capacitor wrapping the web build | Signed release v1.0.57 |

All new features must be tested on all three platforms before merge (see `AGENTS.md` rules).

---

## Security

- JWT stored exclusively in httpOnly cookies; never in `localStorage` or `sessionStorage`
- `localStorage` holds only non-sensitive session hint (`'1'`) for redirect logic
- Passwords hashed with bcrypt; `tokenVersion` bump invalidates all JWTs on password change
- Password-reset tokens SHA-256-hashed at rest
- Centralized API client (`apps/web/src/api/apiClient.js`) for all backend calls
- Rate limiters: auth 20/15 min, register 10/1 hr, reset 5/15 min, AI 30/1 min, public 60/1 min
- `CORS_ORIGIN` allowlist; `COOKIE_SAMESITE` = `"none"` cross-domain (Railway/Vercel)

---

## Testing

```bash
npm test              # api + web vitest + shared unit tests
npm run test:api      # API only (vitest, ~411 tests / 28 files)
npm run test:web      # Web only (vitest, ~315 tests / 24 files)
npm run test:e2e      # Playwright end-to-end (8 journeys)
npm run audit         # Security audit script (allowlist-aware)
```

The nightly sweep (`tools/agents/sweep.mjs`) runs all 8 CI gates and writes a health-score report to `tools/agents/reports/` (gitignored).

---

## Build & Deploy

```bash
npm run build         # build:web + check:api (lint + typecheck + test for api)
npm run db:generate   # Prisma client generate (required before API tests)
npm run db:migrate    # dev migration
npm run db:migrate:deploy  # prod migration
npm run release:check # full pre-release gate
```

- **Web → Vercel:** automatic on push to `main` via GitHub integration
- **API → Railway:** automatic on push to `main` (source: `buckeye7066/sermonsmith`, branch `main`)

---

## Repository Conventions

See `AGENTS.md` for the full non-negotiable rule set. Key rules:

1. All API calls via `src/api/apiClient.js` — no bare `fetch()` in components
2. No tokens in `localStorage` — httpOnly cookies only
3. All features tested on Web, Electron, and Android
4. CI must pass before merge
5. Auth / API / offline-cache changes require senior review
