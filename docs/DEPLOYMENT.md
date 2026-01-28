# Deployment Guide: Vercel + Railway + Postgres

This guide covers deploying SermonSmith's multi-target architecture to production.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    Deployments                       │
├─────────────────────────────────────────────────────┤
│  Vercel (Web)        │  Railway (API + Postgres)    │
│  sermonsmith.        │  api.sermonsmith.            │
│  axiombiolabs.org    │  axiombiolabs.org            │
├─────────────────────────────────────────────────────┤
│  GitHub Releases     │  Local Builds                │
│  - Electron (Win/    │  - Development testing       │
│    Mac/Linux)        │  - Capacitor Android build   │
│  - Android APK       │                              │
└─────────────────────────────────────────────────────┘
```

---

## Prerequisites

- GitHub account with repository access
- Vercel account (free or Pro)
- Railway account (free or Pro)
- GoDaddy DNS access (for custom domain)
- Node.js 18+ installed locally

---

## 1. Railway Deployment (API Backend + Postgres)

### 1.1 Create Railway Project

1. **Sign up at [Railway.app](https://railway.app)**
   - Connect GitHub account
   - Verify email

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose `buckeye7066/sermonsmith`
   - Railway will auto-detect as Node.js app

3. **Add Postgres Database**
   - In project dashboard, click "New Service"
   - Select "Postgres"
   - Railway provisions database automatically
   - Connection string available in `DATABASE_URL` variable

### 1.2 Configure Environment Variables

In Railway dashboard → Project → Variables tab:

```bash
# Node environment
NODE_ENV=production

# Database (auto-set by Railway)
DATABASE_URL=postgresql://...

# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET=your-super-secret-jwt-key-here-change-me

# Cookie settings
COOKIE_DOMAIN=.axiombiolabs.org
COOKIE_SECURE=true

# CORS settings
CORS_ORIGIN=https://sermonsmith.axiombiolabs.org

# API Port (Railway auto-assigns, but can override)
PORT=3000

# Optional: External APIs
OPENAI_API_KEY=sk-...  # If using AI features
```

### 1.3 API Directory Structure (Future)

When creating `/services/api`, structure:

```
/services/api/
├── package.json          # API dependencies
├── server.js             # Express/Fastify entry
├── prisma/
│   └── schema.prisma     # Database schema
├── src/
│   ├── routes/
│   │   ├── auth.js       # /api/auth/*
│   │   ├── sermons.js    # /api/sermons/*
│   │   └── bible.js      # /api/bible/*
│   ├── middleware/
│   │   ├── auth.js       # JWT validation
│   │   └── cors.js       # CORS config
│   └── utils/
│       └── db.js         # Prisma client
└── .env.example          # Environment template
```

### 1.4 Railway Build & Deploy Settings

In `railway.toml` (future):

```toml
[build]
builder = "NIXPACKS"
buildCommand = "cd services/api && npm install && npx prisma migrate deploy && npm run build"

[deploy]
startCommand = "cd services/api && npm start"
healthcheckPath = "/api/health"
healthcheckTimeout = 100
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

### 1.5 Database Migrations

After Postgres provisioned:

```bash
# Local setup (connect to Railway DB)
cd services/api
DATABASE_URL="postgresql://..." npx prisma migrate deploy

# Or via Railway CLI
railway link
railway run npx prisma migrate deploy
```

Create initial migration:

```bash
npx prisma migrate dev --name init
```

### 1.6 Health Check Endpoint

Railway expects `/api/health`:

```javascript
// In server.js
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: db.$connect ? 'connected' : 'disconnected'
  });
});
```

---

## 2. Vercel Deployment (Web Frontend)

### 2.1 Create Vercel Project

1. **Sign up at [Vercel.com](https://vercel.com)**
   - Connect GitHub account

2. **Import Repository**
   - Click "New Project"
   - Select `buckeye7066/sermonsmith`
   - Vercel auto-detects Vite config

3. **Configure Build Settings**
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

### 2.2 Environment Variables

In Vercel Dashboard → Settings → Environment Variables:

```bash
# API Backend URL (Railway)
VITE_API_URL=https://api.sermonsmith.axiombiolabs.org

# Optional: Public keys for client-side SDKs
VITE_GOOGLE_ANALYTICS_ID=G-...
VITE_SENTRY_DSN=https://...
```

**Note:** Remove old Base44 variables:
- ~~`VITE_BASE44_APP_ID`~~
- ~~`VITE_BASE44_BACKEND_URL`~~

### 2.3 Vercel Configuration

Create `vercel.json` in root:

```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://api.sermonsmith.axiombiolabs.org/api/:path*"
    }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Credentials",
          "value": "true"
        },
        {
          "key": "Access-Control-Allow-Origin",
          "value": "https://sermonsmith.axiombiolabs.org"
        },
        {
          "key": "Access-Control-Allow-Methods",
          "value": "GET,POST,PUT,PATCH,DELETE,OPTIONS"
        },
        {
          "key": "Access-Control-Allow-Headers",
          "value": "Content-Type, Authorization"
        }
      ]
    }
  ]
}
```

### 2.4 Custom Domain Setup (Vercel)

1. **Add Domain**
   - Vercel Dashboard → Settings → Domains
   - Add `sermonsmith.axiombiolabs.org`
   - Vercel provides DNS records

2. **Configure GoDaddy DNS** (see section 4 below)

---

## 3. Cookie & CORS Configuration

### 3.1 httpOnly Cookie Requirements

**Critical for security:** Auth tokens must use httpOnly cookies.

**Backend (Railway API):**

```javascript
// In auth route (login)
res.cookie('auth_token', jwtToken, {
  httpOnly: true,           // JavaScript cannot access
  secure: true,             // HTTPS only
  sameSite: 'none',         // Cross-domain (Vercel → Railway)
  maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
  domain: '.axiombiolabs.org',       // Subdomain sharing
  path: '/'
});
```

**Frontend (Vercel):**

```javascript
// Axios config
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,  // Send cookies cross-domain
  headers: {
    'Content-Type': 'application/json'
  }
});
```

### 3.2 CORS Configuration

**Backend (Railway API):**

```javascript
const cors = require('cors');

app.use(cors({
  origin: [
    'https://sermonsmith.axiombiolabs.org',  // Production web
    'http://localhost:5173',                 // Local dev
    'capacitor://localhost',                 // Capacitor Android
    'http://localhost'                       // Electron
  ],
  credentials: true,  // Allow cookies
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Preflight requests
app.options('*', cors());
```

### 3.3 SameSite Attribute Considerations

| Value | Use Case | Cookies Sent? |
|-------|----------|---------------|
| `Strict` | Same-site only | ❌ Vercel → Railway |
| `Lax` | Same-site + top-level GET | ❌ Vercel → Railway |
| `None` | Cross-site (requires Secure) | ✅ Vercel → Railway |

**Decision:** Use `SameSite=None; Secure` for cross-domain cookies.

**Fallback:** If cookies blocked, use `Authorization: Bearer <token>` header with localStorage.

---

## 4. GoDaddy DNS Configuration

### 4.1 Preferred Setup (Subdomain)

Configure DNS for `sermonsmith.axiombiolabs.org`:

**In GoDaddy DNS Management:**

1. **Add CNAME for Web (Vercel)**
   ```
   Type:  CNAME
   Name:  sermonsmith
   Value: cname.vercel-dns.com
   TTL:   1 Hour
   ```

2. **Add CNAME for API (Railway)**
   ```
   Type:  CNAME
   Name:  api.sermonsmith
   Value: [railway-provided-dns]
   TTL:   1 Hour
   ```
   
   **Get Railway DNS:** Railway Dashboard → Project → Settings → Domains

3. **Verify DNS Propagation**
   ```bash
   dig sermonsmith.axiombiolabs.org
   dig api.sermonsmith.axiombiolabs.org
   ```
   
   Or use: [dnschecker.org](https://dnschecker.org)

### 4.2 Alternative: Root Domain

If using root domain `sermonsmith.com`:

1. **Web (Vercel)**
   ```
   Type:  A
   Name:  @
   Value: 76.76.21.21  # Vercel IP (check Vercel docs)
   TTL:   1 Hour
   ```

2. **API (Railway)**
   ```
   Type:  CNAME
   Name:  api
   Value: [railway-provided-dns]
   TTL:   1 Hour
   ```

### 4.3 SSL Certificates

- **Vercel:** Auto-provisions Let's Encrypt SSL (no action needed)
- **Railway:** Auto-provisions SSL for custom domains (no action needed)

Both should show 🔒 padlock in browser within 24 hours.

---

## 5. Electron Desktop Deployment

### 5.1 Build Configuration

In `electron-builder.yml`:

```yaml
appId: com.sermonsmith.app
productName: SermonSmith
directories:
  output: dist-electron
files:
  - "**/*"
  - "!**/*.{ts,tsx}"
  - "!**/node_modules/*/{CHANGELOG.md,README.md}"

win:
  target:
    - nsis
  icon: src/assets/icons/icon.ico
  
mac:
  target:
    - dmg
    - zip
  icon: src/assets/icons/icon.icns
  category: public.app-category.education

linux:
  target:
    - AppImage
    - deb
  icon: src/assets/icons/icon.png
  category: Education

publish:
  provider: github
  owner: buckeye7066
  repo: sermonsmith
```

### 5.2 Update First-Run Wizard

In `electron/first-run.html`, update to point to Railway:

```html
<form id="setup-form">
  <h2>SermonSmith Setup</h2>
  <p>Enter your API server URL:</p>
  
  <label for="backendUrl">API URL:</label>
  <input 
    type="url" 
    id="backendUrl" 
    placeholder="https://api.sermonsmith.axiombiolabs.org"
    required
  />
  
  <button type="submit">Save & Continue</button>
</form>
```

Remove `appId` field (no longer needed).

### 5.3 Build Commands

```bash
# Build for current platform
npm run electron:build

# Build for Windows
npm run electron:build:win

# Build for macOS (requires Mac)
npm run electron:build:mac

# Build for Linux
npm run electron:build:linux

# Build for all platforms (requires Mac)
npm run electron:build:all
```

Output in `dist-electron/`:
- Windows: `SermonSmith Setup.exe`
- macOS: `SermonSmith.dmg`, `SermonSmith.zip`
- Linux: `SermonSmith.AppImage`, `sermon-smith.deb`

### 5.4 GitHub Releases

1. **Create Release**
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. **Upload Installers**
   - Go to GitHub → Releases → Draft new release
   - Tag: `v1.0.0`
   - Upload files from `dist-electron/`

3. **Auto-Update** (Future)
   - electron-builder supports auto-update from GitHub Releases
   - Configure in `electron/main.js`

---

## 6. Android (Capacitor) Deployment

### 6.1 Sync Web to Android

```bash
# Build web app
npm run build

# Sync to Capacitor
npx cap sync android

# Open in Android Studio
npx cap open android
```

### 6.2 Configure API URL

In `capacitor.config.ts`:

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sermonsmith.app',
  appName: 'SermonSmith',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // For production API
    url: 'https://sermonsmith.axiombiolabs.org',
    cleartext: false
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000
    }
  }
};

export default config;
```

**Cookie Note:** Capacitor WebView supports cookies, but:
- Use `webDir: 'dist'` (local HTML)
- API calls via `fetch()` with `credentials: 'include'`

### 6.3 Build APK

In Android Studio:

1. **Configure Signing**
   - Build → Generate Signed Bundle/APK
   - Create new keystore (first time)
   - Save keystore credentials securely

2. **Build APK**
   - Build → Build Bundle(s) / APK(s) → Build APK(s)
   - Output: `android/app/build/outputs/apk/release/app-release.apk`

3. **Test on Device**
   ```bash
   adb install android/app/build/outputs/apk/release/app-release.apk
   ```

### 6.4 Play Store Deployment (Future)

1. **Create Play Console account** ($25 one-time fee)
2. **Upload APK/AAB**
3. **Complete store listing**
4. **Submit for review**

---

## 7. CI/CD Pipeline (Future)

### 7.1 GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test  # If tests exist

  deploy-api:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Railway
        run: |
          # Railway auto-deploys on push
          echo "Railway will deploy automatically"

  deploy-web:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Vercel
        run: |
          # Vercel auto-deploys on push
          echo "Vercel will deploy automatically"

  build-electron:
    needs: test
    if: startsWith(github.ref, 'refs/tags/v')
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run electron:build
      - uses: actions/upload-artifact@v3
        with:
          name: electron-${{ matrix.os }}
          path: dist-electron/*
```

### 7.2 Preview Deployments

**Vercel:** Automatic preview deployments for every PR
- URL: `sermonsmith-git-<branch>-<user>.vercel.app`
- Test changes before merging

**Railway:** Manual PR environments
- Railway Dashboard → Create PR environment
- Test API changes in isolation

---

## 8. Monitoring & Logging

### 8.1 Railway Metrics

Railway provides:
- CPU usage
- Memory usage
- Network traffic
- Request logs (stdout/stderr)

**Access logs:**
```bash
railway logs --tail 100
```

### 8.2 Vercel Analytics

Enable in Vercel Dashboard → Analytics:
- Page views
- Core Web Vitals
- Error tracking

**Or integrate Sentry:**

```bash
npm install @sentry/react @sentry/vite-plugin
```

In `vite.config.js`:

```javascript
import { sentryVitePlugin } from "@sentry/vite-plugin";

export default defineConfig({
  plugins: [
    react(),
    sentryVitePlugin({
      org: "your-org",
      project: "sermonsmith",
      authToken: process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
});
```

### 8.3 Database Monitoring

Railway Postgres includes:
- Connection count
- Query performance
- Storage usage

**External tools:**
- [Prisma Studio](https://www.prisma.io/studio) - GUI for database
- [pgAdmin](https://www.pgadmin.org/) - Postgres client

---

## 9. Environment-Specific Configs

### 9.1 Development

```bash
# .env.development
VITE_API_URL=http://localhost:3000
DATABASE_URL=postgresql://localhost:5432/sermonsmith_dev
JWT_SECRET=dev-secret-change-in-production
NODE_ENV=development
```

### 9.2 Staging

```bash
# Railway: Set via dashboard
VITE_API_URL=https://api-staging.sermonsmith.axiombiolabs.org
DATABASE_URL=[Railway Staging Postgres]
JWT_SECRET=[Staging Secret]
NODE_ENV=staging
```

### 9.3 Production

```bash
# Railway: Set via dashboard
VITE_API_URL=https://api.sermonsmith.axiombiolabs.org
DATABASE_URL=[Railway Production Postgres]
JWT_SECRET=[Strong Production Secret]
NODE_ENV=production
```

---

## 10. Troubleshooting

### 10.1 CORS Errors

**Symptom:** Browser console shows "CORS policy: No 'Access-Control-Allow-Origin'"

**Fix:**
1. Verify Railway API has `cors({ credentials: true })`
2. Check `CORS_ORIGIN` matches exact Vercel URL (with https://)
3. Ensure Vercel frontend uses `withCredentials: true`

### 10.2 Cookies Not Sent

**Symptom:** API returns 401 Unauthorized, even after login

**Fix:**
1. Verify `SameSite=None; Secure` in cookie
2. Check domain matches: `.axiombiolabs.org`
3. Ensure HTTPS on both Vercel and Railway
4. Test in Incognito (extensions can block cookies)

### 10.3 Database Connection Failed

**Symptom:** Railway logs show "ECONNREFUSED" or "ETIMEDOUT"

**Fix:**
1. Verify `DATABASE_URL` env var set
2. Check Railway Postgres service is running
3. Test connection: `railway run npx prisma studio`
4. Restart Railway service

### 10.4 Vercel Build Failed

**Symptom:** Vercel deployment fails with "Module not found"

**Fix:**
1. Check `package.json` has all dependencies
2. Verify build command: `npm run build`
3. Test locally: `npm run build` (should succeed)
4. Check Vercel build logs for specific error

### 10.5 Electron App Won't Start

**Symptom:** White screen or "Failed to load resource"

**Fix:**
1. Check `vite.config.js` has `base: './'` when `ELECTRON_BUILD=true`
2. Verify API URL in first-run wizard
3. Test with dev mode: `npm run electron:dev`
4. Check Electron console logs (View → Toggle Developer Tools)

---

## 11. Deployment Checklist

### Pre-Deployment
- [ ] API backend code complete and tested
- [ ] Database migrations ready
- [ ] Environment variables documented
- [ ] Frontend updated to use new API client
- [ ] Electron first-run wizard updated
- [ ] Android Capacitor config updated

### Railway (API)
- [ ] Railway project created
- [ ] Postgres addon added
- [ ] Environment variables set
- [ ] Database migrations run
- [ ] Health check endpoint works
- [ ] Custom domain configured
- [ ] SSL certificate active

### Vercel (Web)
- [ ] Vercel project created
- [ ] GitHub repo connected
- [ ] Environment variables set
- [ ] Build succeeds locally
- [ ] Preview deployment works
- [ ] Custom domain configured
- [ ] SSL certificate active

### DNS (GoDaddy)
- [ ] CNAME for `sermonsmith` → Vercel
- [ ] CNAME for `api.sermonsmith` → Railway
- [ ] DNS propagation verified (dig/nslookup)
- [ ] HTTPS works on both domains

### Electron
- [ ] First-run wizard tested with production API
- [ ] Installers built for Win/Mac/Linux
- [ ] GitHub Release created
- [ ] Download links tested

### Android
- [ ] Capacitor synced with latest web build
- [ ] API URL configured
- [ ] APK signed and built
- [ ] Tested on physical device

### Testing
- [ ] Login/logout flows work
- [ ] Cookies persist across sessions
- [ ] CORS working (no errors in console)
- [ ] Offline mode still functional
- [ ] Mobile responsive
- [ ] All pages load correctly

### Monitoring
- [ ] Vercel Analytics enabled
- [ ] Railway logs accessible
- [ ] Error tracking configured (Sentry)
- [ ] Database backups scheduled

---

## 12. Support & Resources

### Documentation Links
- [Vercel Docs](https://vercel.com/docs)
- [Railway Docs](https://docs.railway.app)
- [Vite Deployment](https://vitejs.dev/guide/static-deploy.html)
- [Electron Builder](https://www.electron.build/)
- [Capacitor Docs](https://capacitorjs.com/docs)

### Community Support
- Railway Discord: [discord.gg/railway](https://discord.gg/railway)
- Vercel GitHub: [github.com/vercel/vercel](https://github.com/vercel/vercel)
- Electron Discord: [discord.com/invite/electron](https://discord.com/invite/electron)

### Internal Team
- For deployment issues: Create GitHub issue
- For DNS issues: Contact GoDaddy admin
- For API bugs: See `docs/MIGRATION_OFF_BASE44.md`

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-28  
**Maintained By:** SermonSmith DevOps Team
