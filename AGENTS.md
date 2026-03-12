# Repository Rules & Agent Guidelines

This document defines **non-negotiable rules** for the SermonSmith repository. These rules must be enforced by all contributors, AI agents, and automated systems.

---

## Purpose

SermonSmith is a multi-platform application (Web, Electron Desktop, Android) with strict requirements for:
- **Security** - Protecting user data and authentication
- **Architecture** - Maintaining clean, centralized patterns
- **Compatibility** - Supporting all target platforms
- **Quality** - Ensuring reliable, tested code

These rules prevent common pitfalls and maintain consistency across the codebase.

---

## Rule 1: Centralized API Client 🔌

### The Rule
**All backend API calls MUST go through the shared API client.**

### Location
- **Current:** `src/api/apiClient.js` (self-hosted HTTP client)
- **Future:** `src/api/apiClient.js` (Custom Axios client)

### What This Means

✅ **ALLOWED:**
```javascript
// Good: Use the shared client
import { apiClient } from '@/api/apiClient';

async function getSermons() {
  return await apiClient.get('/sermons');
}
```

❌ **NOT ALLOWED:**
```javascript
// Bad: Direct fetch() call
async function getSermons() {
  const res = await fetch('https://api.example.com/sermons');
  return res.json();
}

// Bad: Inline axios
async function getSermons() {
  const res = await axios.get('https://api.example.com/sermons');
  return res.data;
}
```

### Why This Rule Exists

1. **Authentication** - Client handles httpOnly cookies automatically
2. **Error Handling** - Centralized error handling, retry logic, timeouts
3. **Logging** - Single place to add request/response logging
4. **Testing** - Mock API client once, all calls mocked
5. **Refactoring** - Change API URL/auth method in one place

### Enforcement

- **Linting:** ESLint rule `no-restricted-imports` for fetch/axios in components
- **Code Review:** Reviewers must check for scattered API calls
- **CI:** Grep for `fetch(` and `axios.get|post|put|delete` in `src/` (excluding apiClient.js)

### Exceptions

- **None.** All API calls must use the centralized client.

---

## Rule 2: No Tokens in localStorage 🔐

### The Rule
**Authentication tokens MUST NEVER be stored in localStorage or sessionStorage.**

### What This Means

✅ **ALLOWED:**
```javascript
// Good: httpOnly cookies (set by server)
// Client-side code does NOT access the token

async function login(email, password) {
  await apiClient.post('/auth/login', { email, password });
  // Server sets httpOnly cookie, we never touch it
}
```

❌ **NOT ALLOWED:**
```javascript
// Bad: Token in localStorage
localStorage.setItem('auth_token', token);

// Bad: Token in sessionStorage
sessionStorage.setItem('jwt', token);

// Bad: Token in regular cookie (accessible to JS)
document.cookie = `token=${token}`;
```

### Why This Rule Exists

1. **XSS Protection** - localStorage is vulnerable to XSS attacks
2. **Best Practice** - httpOnly cookies cannot be read by JavaScript
3. **Security Standard** - OWASP recommends httpOnly cookies for auth

### Enforcement

- **Code Review:** Check for `localStorage.setItem` with token-like keys
- **CI:** Grep for `localStorage.setItem.*token|jwt|auth` in codebase
- **Security Scan:** Run OWASP ZAP or similar to detect localStorage usage

### Exceptions

- **Non-sensitive data** - OK to store user preferences, theme, language
- **Public data** - OK to cache non-sensitive API responses

### Migration Path

Auth uses JWT tokens stored in localStorage:
1. Remove `src/lib/app-params.js` (handles `access_token` query param)
2. Update `src/api/apiClient.js` to use `withCredentials: true`
3. Backend sets token as httpOnly cookie in login response

---

## Rule 3: Multi-Platform Compatibility 📱💻🌐

### The Rule
**All features MUST work on Web, Electron Desktop, and Android (Capacitor).**

### What This Means

When adding a feature:

- [ ] **Test on Web** - Verify in Chrome, Firefox, Safari
- [ ] **Test on Electron** - Build and run: `npm run electron:dev`
- [ ] **Test on Android** - Sync and run: `npm run cap:sync && npm run cap:open:android`

### Platform-Specific Considerations

#### Web (Browser)
- Service Workers for offline caching
- Local Storage for preferences
- Session Storage for temp data
- IndexedDB for large datasets

#### Electron (Desktop)
- `electron-store` for persistent config
- File system access for exports
- Native menus and dialogs
- Auto-update support

#### Android (Capacitor)
- WebView limitations (no Service Worker in some versions)
- Capacitor plugins for native features
- Different cookie behavior
- File access via Capacitor Filesystem API

### Code Patterns

✅ **ALLOWED:**
```javascript
// Good: Platform detection
const isElectron = typeof window !== 'undefined' && window.electron?.isElectron;
const isAndroid = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform();

if (isElectron) {
  // Use Electron-specific API
  await window.electron.saveFile(data);
} else if (isAndroid) {
  // Use Capacitor API
  await Filesystem.writeFile({ path: 'file.txt', data });
} else {
  // Use Web API
  const blob = new Blob([data]);
  const url = URL.createObjectURL(blob);
  // ...
}
```

❌ **NOT ALLOWED:**
```javascript
// Bad: Assumes browser-only
const file = new File([data], 'file.txt');
// Doesn't work in Electron or Android
```

### Enforcement

- **CI:** Run build for all platforms: `npm run build && npm run electron:build`
- **Manual Testing:** Test on actual devices before merging
- **Documentation:** Mark platform-specific features clearly

---

## Rule 4: CI Must Pass ✅

### The Rule
**All CI checks MUST pass before merging to `main`.**

### Required Checks

- [ ] **Linting** - `npm run lint` has no errors
- [ ] **Type Checking** - `npm run typecheck` has no errors (if TypeScript)
- [ ] **Build** - `npm run build` succeeds
- [ ] **Tests** - `npm test` passes (if tests exist)
- [ ] **Security Scan** - No high/critical vulnerabilities

### When CI Fails

1. **Fix the issue** - Don't bypass CI
2. **Don't merge** - Even if "it works on my machine"
3. **Don't disable checks** - Fix the root cause

### Enforcement

- **Branch Protection** - GitHub: Require status checks to pass
- **Code Review** - Reviewers must verify CI is green
- **Merge Blockers** - Cannot merge if CI is red

### Exceptions

- **None.** CI must always pass.

---

## Rule 5: Changes to Auth/API/Offline Require Extra Review 🔍

### The Rule
**Changes to authentication, API client, or offline caching require senior review.**

### Sensitive Areas

1. **Authentication** - `src/lib/AuthContext.jsx`, `src/api/apiClient.js`
2. **API Client** - `src/api/apiClient.js`
3. **Offline Caching** - `src/lib/offlineCache.js`, Service Worker (`public/service-worker.js`)

### Why This Rule Exists

- **Security** - Auth bugs can leak user data
- **Stability** - API client affects all features
- **Complexity** - Offline caching is error-prone

### Process

1. **Propose change** - Open PR with clear description
2. **Tag senior dev** - Request review from @lead-developer
3. **Security review** - Check for vulnerabilities
4. **Test thoroughly** - Manual + automated tests
5. **Monitor after merge** - Watch for errors in production

### Enforcement

- **CODEOWNERS** - `.github/CODEOWNERS` requires review for these files
- **Code Review** - Mandatory second reviewer
- **Security Scan** - Run SAST tools on PRs

---

## Rule 6: No Breaking Changes Without Migration Plan 🚨

### The Rule
**Breaking changes require a migration plan and version bump.**

### What is a Breaking Change?

- Removes or renames public API endpoints
- Changes database schema (requires migration)
- Removes or renames component props
- Changes config file format
- Removes features users depend on

### Process for Breaking Changes

1. **Document the break** - What will break and why?
2. **Provide migration path** - Clear steps for users/developers
3. **Deprecate first** - If possible, deprecate before removing
4. **Bump version** - Major version bump (1.x.x → 2.0.0)
5. **Announce** - In-app message, email, changelog

### Example Migration Plan

```markdown
## Architecture: Self-Hosted API

### What breaks?
- All API calls go through the self-hosted Express backend
- Electron first-run wizard expects `appId` field

### Migration path
1. Import: `import { api } from '@/api/apiClient'`
2. API calls: `api.auth.me()`, `api.entities.Sermon.create(data)`, etc.
3. Remove `appId` field from Electron first-run wizard
4. Update config to use new API URL

### Timeline
- Completed: Self-hosted Express + Prisma backend
- Completed: JWT authentication replacing external auth
- Week 3: Migrate all code to new client
- Completed: All external SDK dependencies removed
```

### Enforcement

- **Semantic Versioning** - Follow semver strictly
- **Changelog** - Document all breaking changes
- **Code Review** - Flag breaking changes in PR

---

## Rule 7: Document Complex Logic 📝

### The Rule
**Complex algorithms, business logic, and workarounds MUST be documented.**

### What Needs Comments?

✅ **REQUIRED:**
```javascript
// Good: Complex algorithm explained
function calculateSermonScore(sermon) {
  // Score algorithm:
  // 1. Base score: 100 points
  // 2. Add 10 points per scripture reference
  // 3. Add 5 points per 100 words
  // 4. Multiply by engagement factor (likes + shares)
  // 5. Cap at 1000 points
  
  let score = 100;
  score += sermon.scriptureReferences.length * 10;
  score += Math.floor(sermon.wordCount / 100) * 5;
  score *= (sermon.likes + sermon.shares);
  return Math.min(score, 1000);
}
```

❌ **NOT NEEDED:**
```javascript
// Bad: Obvious code doesn't need comments
function getSermonTitle(sermon) {
  // Return the sermon title
  return sermon.title;
}
```

### Why This Rule Exists

- **Maintainability** - Future devs understand intent
- **Debugging** - Easier to find bugs when logic is clear
- **Onboarding** - New team members ramp up faster

### What to Document

- Algorithm explanations
- Business logic rationale
- Workarounds for browser bugs
- Performance optimizations
- Security considerations
- TODO items with context

### Enforcement

- **Code Review** - Reviewers request comments for complex code
- **No Enforcement** - Judgment call by developer

---

## Rule 8: Test Before Merge 🧪

### The Rule
**All changes must be manually tested before merging.**

### Minimum Testing

- [ ] **Local build** - `npm run build` succeeds
- [ ] **Feature works** - Test the specific feature changed
- [ ] **No regressions** - Test related features still work
- [ ] **No console errors** - Open DevTools, check console
- [ ] **Mobile responsive** - Resize to mobile width (if UI change)

### When to Write Automated Tests

- **Critical features** - Auth, payment, data loss scenarios
- **Bug fixes** - Write test that reproduces bug, then fix
- **Reusable components** - Test component in isolation
- **APIs** - Integration tests for endpoints

### Enforcement

- **PR Template** - Checkbox: "I have tested this change"
- **Code Review** - Reviewers ask "Did you test this?"
- **CI** - Automated tests run on every PR (if tests exist)

---

## Rule 9: Keep Dependencies Updated (Security) 🔒

### The Rule
**Security vulnerabilities in dependencies MUST be fixed within 7 days.**

### Process

1. **Weekly audit** - Run `npm audit` every week
2. **Fix high/critical** - Update vulnerable packages immediately
3. **Test after update** - Ensure no breaking changes
4. **Document changes** - Note in changelog

### Commands

```bash
# Check for vulnerabilities
npm audit

# Fix automatically (may break things)
npm audit fix

# Fix only production dependencies
npm audit fix --only=prod

# Update specific package
npm update <package-name>
```

### Enforcement

- **Dependabot** - Auto-create PRs for security updates
- **CI** - Fail build if high/critical vulnerabilities found
- **Weekly Review** - Team reviews `npm audit` output

---

## Rule 10: No Commented-Out Code 🗑️

### The Rule
**Commented-out code should not be committed (except rare exceptions).**

### Why

- Git history preserves old code
- Commented code clutters files
- Confuses future developers ("Should I uncomment this?")

### What to Do Instead

❌ **NOT ALLOWED:**
```javascript
function saveSermon(sermon) {
  // Old implementation:
  // await api.entities.Sermon.create(sermon);
  
  // New implementation:
  await apiClient.post('/sermons', sermon);
}
```

✅ **ALLOWED:**
```javascript
function saveSermon(sermon) {
  // Self-hosted API client (Express + Prisma backend)
  await apiClient.post('/sermons', sermon);
}
```

### Exceptions

- **Debugging** - Temporarily commented for local testing (don't commit)
- **TODO placeholders** - With clear TODO comment explaining why

### Enforcement

- **Code Review** - Reviewers flag commented code
- **Linting** - ESLint rule `no-commented-code` (if available)

---

## Summary Checklist

Before submitting a PR, verify:

- [ ] ✅ All API calls use centralized client (`src/api/apiClient.js`)
- [ ] 🔐 No tokens in localStorage (httpOnly cookies only)
- [ ] 📱 Tested on Web, Electron, Android (if applicable)
- [ ] ✅ CI passes (lint, typecheck, build, tests)
- [ ] 🔍 Sensitive areas (auth/API/offline) have senior review
- [ ] 🚨 Breaking changes have migration plan
- [ ] 📝 Complex logic is documented
- [ ] 🧪 Changes are manually tested
- [ ] 🔒 No new security vulnerabilities
- [ ] 🗑️ No commented-out code

---

## For AI Agents

If you are an AI agent working on this repository:

1. **Read this file first** - Before making any changes
2. **Follow all rules** - These are non-negotiable
3. **Ask if uncertain** - Request clarification from humans
4. **Explain your changes** - Clear commit messages and PR descriptions
5. **Test thoroughly** - Don't assume changes work without testing

### Common AI Agent Mistakes to Avoid

❌ **Don't:**
- Scatter fetch() calls throughout components
- Store tokens in localStorage ("just to test")
- Skip testing on Electron/Android ("web works so it's fine")
- Merge with failing CI ("it's just a linting error")
- Remove commented code without checking if it's needed

✅ **Do:**
- Use the centralized API client for all backend calls
- Implement httpOnly cookie auth properly
- Test on all three platforms (Web, Electron, Android)
- Fix CI failures before requesting review
- Ask about commented code before removing

---

## Updating These Rules

These rules are **living guidelines** and can be updated as the project evolves.

### Process to Update Rules

1. **Propose change** - Open GitHub issue explaining why
2. **Team discussion** - Get feedback from team members
3. **Consensus** - Majority agreement required
4. **Update document** - Create PR with changes
5. **Announce** - Notify team of rule changes

### Rule Change History

| Date | Rule | Change | Reason |
|------|------|--------|--------|
| 2026-01-28 | All | Initial version | Self-hosted architecture (Vercel + Railway) |

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-28  
**Review Frequency:** Quarterly  
**Owner:** Lead Developer

---

## Enforcement Matrix

| Rule | Automated Check | Manual Review | Severity |
|------|-----------------|---------------|----------|
| Centralized API | CI grep | Code review | HIGH |
| No localStorage tokens | CI grep | Code review | CRITICAL |
| Multi-platform | CI build | Manual test | HIGH |
| CI must pass | GitHub branch protection | - | HIGH |
| Auth/API review | CODEOWNERS | Senior dev review | CRITICAL |
| No breaking changes | Semantic version check | Code review | MEDIUM |
| Document complex | - | Code review | LOW |
| Test before merge | - | PR template checkbox | MEDIUM |
| Security updates | Dependabot + CI | Weekly audit | HIGH |
| No commented code | - | Code review | LOW |

**Severity Levels:**
- **CRITICAL** - Security/data loss risk, zero tolerance
- **HIGH** - Major bugs/regressions, must fix before merge
- **MEDIUM** - Important quality issue, should fix before merge
- **LOW** - Best practice, fix if time permits
