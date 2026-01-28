# Migration Off Base44: Complete Architecture Plan

## Executive Summary

This document outlines the complete migration plan for SermonSmith from Base44 (BaaS platform) to a self-hosted architecture using:
- **Vercel** for web frontend hosting
- **Railway** for API backend and Postgres database
- **Native authentication** replacing Base44 auth
- **Direct database access** replacing Base44 SDK calls

---

## Current Architecture (Base44-Coupled)

### Technology Stack
```
┌─────────────────────────────────────────────────────────┐
│                    Client Applications                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │   Web    │  │ Electron │  │  Android (Capacitor) │  │
│  │  (Vite)  │  │ Desktop  │  │                       │  │
│  └──────────┘  └──────────┘  └──────────────────────┘  │
│                                                           │
│         All use: @base44/sdk, @base44/vite-plugin        │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   Base44 Backend │
                    │  (BaaS Platform) │
                    │                  │
                    │  • Authentication│
                    │  • Database      │
                    │  • Functions     │
                    │  • Storage       │
                    └──────────────────┘
```

### Base44 Coupling Points Inventory

#### 1. Package Dependencies
**File:** `package.json`
```json
"@base44/sdk": "^0.8.3"
"@base44/vite-plugin": "^0.2.0"
```
- **Impact:** Core dependency for all API interactions
- **Replacement:** Custom Express/Fastify API with REST/GraphQL
- **Effort:** HIGH - Requires rewriting all API calls

#### 2. Build Configuration
**File:** `vite.config.js`
```javascript
import base44 from "@base44/vite-plugin"

export default defineConfig({
  plugins: [
    base44({
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true'
    }),
    react(),
  ],
})
```
- **Impact:** Vite plugin handles SDK imports and transformations
- **Replacement:** Standard Vite config without Base44 plugin
- **Effort:** LOW - Remove plugin, update import paths

#### 3. Base44 Client Singleton
**File:** `src/api/base44Client.js`
```javascript
import { createClient } from '@base44/sdk';

export async function getBase44() {
  return createClient({
    appId,
    serverUrl: backendUrl,
    token,
    functionsVersion,
    requiresAuth: false,
  });
}

export const base44 = createBase44Proxy();
```
- **Impact:** Central client used throughout app
- **Replacement:** Axios/Fetch client with httpOnly cookie auth
- **Effort:** HIGH - Replace all `base44.` calls with new API client
- **Functions used:**
  - `base44.auth.me()`
  - `base44.auth.logout()`
  - `base44.auth.redirectToLogin()`
  - `base44.auth.updateMe()`
  - `base44.appLogs.logUserInApp()`

#### 4. App Parameters (Query Params Model)
**File:** `src/lib/app-params.js`
```javascript
const getAppParams = () => {
  return {
    appId: getAppParamValue("app_id"),
    serverUrl: getAppParamValue("server_url"),
    token: getAppParamValue("access_token", { removeFromUrl: true }),
    fromUrl: getAppParamValue("from_url"),
    functionsVersion: getAppParamValue("functions_version"),
  }
}
```
- **Impact:** URL-based config and auth token handling
- **Replacement:** Environment variables + httpOnly cookies
- **Effort:** MEDIUM - Simplify to env vars only
- **Security Benefit:** Remove token from URL (XSS risk)

#### 5. Runtime Configuration
**File:** `src/lib/runtimeConfig.js`
```javascript
export async function getRuntimeConfig() {
  const isElectron = typeof window !== 'undefined' && window.electron?.isElectron;
  
  if (isElectron) {
    const cfg = await window.electron.getConfig();
    return { appId: cfg.appId, backendUrl: cfg.backendUrl };
  }
  
  const appId = import.meta.env.VITE_BASE44_APP_ID;
  const backendUrl = import.meta.env.VITE_BASE44_BACKEND_URL;
  return { appId, backendUrl };
}
```
- **Impact:** Multi-platform config loading
- **Replacement:** New config for Railway API URL
- **Effort:** LOW - Update env var names
- **Electron:** Update first-run wizard for new backend

#### 6. Authentication Context
**File:** `src/lib/AuthContext.jsx`
```javascript
import { base44Promise } from '@/api/base44Client';
import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';

const currentUser = await base44.auth.me();
await base44.auth.logout(window.location.href);
await base44.auth.redirectToLogin(window.location.href);
```
- **Impact:** All auth flows use Base44 SDK
- **Replacement:** Custom auth with httpOnly cookies
- **Effort:** HIGH - Rewrite entire auth system
- **Key flows:**
  - Login/logout
  - Session validation
  - User profile management
  - Public settings fetch

#### 7. Navigation Tracking (Analytics)
**File:** `src/lib/NavigationTracker.jsx`
```javascript
base44Promise
  .then((base44) => base44.appLogs.logUserInApp(pageName))
  .catch(() => {});
```
- **Impact:** User activity logging
- **Replacement:** Custom analytics endpoint or remove
- **Effort:** LOW - Optional feature
- **Decision:** Can be removed or replaced with Vercel Analytics

#### 8. Page Not Found (Auth Check)
**File:** `src/lib/PageNotFound.jsx`
```javascript
const base44 = await base44Promise;
const user = await base44.auth.me();
```
- **Impact:** Auth check for admin notes
- **Replacement:** Use new auth context
- **Effort:** LOW - Use AuthContext instead

#### 9. Layout Component
**File:** `src/Layout.jsx`
```javascript
const currentUser = await base44.auth.me();
await base44.auth.logout();
await base44.auth.redirectToLogin();
await base44.auth.updateMe({ special_message: null });
await base44.auth.updateMe({ last_seen_version: CURRENT_VERSION });
```
- **Impact:** Main layout uses Base44 for user data
- **Replacement:** New API client with same methods
- **Effort:** MEDIUM - Update all auth calls

#### 10. Electron First-Run Configuration
**File:** `electron/main.js`
```javascript
process.env.VITE_BASE44_APP_ID = config.appId;
process.env.VITE_BASE44_BACKEND_URL = config.backendUrl;
```
- **Impact:** Electron setup wizard configures Base44
- **Replacement:** Point to Railway API URL
- **Effort:** LOW - Update wizard UI and env var names

---

## Target Architecture (Self-Hosted)

### Technology Stack
```
┌──────────────────────────────────────────────────────────┐
│                   Client Applications                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐   │
│  │   Web    │  │ Electron │  │  Android (Capacitor) │   │
│  │ (Vercel) │  │ Desktop  │  │                       │   │
│  └──────────┘  └──────────┘  └──────────────────────┘   │
│                                                            │
│         httpOnly cookies + Custom API Client              │
└──────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │   Railway API (Node/Express)  │
              │   /api/auth/*                 │
              │   /api/sermons/*              │
              │   /api/bible/*                │
              │   /api/users/*                │
              └───────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │  Railway Postgres Database    │
              │  • users                      │
              │  • sermons                    │
              │  • bible_cache                │
              │  • attachments                │
              │  • audit_log (optional)       │
              └───────────────────────────────┘
```

### New Architecture Components

#### Web Frontend (Vercel)
- **Path:** `/` (current root becomes web app)
- **Domain:** `sermonsmith.axiombiolabs.org` (preferred) or custom
- **Build:** `npm run build` → `dist/` → Vercel deployment
- **Features:**
  - Server-side rendering (future)
  - Edge functions for API proxying
  - Automatic HTTPS + CDN
  - Preview deployments per PR

#### API Backend (Railway)
- **Path:** `/services/api` (new directory)
- **Stack:** Node.js + Express/Fastify + Prisma/TypeORM
- **Endpoints:**
  ```
  POST   /api/auth/login          - Login with credentials
  POST   /api/auth/logout         - Clear httpOnly cookie
  GET    /api/auth/me             - Get current user (from cookie)
  PATCH  /api/auth/me             - Update current user
  
  GET    /api/sermons             - List user's sermons
  POST   /api/sermons             - Create sermon
  GET    /api/sermons/:id         - Get sermon
  PATCH  /api/sermons/:id         - Update sermon
  DELETE /api/sermons/:id         - Delete sermon
  
  GET    /api/bible/translations  - List translations
  GET    /api/bible/passage       - Get Bible passage
  POST   /api/bible/cache         - Cache passage
  ```
- **Auth:** JWT in httpOnly cookie (SameSite=None, Secure)
- **CORS:** Allow credentials from Vercel domain

#### Database (Railway Postgres)
- **Provider:** Railway Postgres addon
- **Connection:** Prisma with connection pooling
- **Migrations:** Prisma Migrate or Drizzle
- **Schema:**
  ```sql
  users (
    id, email, password_hash, full_name, role,
    onboarding_completed, last_seen_version,
    created_at, updated_at
  )
  
  sermons (
    id, user_id, title, content, scripture_references,
    created_at, updated_at
  )
  
  bible_cache (
    id, translation, book, chapter, verses_json,
    cached_at, expires_at
  )
  
  attachments (
    id, sermon_id, file_url, file_type, file_size,
    uploaded_at
  )
  
  audit_log (
    id, user_id, action, resource_type, resource_id,
    metadata_json, created_at
  )
  ```

---

## Migration Plan: Step-by-Step

### Phase 1: Backend Foundation (Week 1)
- [ ] **1.1** Create `/services/api` directory structure
  - Express/Fastify app
  - Prisma schema
  - Auth middleware
- [ ] **1.2** Set up Railway project
  - Add Railway Postgres addon
  - Configure environment variables
  - Deploy hello-world API
- [ ] **1.3** Implement authentication
  - JWT generation/validation
  - httpOnly cookie setup
  - Password hashing (bcrypt)
- [ ] **1.4** Create user endpoints
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `GET /api/auth/me`
  - `PATCH /api/auth/me`
- [ ] **1.5** Database migrations
  - Create `users` table
  - Seed test users
  - Test authentication flow

### Phase 2: Data Migration (Week 2)
- [ ] **2.1** Export data from Base44
  - Users table → CSV/JSON
  - Sermons table → CSV/JSON
  - Bible cache → CSV/JSON
- [ ] **2.2** Create import scripts
  - Parse Base44 exports
  - Map to new schema
  - Handle ID references
- [ ] **2.3** Import to Railway Postgres
  - Users first (get new IDs)
  - Sermons with user_id mapping
  - Bible cache
- [ ] **2.4** Verify data integrity
  - Row counts match
  - Relationships intact
  - Sample queries work

### Phase 3: API Development (Week 3-4)
- [ ] **3.1** Implement sermon endpoints
  - `GET /api/sermons`
  - `POST /api/sermons`
  - `GET /api/sermons/:id`
  - `PATCH /api/sermons/:id`
  - `DELETE /api/sermons/:id`
- [ ] **3.2** Implement Bible endpoints
  - `GET /api/bible/translations`
  - `GET /api/bible/passage`
  - `POST /api/bible/cache`
- [ ] **3.3** Add audit logging (optional)
  - Middleware for action tracking
  - `audit_log` table inserts
- [ ] **3.4** API testing
  - Integration tests
  - Load tests
  - Error handling

### Phase 4: Frontend Migration (Week 5-6)
- [ ] **4.1** Create new API client
  - `/src/api/apiClient.js` (Axios with credentials)
  - Replace `base44Client.js` usage
  - Support web, Electron, Android
- [ ] **4.2** Update AuthContext
  - Remove Base44 SDK imports
  - Use new API client
  - Handle cookie-based auth
- [ ] **4.3** Replace all `base44.` calls
  - Search: `grep -r "base44\." src/`
  - Replace with `apiClient.` calls
  - Update function signatures
- [ ] **4.4** Remove Base44 dependencies
  - Uninstall `@base44/sdk`
  - Uninstall `@base44/vite-plugin`
  - Update `vite.config.js`
  - Clean up `app-params.js`
- [ ] **4.5** Update Electron config
  - First-run wizard: remove appId field
  - Point to Railway API URL
  - Update `runtimeConfig.js`

### Phase 5: Deployment (Week 7)
- [ ] **5.1** Deploy API to Railway
  - Production deployment
  - Environment variables
  - Database connection
  - Health check endpoint
- [ ] **5.2** Deploy web to Vercel
  - Connect GitHub repo
  - Configure build settings
  - Set environment variables
  - Custom domain setup
- [ ] **5.3** DNS configuration
  - GoDaddy: `sermonsmith.axiombiolabs.org` → Vercel
  - Verify HTTPS working
  - Test CORS + cookies
- [ ] **5.4** Build Electron + Android
  - Test with production API
  - Ensure cookies work
  - Package installers

### Phase 6: Testing & Cutover (Week 8)
- [ ] **6.1** Smoke tests
  - Login/logout flows
  - Create/edit sermon
  - Bible reader
  - Offline mode
- [ ] **6.2** Regression tests
  - Web: All pages load
  - Electron: First-run wizard
  - Android: Auth + data sync
- [ ] **6.3** Performance tests
  - API response times < 200ms
  - Database queries optimized
  - Frontend loading < 3s
- [ ] **6.4** User acceptance testing
  - Beta testers
  - Collect feedback
  - Fix critical bugs
- [ ] **6.5** Go-live cutover
  - Update DNS (if not done)
  - Monitor errors
  - Ready rollback plan

---

## Rollback Plan

### Immediate Rollback (< 1 hour after cutover)
If critical issues detected:

1. **Revert DNS** (if changed)
   - GoDaddy: Point back to Base44 URL
   - TTL: ~5-15 minutes propagation
   
2. **Revert Frontend** (Vercel)
   - Vercel Dashboard → Deployments → Previous deployment
   - Click "Promote to Production"
   - Takes effect immediately

3. **Keep API Running** (Railway)
   - Don't destroy - useful for debugging
   - Database remains intact

4. **Restore Base44 Client** (Git)
   ```bash
   git revert <migration-commit>
   git push origin main
   npm install  # Restore @base44/sdk
   npm run build
   ```

### Extended Rollback (1-7 days after cutover)
If persistent issues after initial cutover:

1. **Re-enable Base44 backend**
   - Ensure Base44 subscription active
   - No data loss if < 30 days

2. **Re-sync data** (if any new data created)
   - Export from Railway Postgres
   - Import to Base44
   - Manual SQL scripts

3. **Notify users**
   - In-app banner about temporary rollback
   - Email communication

### Rollback Decision Criteria
**Trigger rollback if:**
- Authentication failure rate > 10%
- API error rate > 5%
- Database connection failures
- Electron/Android builds broken
- Data corruption detected
- Critical security vulnerability

**Do NOT rollback for:**
- Minor UI issues (can be fixed forward)
- Non-critical bugs
- Performance slightly slower (< 2x)
- Individual user issues (debug separately)

---

## Risk Mitigation

### Authentication Risks
- **Risk:** httpOnly cookies not working cross-domain
- **Mitigation:** 
  - Test SameSite=None, Secure flags
  - Use same domain for web + API (api.sermonsmith.axiombiolabs.org)
  - Electron: Use localhost proxy

### Data Loss Risks
- **Risk:** Migration script fails, data corrupted
- **Mitigation:**
  - Export full Base44 backup before migration
  - Test import on staging database first
  - Keep Base44 subscription active for 30 days post-cutover

### Offline Mode Risks
- **Risk:** Offline caching breaks with new API
- **Mitigation:**
  - Test IndexedDB caching with new endpoints
  - Ensure Service Worker updated
  - Regression tests for offline scenarios

### Electron/Android Risks
- **Risk:** Cookie-based auth doesn't work in native apps
- **Mitigation:**
  - Test on actual devices early
  - Fallback: Use custom headers with token if needed
  - Electron: Can use session cookies directly

### Performance Risks
- **Risk:** Self-hosted slower than Base44
- **Mitigation:**
  - Railway Pro plan for better resources
  - Database connection pooling
  - Redis cache for Bible passages
  - CDN for static assets (Vercel automatic)

---

## Success Metrics

### Pre-Cutover (Staging)
- ✅ All API endpoints return < 200ms
- ✅ Database migrations complete with 0 errors
- ✅ Auth flow works on web, Electron, Android
- ✅ 100+ smoke test scenarios pass
- ✅ Load test: 100 concurrent users supported

### Post-Cutover (Production)
- ✅ User login success rate > 95% (first 24h)
- ✅ Zero data loss incidents
- ✅ API uptime > 99.5%
- ✅ Page load times ≤ 3 seconds (median)
- ✅ Zero security vulnerabilities
- ✅ Electron + Android builds functional

### Long-Term (30 days)
- ✅ User satisfaction score maintained
- ✅ No Base44-related support tickets
- ✅ Cost savings vs Base44 subscription
- ✅ Team velocity maintained/improved

---

## Cost Analysis

### Current (Base44)
- Base44 subscription: ~$50-200/month (estimated)
- Total: **$50-200/month**

### Target (Vercel + Railway)
- Vercel Pro: $20/month (or free Hobby if low traffic)
- Railway: $5/month (starter) or $20/month (pro)
- Postgres addon: Included in Railway plan
- Total: **$25-40/month** (savings: ~$10-160/month)

### Break-Even Analysis
- Migration effort: ~8 weeks = ~320 developer hours
- Hourly rate: $50/hour (junior) to $150/hour (senior)
- Total cost: $16,000 - $48,000 one-time
- Monthly savings: $10 - $160
- Break-even: 100-4800 months (not cost-justified)

**Decision:** Migrate for **control, flexibility, and learning**, not cost savings.

---

## Timeline Summary

| Phase | Duration | Effort | Dependencies |
|-------|----------|--------|--------------|
| 1. Backend Foundation | 1 week | 40 hours | Railway setup |
| 2. Data Migration | 1 week | 40 hours | Base44 export access |
| 3. API Development | 2 weeks | 80 hours | Backend foundation |
| 4. Frontend Migration | 2 weeks | 80 hours | API ready |
| 5. Deployment | 1 week | 40 hours | API + Frontend ready |
| 6. Testing & Cutover | 1 week | 40 hours | All above |
| **Total** | **8 weeks** | **320 hours** | - |

---

## Next Steps

1. **Review this document** with team and stakeholders
2. **Approve migration** or adjust timeline/scope
3. **Create Railway + Vercel accounts** and test deploys
4. **Begin Phase 1** (Backend Foundation)
5. **Update `docs/DEPLOYMENT.md`** with deployment instructions
6. **Refer to `docs/CUTOVER.md`** for day-of-cutover checklist

---

## Appendix: File Change Matrix

| File | Change Type | Effort | Description |
|------|-------------|--------|-------------|
| `package.json` | REMOVE | Low | Remove Base44 dependencies |
| `vite.config.js` | EDIT | Low | Remove Base44 plugin |
| `src/api/base44Client.js` | REPLACE | High | New `apiClient.js` with Axios |
| `src/lib/app-params.js` | REMOVE | Low | No longer needed (use env vars) |
| `src/lib/runtimeConfig.js` | EDIT | Low | Point to Railway API |
| `src/lib/AuthContext.jsx` | EDIT | High | Replace Base44 calls |
| `src/lib/NavigationTracker.jsx` | EDIT | Low | Remove or replace logging |
| `src/lib/PageNotFound.jsx` | EDIT | Low | Use AuthContext |
| `src/Layout.jsx` | EDIT | Medium | Replace Base44 auth calls |
| `electron/main.js` | EDIT | Low | Update first-run wizard |
| `electron/first-run.html` | EDIT | Low | Remove appId field |

**Total files to modify:** ~11 files  
**New files to create:** ~10 files (API backend)  
**Files to delete:** ~2 files

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-28  
**Author:** SermonSmith Migration Team  
**Status:** DRAFT - Awaiting Approval
