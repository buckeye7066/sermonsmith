# Release Gates: Go/No-Go Criteria

This document defines explicit gates that **must pass** before releasing SermonSmith to production after migration.

---

## Gate Categories

1. **Auth Gate** - Authentication system working correctly
2. **Offline Gate** - Offline mode functional
3. **Packaging Gate** - Electron + Android builds complete
4. **API Gate** - Backend ready for production traffic
5. **Regression Gate** - No existing functionality broken

Each gate has **blocking** and **non-blocking** criteria.

---

## 1. Auth Gate 🔐

### Blocking Criteria (MUST PASS)

- [ ] **Login Success Rate ≥ 95%**
  - Test: 100 login attempts (various users/browsers)
  - Metric: Success count / Total attempts
  - Reason: Core functionality - cannot ship if users can't log in

- [ ] **httpOnly Cookie Set Correctly**
  - Test: Login → Check browser DevTools → Cookies tab
  - Verify: `auth_token` has `HttpOnly=true`, `Secure=true`, `SameSite=None`
  - Reason: Security vulnerability if missing

- [ ] **Session Persistence Works**
  - Test: Login → Close browser → Reopen → Still logged in
  - Verify: No redirect to login page
  - Reason: Users expect to stay logged in

- [ ] **Logout Clears Cookie**
  - Test: Login → Logout → Check cookies
  - Verify: `auth_token` cookie removed
  - Reason: Security - prevent session hijacking

- [ ] **Token Expiration Handled**
  - Test: Set token expiry to 1 minute → Wait → Make API call
  - Verify: Redirect to login with "Session expired" message
  - Reason: Avoid confusing errors for users

- [ ] **Multi-Platform Auth Works**
  - Test: Login from Web, Electron, Android
  - Verify: All 3 can authenticate independently
  - Reason: App is multi-platform - all must work

- [ ] **No Token in localStorage**
  - Test: Login → Check localStorage in DevTools
  - Verify: No `access_token`, `auth_token`, or `jwt` keys
  - Reason: XSS vulnerability if tokens in localStorage

### Non-Blocking (Can Ship With Issues)

- [ ] **Password Reset Flow** (can add later)
- [ ] **OAuth Social Login** (future feature)
- [ ] **2FA Support** (future feature)
- [ ] **"Remember Me" Checkbox** (nice to have)

### Verification Commands

```bash
# Test login endpoint
curl -X POST https://api.sermonsmith.axiombiolabs.org/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  -c cookies.txt

# Verify cookie set
cat cookies.txt | grep auth_token

# Test authenticated request
curl https://api.sermonsmith.axiombiolabs.org/api/auth/me \
  -b cookies.txt

# Test logout
curl -X POST https://api.sermonsmith.axiombiolabs.org/api/auth/logout \
  -b cookies.txt
```

---

## 2. Offline Gate 📴

### Blocking Criteria (MUST PASS)

- [ ] **Previously Viewed Content Accessible**
  - Test: View sermon while online → Go offline → View same sermon
  - Verify: Content loads from cache (no spinner, no error)
  - Reason: Core feature promise - "works offline"

- [ ] **Offline Banner Appears**
  - Test: Disconnect internet → Wait 5 seconds
  - Verify: Banner shows "You are offline"
  - Reason: User feedback - avoid confusion

- [ ] **Online Banner Disappears**
  - Test: Reconnect internet → Wait 5 seconds
  - Verify: Banner hides or shows "Back online"
  - Reason: User feedback - confirm reconnection

- [ ] **Service Worker Registered**
  - Test: Load web app → Check DevTools → Application → Service Workers
  - Verify: Service worker status "activated and running"
  - Reason: Offline caching requires service worker

- [ ] **IndexedDB Cache Populated**
  - Test: View 3 sermons → DevTools → Application → IndexedDB
  - Verify: `sermonsmith-cache` DB has 3 sermon records
  - Reason: Cache storage for offline access

- [ ] **No Write Operations Offline**
  - Test: Go offline → Try to create sermon
  - Verify: Error message "Cannot create while offline"
  - Reason: Prevent data loss/conflicts

### Non-Blocking (Can Ship With Issues)

- [ ] **Background Sync** (future feature)
- [ ] **Offline Write Queue** (future feature)
- [ ] **Cache Size Management** (nice to have)
- [ ] **Manual Cache Clear** (can add later)

### Verification Commands

```bash
# Check if service worker served
curl -I https://sermonsmith.axiombiolabs.org/service-worker.js

# Lighthouse offline test
npx lighthouse https://sermonsmith.axiombiolabs.org \
  --only-categories=pwa \
  --output=json \
  | jq '.audits["works-offline"]'
```

---

## 3. Packaging Gate 📦

### Blocking Criteria (MUST PASS)

- [ ] **Electron Build Succeeds (Windows)**
  - Test: `npm run electron:build:win` on Windows or CI
  - Verify: `dist-electron/SermonSmith Setup.exe` exists, file size > 100MB
  - Reason: Windows is primary target platform

- [ ] **Electron Build Succeeds (macOS)**
  - Test: `npm run electron:build:mac` on macOS
  - Verify: `dist-electron/SermonSmith.dmg` exists
  - Reason: macOS users expect native builds

- [ ] **Electron Build Succeeds (Linux)**
  - Test: `npm run electron:build:linux` on Linux or CI
  - Verify: `dist-electron/SermonSmith.AppImage` exists
  - Reason: Linux users expect AppImage

- [ ] **Electron App Launches Successfully**
  - Test: Install built app → Launch → See main window
  - Verify: No white screen, no crash, UI loads
  - Reason: Users can't use app if it won't start

- [ ] **Electron First-Run Wizard Works**
  - Test: Clear config → Launch app → See wizard
  - Verify: Can enter API URL, save, app loads
  - Reason: New users need to configure app

- [ ] **Android APK Builds Successfully**
  - Test: `npm run cap:sync && cd android && ./gradlew assembleRelease`
  - Verify: `android/app/build/outputs/apk/release/app-release.apk` exists
  - Reason: Android is a target platform

- [ ] **Android APK Installs on Device**
  - Test: `adb install app-release.apk` → Launch app
  - Verify: App icon appears, launches without crash
  - Reason: Users can't use app if it won't install

- [ ] **All Builds Use Production API**
  - Test: Check config in built apps
  - Verify: API URL points to `https://api.sermonsmith.axiombiolabs.org`
  - Reason: Dev API should not be in production builds

### Non-Blocking (Can Ship With Issues)

- [ ] **Auto-Update Feature** (future feature)
- [ ] **Code Signing** (nice to have, can add later)
- [ ] **Play Store Upload** (future distribution)
- [ ] **App Store Upload** (future distribution)

### Verification Commands

```bash
# Build all platforms
npm run electron:build:all

# Check output files
ls -lh dist-electron/

# Verify API URL in built app (Mac example)
unzip dist-electron/SermonSmith-mac.zip
strings SermonSmith.app/Contents/Resources/app.asar | grep api.sermonsmith

# Android build
cd android && ./gradlew assembleRelease

# Check APK size (should be 20-50MB)
ls -lh android/app/build/outputs/apk/release/app-release.apk
```

---

## 4. API Gate 🚀

### Blocking Criteria (MUST PASS)

- [ ] **Health Check Returns 200 OK**
  - Test: `curl https://api.sermonsmith.axiombiolabs.org/api/health`
  - Verify: `{"status":"ok","database":"connected"}`
  - Reason: Basic availability check

- [ ] **Database Migrations Applied**
  - Test: `railway run npx prisma migrate status`
  - Verify: "Database is up to date"
  - Reason: Schema must match code

- [ ] **API Response Time < 200ms (P50)**
  - Test: 100 requests to `/api/auth/me` → Calculate median
  - Verify: 50th percentile response time < 200ms
  - Reason: Performance baseline for good UX

- [ ] **API Response Time < 500ms (P95)**
  - Test: Same as above, check 95th percentile
  - Verify: 95% of requests < 500ms
  - Reason: Acceptable for slow network/queries

- [ ] **API Error Rate < 1%**
  - Test: 1000 requests → Count 5xx errors
  - Verify: Error count / Total < 0.01
  - Reason: High error rate indicates instability

- [ ] **Database Connection Pool Works**
  - Test: Send 50 concurrent requests
  - Verify: All succeed, no "too many connections" errors
  - Reason: Must handle reasonable concurrency

- [ ] **CORS Headers Present**
  - Test: `curl -H "Origin: https://sermonsmith.axiombiolabs.org" -I https://api.sermonsmith.axiombiolabs.org/api/health`
  - Verify: Response has `Access-Control-Allow-Origin` header
  - Reason: Web app cannot call API without CORS

- [ ] **SSL Certificate Valid**
  - Test: `curl https://api.sermonsmith.axiombiolabs.org` (no --insecure flag)
  - Verify: No SSL errors, certificate from Railway/Let's Encrypt
  - Reason: Security - required for httpOnly cookies

### Non-Blocking (Can Ship With Issues)

- [ ] **GraphQL Endpoint** (future feature)
- [ ] **WebSocket Support** (future feature)
- [ ] **Rate Limiting** (can add later)
- [ ] **API Versioning** (nice to have)

### Verification Commands

```bash
# Health check
curl -f https://api.sermonsmith.axiombiolabs.org/api/health

# Response time test (requires Apache Bench)
ab -n 100 -c 10 https://api.sermonsmith.axiombiolabs.org/api/health

# Database migrations
railway run npx prisma migrate status

# CORS test
curl -H "Origin: https://sermonsmith.axiombiolabs.org" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -X OPTIONS \
  https://api.sermonsmith.axiombiolabs.org/api/auth/login -v

# SSL check
openssl s_client -connect api.sermonsmith.axiombiolabs.org:443 -servername api.sermonsmith.axiombiolabs.org < /dev/null
```

---

## 5. Regression Gate 🧪

### Blocking Criteria (MUST PASS)

- [ ] **All Pages Load Without Errors**
  - Test: Visit every page listed in `src/pages.config.js`
  - Verify: No 404, no white screen, no console errors
  - Reason: Users expect all features to work

- [ ] **Bible Reader Loads Passages**
  - Test: Navigate to Reader → Search "John 3:16" → View passage
  - Verify: Verse text appears correctly
  - Reason: Core feature - primary use case

- [ ] **Sermon Builder Creates Sermon**
  - Test: Sermon Builder → Fill form → Click "Save"
  - Verify: Sermon appears in "My Sermons"
  - Reason: Core feature - primary use case

- [ ] **My Sermons Lists Sermons**
  - Test: Navigate to "My Sermons"
  - Verify: Previously created sermons display
  - Reason: Users need to access saved work

- [ ] **Sermon Edit Works**
  - Test: My Sermons → Click sermon → Edit title → Save
  - Verify: Title updates in list
  - Reason: Users expect to edit saved work

- [ ] **User Profile Displays**
  - Test: Settings → View profile
  - Verify: Name, email, role display correctly
  - Reason: Users expect to see their info

- [ ] **Navigation Works (All Links)**
  - Test: Click every sidebar link
  - Verify: Correct page loads, URL changes
  - Reason: Broken navigation = unusable app

- [ ] **No Console Errors on Any Page**
  - Test: Open DevTools → Console → Visit all pages
  - Verify: No red errors (warnings OK)
  - Reason: Errors indicate bugs

- [ ] **Mobile Responsive (< 768px)**
  - Test: Resize browser to 375px width → Check all pages
  - Verify: Content readable, no horizontal scroll
  - Reason: Many users on mobile devices

- [ ] **Electron: All Features Work**
  - Test: Open Electron app → Test Bible reader, Sermon builder
  - Verify: Same functionality as web
  - Reason: Desktop users expect feature parity

- [ ] **Android: All Features Work**
  - Test: Open Android app → Test Bible reader, Sermon builder
  - Verify: Same functionality as web
  - Reason: Mobile users expect feature parity

### Non-Blocking (Can Ship With Issues)

- [ ] **Minor UI glitches** (can fix in patch release)
- [ ] **Non-critical features** (e.g., analytics, quiz builder)
- [ ] **Performance optimizations** (can improve later)
- [ ] **Accessibility improvements** (important but not blocking)

### Verification Commands

```bash
# Run linter (must pass)
npm run lint

# Type checking (must pass)
npm run typecheck

# Build (must succeed)
npm run build

# Check for console errors (manual)
# Open each page and check browser console

# Mobile test (Chrome DevTools)
# F12 → Toggle device toolbar → iPhone SE → Visit all pages
```

---

## Gate Summary Matrix

| Gate | Blocking Criteria | Non-Blocking | Est. Time to Pass |
|------|-------------------|--------------|-------------------|
| **Auth** | 7 criteria | 4 | 2 hours |
| **Offline** | 6 criteria | 4 | 1 hour |
| **Packaging** | 8 criteria | 4 | 3 hours |
| **API** | 8 criteria | 4 | 2 hours |
| **Regression** | 11 criteria | 4 | 4 hours |
| **Total** | **40 criteria** | **20** | **12 hours** |

---

## Go/No-Go Decision Process

### Step 1: Run All Tests (Day Before Release)

```bash
# Run test suite
npm run lint
npm run typecheck
npm run build
npm run test  # If tests exist

# Build all packages
npm run electron:build:all
cd android && ./gradlew assembleRelease

# Manual smoke tests
# - Login/logout
# - Create sermon
# - View Bible passage
# - Test offline mode
```

### Step 2: Fill Out Gate Checklist

Copy this checklist and mark each item:

```
Auth Gate: [7/7] ✅
Offline Gate: [6/6] ✅
Packaging Gate: [8/8] ✅
API Gate: [8/8] ✅
Regression Gate: [11/11] ✅

Total: 40/40 ✅ GO FOR LAUNCH
```

### Step 3: Decision Matrix

| Score | Decision | Action |
|-------|----------|--------|
| **40/40** | ✅ **GO** | Release immediately |
| **38-39/40** | ⚠️ **CONDITIONAL GO** | Review failed items. If minor, release with known issues logged. |
| **35-37/40** | ⚠️ **HOLD** | Fix critical issues first, re-test. |
| **< 35/40** | ❌ **NO-GO** | Too many failures. Delay release, fix issues. |

### Step 4: Document Known Issues

If releasing with < 40/40, document:

```markdown
## Known Issues in v1.0.0

- [ ] Issue: Password reset not implemented (Auth Gate - non-blocking)
  - Impact: Users cannot reset forgotten passwords
  - Workaround: Contact support for manual reset
  - Fix ETA: v1.1.0

- [ ] Issue: Cache size management missing (Offline Gate - non-blocking)
  - Impact: Cache may grow unbounded over time
  - Workaround: Clear browser data periodically
  - Fix ETA: v1.2.0
```

### Step 5: Get Approval

**Required Approvers:**
1. Lead Developer (technical review)
2. Product Owner (business review)
3. QA Lead (testing review)

**Approval Format:**

```
✅ Lead Developer: APPROVED - All blocking criteria pass
✅ Product Owner: APPROVED - Ready for users
✅ QA Lead: APPROVED - Testing complete

Decision: GO FOR LAUNCH
Release Date: [YYYY-MM-DD HH:MM UTC]
```

---

## Post-Release Monitoring (First 24 Hours)

After release, monitor these metrics:

### Critical Metrics (Check Every Hour)

- [ ] **Login Success Rate ≥ 90%**
  - Source: Railway logs, Vercel Analytics
  - Alert: < 90%

- [ ] **API Error Rate < 5%**
  - Source: Railway metrics
  - Alert: > 5%

- [ ] **Web App Uptime > 99%**
  - Source: Vercel status
  - Alert: < 99%

- [ ] **No Data Loss Reports**
  - Source: User support tickets
  - Alert: Any report

### Important Metrics (Check Every 4 Hours)

- [ ] **Page Load Time < 5s (median)**
  - Source: Vercel Analytics
  - Alert: > 5s

- [ ] **Support Tickets < 10/day**
  - Source: Support system
  - Alert: > 10 tickets

- [ ] **User Complaints < 5**
  - Source: Email, GitHub issues
  - Alert: > 5 complaints

### Rollback Triggers

**Immediately rollback if:**
- Login success rate drops below 80%
- API error rate exceeds 10%
- Data loss confirmed
- Security vulnerability discovered

**Follow rollback plan in `docs/CUTOVER.md`**

---

## Continuous Improvement

After each release:

1. **Review Failed Gates**
   - Why did criteria fail?
   - How to prevent in future?

2. **Update Gates**
   - Add new criteria based on learnings
   - Remove outdated criteria

3. **Automate Tests**
   - Convert manual checks to CI tests
   - Add monitoring dashboards

4. **Document Lessons**
   - What went well?
   - What went wrong?
   - Action items for next release

---

## CI Integration (Future)

Add to `.github/workflows/release-gates.yml`:

```yaml
name: Release Gates

on:
  push:
    tags:
      - 'v*'

jobs:
  auth-gate:
    runs-on: ubuntu-latest
    steps:
      - name: Test Login Endpoint
        run: |
          response=$(curl -s -o /dev/null -w "%{http_code}" -X POST ...)
          if [ $response -ne 200 ]; then exit 1; fi

  offline-gate:
    runs-on: ubuntu-latest
    steps:
      - name: Check Service Worker
        run: npx lighthouse ... --only-categories=pwa

  packaging-gate:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    steps:
      - name: Build Electron
        run: npm run electron:build

  api-gate:
    runs-on: ubuntu-latest
    steps:
      - name: Health Check
        run: curl -f https://api.sermonsmith.axiombiolabs.org/api/health

  regression-gate:
    runs-on: ubuntu-latest
    steps:
      - name: Run Tests
        run: npm test
      - name: Lint
        run: npm run lint
      - name: Type Check
        run: npm run typecheck
```

---

## Appendix: Test Scripts

### Auth Gate Test Script

```bash
#!/bin/bash
# test-auth-gate.sh

API_URL="https://api.sermonsmith.axiombiolabs.org"
PASSED=0
FAILED=0

echo "Testing Auth Gate..."

# Test 1: Login endpoint
response=$(curl -s -o /dev/null -w "%{http_code}" -X POST $API_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}')

if [ $response -eq 200 ]; then
  echo "✅ Login endpoint returns 200"
  ((PASSED++))
else
  echo "❌ Login endpoint failed (status: $response)"
  ((FAILED++))
fi

# Test 2-7: Similar tests...

echo "Auth Gate: $PASSED passed, $FAILED failed"
if [ $FAILED -eq 0 ]; then
  exit 0
else
  exit 1
fi
```

### Regression Gate Test Script

```bash
#!/bin/bash
# test-regression-gate.sh

WEB_URL="https://sermonsmith.axiombiolabs.org"
PASSED=0
FAILED=0

echo "Testing Regression Gate..."

# Test pages load
pages=("/" "/pages/Reader" "/pages/SermonBuilder" "/pages/MySermons")

for page in "${pages[@]}"; do
  status=$(curl -s -o /dev/null -w "%{http_code}" $WEB_URL$page)
  if [ $status -eq 200 ]; then
    echo "✅ $page loads"
    ((PASSED++))
  else
    echo "❌ $page failed (status: $status)"
    ((FAILED++))
  fi
done

echo "Regression Gate: $PASSED passed, $FAILED failed"
exit $FAILED
```

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-28  
**Review Frequency:** Before every major release  
**Owner:** QA Team
