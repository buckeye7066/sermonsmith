# SermonSmith

**SermonSmith** is a calm, plain-language workspace for preparing sermons and Bible lessons — from reading Scripture to preaching.

It is built for pastors, teachers, and Bible students who want an obvious place to read Scripture, study a passage, and build a message without needing technical knowledge.

## What you can do first

- **Read Scripture** — open the Bible and begin with the passage in front of you.
- **Study** — explore the meaning, context, and teaching ideas for a passage.
- **Build Sermon/Lesson** — turn your study into a clear sermon, lesson, or teaching outline.

The Home screen also explains the two helpers in plain language:

- **Larry** helps draft one sermon or lesson.
- **Arlynn** helps plan a multi-week sermon or lesson series.

## User-facing workflow

The main navigation follows the ministry workflow:

1. Read Scripture
2. Study
3. Build Sermon/Lesson
4. Plan Series
5. Library
6. Present

Every item opens a real screen. If an area is not fully built yet, SermonSmith shows a friendly placeholder that explains what will live there and what the user can do right now instead. Ordinary users do not see developer or admin links in the primary navigation.

## Run locally

From the repository root:

```bash
npm install
npm run dev
```

The web app runs from the `apps/web` workspace.

## Build

From the repository root:

```bash
npm run build:web
```

This creates the deployable static web build for the frontend.

## Routing and static hosting

The web app uses client-side routing with hash URLs. This keeps direct links working on simple static hosts without extra server rewrite rules.

## Theme choice

SermonSmith supports light and dark themes. The header has a clear **Light/Dark** toggle, and the choice is saved in the browser with the key `sermonsmith.theme` so it stays the same after reload.

## How the shell is organized

- `apps/web/src/config/navItems.js` drives the primary navigation, Home workflow cards, and workflow routes.
- `apps/web/src/config/assistants.js` provides the Larry and Arlynn Home explainer.
- `apps/web/src/config/placeholders.js` provides friendly copy for not-yet-built areas.
- `apps/web/src/theme/ThemeProvider.jsx` applies and remembers the light/dark theme.
- `apps/web/src/components/AppShell.jsx` holds the persistent header, workflow navigation, theme toggle, and main content area.

## Monorepo layout

```text
apps/
  web/      React + Vite frontend
  desktop/  Electron desktop app
  mobile/   Capacitor mobile app
packages/
  shared/   Shared utilities
services/
  api/      Backend service
```
