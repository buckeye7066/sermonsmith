# Google Play store listing — SermonSmith (`com.sermonsmith.app`)

Prepared 2026-07-13. **LIVE in Play Console as of 2026-08-02** — this copy and
these graphics were published to the Main store listing and verified after
reload, so treat this file as the record of what is live, not a to-do.

The publisher service account still has release permissions only: the
"Manage store presence" grant is set in Console but the API returns 403 anyway
(Google-side defect — see `app-store-publisher/PUBLISHING.md`). The listing was
therefore published by driving the Console UI, not via the Publisher API.

## App details

| Field | Value |
|---|---|
| App name | SermonSmith |
| Default language | en-US |
| Contact email | dr.johnwhite@axiombiolabs.org |
| Contact website | https://sermonsmith.axiombiolabs.org |
| Privacy policy URL | https://sermonsmith.axiombiolabs.org/privacy |
| Category | Books & Reference |

Both URLs use the branded domain (the canonical public home since 2026-08-02);
the `sermonsmith.vercel.app` equivalents still resolve but are no longer used
in the store listing.

## Short description (80 chars max)

```
AI-powered Bible study, sermon builder & Scripture reader for church leaders
```

## Full description (4000 chars max)

```
SermonSmith helps pastors, Sunday School teachers, VBS leaders, and Christian educators prepare biblically grounded teaching — with AI assistance that drafts, and you who decides.

MEET LARRY — YOUR SERMON ASSISTANT
• Generate a complete, review-ready sermon draft from a topic or passage
• Find fitting Scripture passages and supporting texts
• Enhance illustrations and adapt the message for different audiences

MEET ARLYNN — YOUR SERIES SPECIALIST
• Plan 3–12 week sermon series with a coherent theological trajectory
• Sermons that build on each other, week over week
• Small-group discussion questions for every installment

READ AND STUDY SCRIPTURE
• Full Bible reader with multiple translations
• Verse of the Day with reflection
• Bible Study Generator: personal or group study guides on any topic
• Interactive, age-specific study plans with daily activities
• Multi-perspective study: see how Catholic, Orthodox, Reformed, Wesleyan, and other traditions read the same passage
• Explore dozens of worldviews and Christian ethics topics

GROW TOGETHER
• Community discussion forum
• Study groups around books or themes
• Share notes, highlights, and insights
• Build quizzes for your class or youth group

Every AI draft is clearly a draft: SermonSmith checks Scripture references against real Bible text and keeps you — the teacher — in charge of the final word.

"Study to show yourself approved unto God." — 2 Timothy 2:15
```

## Graphics (in this folder)

| File | Use | Size |
|---|---|---|
| `icon-512.png` | App icon | 512×512 |
| `feature-graphic.png` | Feature graphic | 1024×500 |
| `02-home.png` … `01-login.png` | Phone screenshots (upload in numeric order: 02, 03, 04, 05, 06, 01) | 1080×2160 |

Screenshots were captured 2026-07-13 from the live production web app
(identical UI to the Capacitor build) at a Pixel-class viewport.

## Data safety form — answers consistent with /privacy

- Collects: email address, name, optional profile photo (account management);
  user-generated content (app functionality). All encrypted in transit;
  deletable via in-app account deletion.
- Shares data with processors only: OpenAI (AI prompts), Stripe (web
  payments only — no in-app purchases), Resend (transactional email),
  Vercel/Railway (hosting).
- No ads, no third-party analytics/tracking SDKs, no data sold.
- Payments happen only on the website; the app itself has no purchase flow
  (native billing gate, PRs #71/#72).

## Content rating questionnaire hints

Reference/educational religious app. No user-tracking ads, no gambling, no
violence/sexual content. Contains user-generated content (community forum,
moderated — see `moderateCommunityContent` admin tooling) — answer the UGC
section accordingly. Target audience: adults / 18+ or 13+ (do NOT target
children; the privacy policy states not directed at under-13).
