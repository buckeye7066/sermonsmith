# Pull Request

## Description
<!-- Provide a clear and concise description of what this PR does -->

## Type of Change
<!-- Mark the relevant option with an [x] -->
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that causes existing functionality to change)
- [ ] Documentation update
- [ ] Refactoring (no functional changes)
- [ ] Performance improvement
- [ ] Dependency update

## Related Issue
<!-- Link to related issue(s) if applicable -->
Fixes #<!-- issue number -->

---

## API & Authentication Checklist

### API Client Usage
- [ ] **No scattered fetch() calls** - All API calls go through shared `src/api/apiClient.js`
- [ ] **No inline fetch/axios** - Use centralized API client with proper error handling
- [ ] **Proper error boundaries** - API errors are caught and displayed to users

### Authentication
- [ ] **httpOnly cookies used** - No JWT tokens in localStorage
- [ ] **No token in localStorage** - Auth state managed by httpOnly cookies only
- [ ] **CORS credentials enabled** - API calls include `withCredentials: true` if needed
- [ ] **SameSite attribute correct** - Cookies set with proper SameSite policy

### Security
- [ ] **No hardcoded secrets** - Environment variables used for sensitive data
- [ ] **No console.log with sensitive data** - No logging of tokens, passwords, or PII
- [ ] **Input validation** - User inputs are validated before API calls

---

## Multi-Target Build Checklist

If this PR affects the build process or platform-specific code:

- [ ] **Web build tested** - `npm run build` succeeds
- [ ] **Electron build tested** - `npm run electron:build` succeeds
- [ ] **Android build tested** - `npm run cap:sync` works, APK builds (if applicable)
- [ ] **Cross-platform compatibility** - Code works on web, desktop, and mobile
- [ ] **Offline mode not broken** - Offline caching still works (if applicable)

---

## Code Quality Checklist

- [ ] **Linting passes** - `npm run lint` has no errors
- [ ] **Type checking passes** - `npm run typecheck` has no errors (if TypeScript)
- [ ] **No console errors** - Tested in browser console, no errors logged
- [ ] **Mobile responsive** - Tested at mobile viewport sizes (< 768px)
- [ ] **Accessibility** - Interactive elements have proper labels/ARIA attributes

---

## Testing Checklist

- [ ] **Manual testing completed** - I have tested this change locally
- [ ] **Regression testing** - Existing features still work as expected
- [ ] **Edge cases considered** - Handled error states, empty states, loading states
- [ ] **Browser testing** - Tested in Chrome/Firefox/Safari (if UI change)
- [ ] **Offline testing** - Tested offline behavior (if applicable)

---

## CI/CD Checklist

- [ ] **CI must pass** - All CI checks must be green before merge
- [ ] **No build artifacts committed** - `dist/`, `node_modules/`, `.env` not in PR
- [ ] **Branch up to date** - Branch is up to date with `main`
- [ ] **Deployment tested** - Verified in preview deployment (Vercel) if available

---

## Documentation

- [ ] **Code comments added** - Complex logic is documented
- [ ] **README updated** - If this changes user-facing behavior or setup
- [ ] **API docs updated** - If this changes API endpoints or contracts
- [ ] **Migration guide** - If this requires manual migration steps

---

## Breaking Changes

<!-- If this is a breaking change, describe the impact and migration path -->

### What breaks?
<!-- Describe what existing functionality will break -->

### Migration path
<!-- Provide clear steps for users to migrate -->

---

## Screenshots / Videos

<!-- If this is a UI change, add screenshots or videos -->

### Before
<!-- Screenshot of old behavior -->

### After
<!-- Screenshot of new behavior -->

---

## Additional Notes

<!-- Any additional context, concerns, or discussion points -->

---

## Review Checklist (for Reviewers)

Reviewers, please verify:

- [ ] **Architecture patterns followed** - Adheres to repo conventions
- [ ] **No scattered API calls** - Centralized API client used
- [ ] **No localStorage tokens** - Auth uses httpOnly cookies
- [ ] **Multi-target builds work** - Web, Electron, Android still functional
- [ ] **No security vulnerabilities** - Code review for security issues
- [ ] **Code quality acceptable** - Readable, maintainable, follows style guide
- [ ] **Tests are sufficient** - Adequate testing for changes made
- [ ] **Documentation complete** - Changes are properly documented

---

## Post-Merge Tasks

<!-- List any tasks that need to be done after merging -->

- [ ] Deploy to staging
- [ ] Smoke test in staging
- [ ] Update related issues
- [ ] Notify stakeholders

---

**By submitting this PR, I confirm:**
- I have read and followed the contribution guidelines
- My code follows the project's style and conventions
- I have tested my changes thoroughly
- I have not introduced security vulnerabilities
- I have updated documentation where necessary
