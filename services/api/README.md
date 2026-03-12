# SermonSmith API Server

Express + Prisma + PostgreSQL backend for SermonSmith.

## Quick Start

```bash
cp .env.example .env
# Edit .env with your credentials
npm install
npx prisma db push
npm run dev
```

## API Routes

| Route                            | Method | Auth     | Description              |
|----------------------------------|--------|----------|--------------------------|
| `/api/auth/register`             | POST   | No       | Create account           |
| `/api/auth/login`                | POST   | No       | Sign in                  |
| `/api/auth/me`                   | GET    | Required | Get current user         |
| `/api/auth/me`                   | PATCH  | Required | Update current user      |
| `/api/entities/:type`            | POST   | Required | Create entity            |
| `/api/entities/:type`            | GET    | Optional | List entities            |
| `/api/entities/:type/:id`        | GET    | Optional | Get single entity        |
| `/api/entities/:type/:id`        | PUT    | Required | Update entity            |
| `/api/entities/:type/:id`        | DELETE | Required | Delete entity            |
| `/api/entities/:type/filter`     | POST   | Optional | Filter entities          |
| `/api/entities/:type/bulk`       | POST   | Required | Bulk create entities     |
| `/api/ai/invoke`                 | POST   | Required | LLM invocation (OpenAI)  |
| `/api/ai/image`                  | POST   | Required | Image generation (DALL-E)|
| `/api/functions/biblePassage`    | POST   | Optional | Fetch bible passage      |
| `/api/functions/createCheckoutSession` | POST | Required | Stripe checkout     |

## Deployment (Railway)

1. Push to GitHub
2. Connect repo to Railway
3. Add PostgreSQL addon
4. Set environment variables from `.env.example`
5. Railway auto-deploys on push

The `Dockerfile` handles build and database migration automatically.
