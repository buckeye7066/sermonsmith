# Google Play store listing — SermonSmith (`com.sermonsmith.app`)

Prepared 2026-07-13. Ready-to-paste copy plus final graphics for the Play
Console store listing. The publisher service account currently has release
permissions only — committing listing changes via the API returns 403 until
the account is granted **"Manage store presence"** in Play Console → Users
and permissions. Until then, paste these by hand (Grow → Store presence →
Main store listing).

## App details

| Field | Value |
|---|---|
| App name | SermonSmith |
| Default language | en-US |
| Contact email | buckeye7066@gmail.com |
| Contact website | https://sermonsmith.vercel.app |
| Privacy policy URL | https://sermonsmith.vercel.app/privacy |
| Category | Books & Reference (or Lifestyle) |

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
