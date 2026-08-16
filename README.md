# SermonSmith

**SermonSmith** is your calm, plain-language workspace for preparing sermons and Bible lessons.

It is made for pastors, teachers, and Bible students who want to read Scripture, study a passage, build a sermon or lesson, plan a teaching series, keep a library, and present their message without wrestling with software.

## What you can do

- **Read Scripture** — open the Bible reader and begin with the text.
- **Study** — gather notes, questions, and helpful study material.
- **Build Sermon/Lesson** — shape one message from idea to draft.
- **Plan Series** — organize a multi-week sermon or lesson series.
- **Library** — return to saved sermons, studies, plans, and resources.
- **Present** — use a clean view when it is time to teach or preach.

## Larry and Arlynn

SermonSmith includes two plain-language helpers:

- **Larry** helps draft a single sermon or lesson.
- **Arlynn** helps plan a multi-week series.

## Run SermonSmith locally

From the root of this repo:

```bash
npm install
npm run dev
```

Then open the local address shown in your terminal.

## Build the app

```bash
npm run build
```

This creates the production build for the web app and runs the checks included in the root build command.

## Run tests

```bash
npm test
```

You can also run only the web tests:

```bash
npm run test:web
```

## Project layout

This repo is a monorepo. The main user-facing app lives in `apps/web`.

```text
apps/
  web/      SermonSmith web app
  desktop/  Desktop app wrapper
  mobile/   Mobile app wrapper
packages/   Shared code
services/   Optional service code used by features that need it
```

## Navigation and pages

The everyday navigation should stay simple and ministry-focused:

1. Read Scripture
2. Study
3. Build Sermon/Lesson
4. Plan Series
5. Library
6. Present

The web app should use one shared page or route list as the source of truth for both navigation links and rendered pages. In this repo, keep that shared list with the web app route/page configuration so a menu item cannot point to a missing screen.

Each ordinary navigation item should include:

- a stable `id`
- a plain `label`
- a `route`
- a one-line `description`
- an `icon`
- `isBuilt`
- `visibleToOrdinaryUser`

Only items with `visibleToOrdinaryUser: true` should appear in the main navigation. Admin, developer, testing, and internal review screens should not appear in the ordinary user navigation.

## Marking a feature as built

When a feature is ready for everyday use:

1. Point its route to the real page component.
2. Set `isBuilt: true` in the shared route/page list.
3. Keep the one-line description clear and non-technical.
4. Make sure the page has a visible heading and a clear next action.

## Adding a friendly placeholder

If a feature is not ready yet, do not show a blank screen or a technical error.

Add a friendly placeholder page with:

- a clear title
- one sentence explaining what will go there
- one sentence telling the user what they can do right now instead

Example tone:

> Series planning will help you organize several weeks of teaching in one place. For now, you can start one message in Build Sermon/Lesson or save ideas in your Library.

## Theme preference

SermonSmith supports light and dark themes. The theme toggle should be easy to find, clearly labeled, and remembered for the next visit.

Theme preference is stored in the browser with localStorage using a small preference object. If the saved preference is missing or cannot be read, the app should quietly use the sensible default and keep working.

## Local-first approach

SermonSmith should keep the everyday experience local-first whenever possible. Navigation, theme preference, placeholders, and ordinary draft work should work from the browser without requiring a user to understand servers or setup details.

Some advanced or connected features may use service code, but the basic workflow should remain simple: open the app, choose where to begin, and keep working.

## Plain-language rule

Every message a user sees should explain what happened and what to do next in everyday words.

Avoid raw error text, developer terms, and unexplained empty screens.
