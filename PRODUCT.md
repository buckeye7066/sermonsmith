# Product

## Register

product

## Users

Pastors, Bible teachers, and lay Bible students preparing sermons, studies, quizzes, and prayers. They work in focused prep sessions (often weekly, on a deadline before Sunday) at a desk on web/desktop, and reference material on mobile. Many are not technical; the AI assistants (Larry for sermons, Arlynn for series) must feel like helpful colleagues, not tools that need operating.

## Product Purpose

SermonSmith is a multi-platform sermon-preparation and Bible-study workspace: Bible reader with highlights/notes/cross-references, AI sermon and series builders, study tools, worldview/ethics explorers, quiz and prayer generators, maps/timelines, and a sharing community. Success = a pastor goes from blank page to a preached sermon faster, with deeper scriptural grounding, and returns weekly. Premium AI features are the revenue engine (Stripe).

## Brand Personality

Reverent, encouraging, capable. Warm and pastoral in copy (Larry/Arlynn speak like supportive colleagues, with occasional celebratory toasts), but the interface itself stays calm and workmanlike — the text of Scripture and the user's sermon are the heroes, not the chrome.

## Anti-references

- Not a gamified faith app (no streaks/badges/confetti-first design).
- Not a generic SaaS dashboard — avoid hero-metric tiles and identical card grids as default scaffolding.
- Not academic software: no dense reference-manager UI; theological depth must stay approachable.

## Design Principles

1. **Scripture first** — reading surfaces stay quiet; toolbars and AI affordances appear on demand and never crowd the text.
2. **Never fail silently** — every action gives feedback: loading states for AI (which can take 30–60s), success toasts, and explicit validation messages on blocked submits.
3. **AI with a face** — assistant features are framed as Larry/Arlynn doing work ("Larry is writing your sermon…"), with honest progress and graceful failure copy.
4. **One flow to pulpit** — features chain toward the sermon (reader → builder → present live); don't strand output in dead-end modals.
5. **Works everywhere** — every surface must hold up in web, Electron, and Capacitor wrappers; no browser-only APIs without fallbacks.

## Accessibility & Inclusion

Target WCAG 2.1 AA. Users skew older than typical SaaS; respect larger text preferences (reader has font-size controls), maintain ≥4.5:1 body contrast in both light and dark reader themes, full keyboard operability for Present Live mode (arrow-key navigation is a core flow), and reduced-motion alternatives for streaming/typing animations.
