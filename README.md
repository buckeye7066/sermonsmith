# SermonSmith

**Sermon Smith** is a comprehensive sermon preparation and Bible study application available as a web app, desktop application, and mobile app. Self-hosted with Vercel (frontend) + Railway (backend), it provides powerful tools for pastors, teachers, and Bible students.

## Features

- **Bible Reader** - Read Scripture with multiple translations, highlights, and notes
- **Sermon Builder (Larry)** - AI-powered sermon outline and content generation
- **Series Builder (Arlynn)** - Multi-week sermon series planning with teaching context adaptation
- **Bible Study** - Deep study tools with multi-perspective theological analysis
- **Worldview Explorer** - Compare interpretations across Christian traditions and world perspectives
- **Quiz Builder** - Create Bible knowledge quizzes
- **Bible Maps** - Interactive maps and timelines of biblical events
- **Christian Ethics** - Explore ethical topics from multiple theological viewpoints
- **Prayer Generator** - AI-assisted prayer writing
- **Community** - Share sermons, study plans, and collaborate with other users
- **Premium Features** - Advanced AI capabilities via Stripe subscription

## Architecture

```
├── apps/
│   ├── web/          # React + Vite frontend (deployed to Vercel)
│   ├── desktop/      # Electron desktop app
│   └── mobile/       # Capacitor mobile app (iOS/Android)
├── packages/
│   └── shared/       # Shared utilities
└── services/
    └── api/          # Express + Prisma backend (deployed to Railway)
```

### Tech Stack

| Layer     | Technology                                         |
|-----------|----------------------------------------------------|
| Frontend  | React 18, Vite 6, Tailwind CSS, Radix UI, shadcn/ui |
| Backend   | Express, Prisma ORM, PostgreSQL                     |
| Auth      | JWT (bcrypt + jsonwebtoken)                          |
| AI        | OpenAI API (GPT-4o-mini)                             |
| Payments  | Stripe                                               |
| Hosting   | Vercel (web), Railway (API + DB)                     |
| Desktop   | Electron                                             |
| Mobile    | Capacitor (iOS, Android)                             |

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL (or Railway for managed DB)
- OpenAI API key

### 1. Clone and Install

```bash
git clone https://github.com/your-org/sermonsmith.git
cd sermonsmith
npm install
```

### 2. Set Up the Backend

```bash
cd services/api
cp .env.example .env
# Edit .env with your DATABASE_URL, JWT_SECRET, OPENAI_API_KEY
npx prisma db push
npm run dev
```

### 3. Set Up the Frontend

```bash
cd apps/web
cp .env.example .env
# Leave VITE_API_URL empty for the local /api proxy. Set SERMONSMITH_DEV_API_URL
# only when the API runs on a non-default local URL.
npm run dev
```

### 4. Open in Browser

Visit `http://localhost:5173` to use the app.

## Deployment

### Frontend (Vercel)

1. Connect the repo to Vercel
2. Set root directory to `apps/web`
3. Set environment variable: `VITE_API_URL=https://your-api.up.railway.app`
4. Deploy

### Backend (Railway)

1. Create a new Railway project
2. Add a PostgreSQL database
3. Deploy from `services/api` directory
4. Set environment variables (see `services/api/.env.example`)

## Supported Platforms

| Platform | Method          |
|----------|-----------------|
| Web      | Vercel hosting  |
| Windows  | Electron        |
| macOS    | Electron        |
| Linux    | Electron        |
| Android  | Capacitor       |
| iOS      | Capacitor       |

## License

MIT

## Credits

- **AI Assistants**: Larry (Teaching & Sermon) and Arlynn (Series Specialist)
- Built with React, Vite, Prisma, Express, OpenAI, and Stripe
