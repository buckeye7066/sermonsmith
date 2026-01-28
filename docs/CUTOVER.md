# Cutover Checklist: Base44 → Vercel/Railway

This is an **executable checklist** for the day-of-cutover from Base44 to self-hosted architecture.

---

## Pre-Cutover Checklist (1 Week Before)

### Infrastructure Setup
- [ ] **Railway project created and configured**
  - [ ] Postgres addon provisioned
  - [ ] Environment variables set (JWT_SECRET, CORS_ORIGIN, etc.)
  - [ ] API code deployed and running
  - [ ] Health check endpoint responding: `curl https://api.sermonsmith.axiombiolabs.org/api/health`

- [ ] **Vercel project created and configured**
  - [ ] GitHub repo connected
  - [ ] Environment variables set (VITE_API_URL)
  - [ ] Web app deployed to production
  - [ ] Preview URL tested: `https://sermonsmith-git-main-[user].vercel.app`

- [ ] **DNS records prepared (not yet active)**
  - [ ] CNAME for `sermonsmith.axiombiolabs.org` → Vercel (recorded but not set)
  - [ ] CNAME for `api.sermonsmith.axiombiolabs.org` → Railway (recorded but not set)
  - [ ] TTL values noted (for propagation time estimation)

### Data Migration
- [ ] **Base44 data exported**
  - [ ] Users table → `backup/users.json` (with password hashes if accessible)
  - [ ] Sermons table → `backup/sermons.json`
  - [ ] Bible cache → `backup/bible_cache.json` (if applicable)
  - [ ] Attachments/files → `backup/attachments/` (if applicable)
  - [ ] Verify file sizes match expectations
  - [ ] Store backups in 2 locations (local + cloud)

- [ ] **Import scripts tested on staging**
  - [ ] Staging database created: `sermonsmith_staging`
  - [ ] Import script executed: `node scripts/import-from-base44.js --env=staging`
  - [ ] Row counts verified: `SELECT COUNT(*) FROM users;` matches export
  - [ ] Sample queries work: `SELECT * FROM sermons WHERE user_id = 1;`
  - [ ] No foreign key violations
  - [ ] No data corruption

- [ ] **Production database ready**
  - [ ] Migrations applied: `railway run npx prisma migrate deploy`
  - [ ] Schema matches code: `railway run npx prisma migrate status`
  - [ ] Connection pooling configured (max connections: 20)
  - [ ] Backup scheduled (Railway auto-backup enabled)

### Code Preparation
- [ ] **Frontend code updated**
  - [ ] Base44 SDK removed: `npm uninstall @base44/sdk @base44/vite-plugin`
  - [ ] New API client implemented: `src/api/apiClient.js` with Axios + credentials
  - [ ] All `base44.` calls replaced with `apiClient.` calls
  - [ ] AuthContext updated for cookie-based auth
  - [ ] app-params.js removed (no longer needed)
  - [ ] runtimeConfig.js updated for new API URL
  - [ ] vite.config.js cleaned up (Base44 plugin removed)

- [ ] **Electron app updated**
  - [ ] First-run wizard updated (removed appId field)
  - [ ] Default backend URL set to Railway API
  - [ ] Builds tested: `npm run electron:build`
  - [ ] Installers tested on Windows, macOS, Linux
  - [ ] First-run flow tested with production API

- [ ] **Android app updated**
  - [ ] Capacitor config updated with new API URL
  - [ ] APK built and signed: `./gradlew assembleRelease`
  - [ ] APK tested on physical device
  - [ ] Auth flow tested (cookies work in WebView)

### Testing
- [ ] **All Release Gates passed**
  - [ ] Auth Gate: 7/7 criteria ✅
  - [ ] Offline Gate: 6/6 criteria ✅
  - [ ] Packaging Gate: 8/8 criteria ✅
  - [ ] API Gate: 8/8 criteria ✅
  - [ ] Regression Gate: 11/11 criteria ✅
  - [ ] **Total: 40/40** (see `docs/RELEASE_GATES.md`)

- [ ] **Smoke tests completed**
  - [ ] Web: Login, create sermon, view Bible, logout
  - [ ] Electron: First-run, login, create sermon, offline mode
  - [ ] Android: Install, login, create sermon, offline mode

- [ ] **Performance baseline established**
  - [ ] API response times logged (median, p95, p99)
  - [ ] Web app load times logged (First Contentful Paint, Time to Interactive)
  - [ ] Database query times logged (slow queries identified)

### Communication
- [ ] **Team notified of cutover window**
  - [ ] Date: `[YYYY-MM-DD]`
  - [ ] Time: `[HH:MM - HH:MM UTC]`
  - [ ] Expected duration: 2-4 hours
  - [ ] Backup plan: Rollback if issues within first hour

- [ ] **Users notified (if public-facing)**
  - [ ] In-app banner: "Scheduled maintenance on [DATE] from [TIME] to [TIME]"
  - [ ] Email notification sent to active users
  - [ ] Social media post (if applicable)

- [ ] **Support team briefed**
  - [ ] Common issues documented
  - [ ] Escalation path defined
  - [ ] On-call engineer designated

### Rollback Preparation
- [ ] **Base44 subscription still active**
  - [ ] Verify account not canceled
  - [ ] Test login to Base44 backend
  - [ ] Confirm data still accessible

- [ ] **Git tag for rollback created**
  - [ ] Tag: `pre-migration-base44`
  - [ ] Command: `git tag -a pre-migration-base44 -m "Last commit before Base44 migration"`
  - [ ] Pushed to GitHub: `git push origin pre-migration-base44`

- [ ] **Rollback procedure documented**
  - [ ] See "Rollback Plan" section below
  - [ ] Team members trained on rollback steps
  - [ ] Decision criteria clear (when to rollback)

---

## Cutover Day Checklist

### T-Minus 30 Minutes (Final Prep)

- [ ] **All team members online**
  - [ ] Lead Developer
  - [ ] DevOps Engineer
  - [ ] QA Lead
  - [ ] On-call Support

- [ ] **Create cutover log file**
  ```bash
  echo "Cutover started at $(date -u)" > cutover-log.txt
  ```

- [ ] **Verify all systems green**
  - [ ] Railway API: `curl https://api.sermonsmith.axiombiolabs.org/api/health`
  - [ ] Vercel web: `curl https://sermonsmith-git-main-[user].vercel.app`
  - [ ] Database: `railway run psql -c "SELECT 1;"`

- [ ] **Take final backups**
  - [ ] Base44 data export (if not done): `curl https://base44-backend/export > backup/final-export.json`
  - [ ] Railway database snapshot: Railway dashboard → Postgres → Backups → Create snapshot

### T-Minus 15 Minutes (Freeze)

- [ ] **Enable maintenance mode** (if applicable)
  - [ ] In-app banner: "System maintenance in progress. Read-only mode."
  - [ ] Disable write operations in Base44 (if possible)

- [ ] **Verify no active deployments**
  - [ ] Vercel: No pending deployments
  - [ ] Railway: No pending deployments
  - [ ] GitHub: No open PRs targeting main

### T-Zero (GO TIME)

#### Step 1: Data Import (15 minutes)

- [ ] **Import users to Railway Postgres**
  ```bash
  railway run node scripts/import-users.js --input=backup/users.json
  # Expected output: "Imported 1,234 users successfully"
  ```
  - [ ] Log output: `railway run node scripts/import-users.js ... >> cutover-log.txt 2>&1`
  - [ ] Verify count: `railway run psql -c "SELECT COUNT(*) FROM users;"`
  - [ ] Expected: Matches Base44 user count

- [ ] **Import sermons to Railway Postgres**
  ```bash
  railway run node scripts/import-sermons.js --input=backup/sermons.json
  # Expected output: "Imported 5,678 sermons successfully"
  ```
  - [ ] Log output: `railway run node scripts/import-sermons.js ... >> cutover-log.txt 2>&1`
  - [ ] Verify count: `railway run psql -c "SELECT COUNT(*) FROM sermons;"`
  - [ ] Expected: Matches Base44 sermon count

- [ ] **Import Bible cache (if applicable)**
  ```bash
  railway run node scripts/import-bible-cache.js --input=backup/bible_cache.json
  # Expected output: "Imported 890 cached passages successfully"
  ```
  - [ ] Log output: `railway run node scripts/import-bible-cache.js ... >> cutover-log.txt 2>&1`

- [ ] **Verify data integrity**
  ```bash
  railway run psql -c "SELECT u.id, COUNT(s.id) FROM users u LEFT JOIN sermons s ON u.id = s.user_id GROUP BY u.id LIMIT 10;"
  # Should show user IDs with sermon counts
  ```
  - [ ] No NULL foreign keys
  - [ ] Sample user has correct sermons
  - [ ] Timestamps preserved

#### Step 2: DNS Cutover (10 minutes)

- [ ] **Update DNS records in GoDaddy**
  - [ ] Login to GoDaddy DNS management
  - [ ] Update `sermonsmith.axiombiolabs.org`:
    - Type: CNAME
    - Name: `sermonsmith`
    - Value: `cname.vercel-dns.com`
    - TTL: 1 Hour
  - [ ] Update `api.sermonsmith.axiombiolabs.org`:
    - Type: CNAME
    - Name: `api.sermonsmith`
    - Value: `[railway-provided-dns]`
    - TTL: 1 Hour
  - [ ] Click "Save Changes"
  - [ ] Log time: `echo "DNS updated at $(date -u)" >> cutover-log.txt`

- [ ] **Verify DNS propagation** (wait 5-15 minutes)
  ```bash
  # Check from multiple locations
  dig sermonsmith.axiombiolabs.org
  dig api.sermonsmith.axiombiolabs.org
  
  # Expected: CNAME points to Vercel/Railway
  # May take 5-15 minutes to propagate
  ```
  - [ ] Check from [dnschecker.org](https://dnschecker.org)
  - [ ] Verify at least 3 locations show new DNS

#### Step 3: Smoke Tests (10 minutes)

- [ ] **Test Web App**
  - [ ] Load `https://sermonsmith.axiombiolabs.org`
  - [ ] Verify: Page loads (no errors)
  - [ ] Login with test account: `test@example.com`
  - [ ] Verify: Cookie set in DevTools
  - [ ] Navigate to "My Sermons"
  - [ ] Verify: Sermons list appears
  - [ ] Create new sermon
  - [ ] Verify: Sermon saved and appears in list
  - [ ] Logout
  - [ ] Verify: Cookie cleared

- [ ] **Test API Directly**
  ```bash
  # Login
  curl -X POST https://api.sermonsmith.axiombiolabs.org/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"test123"}' \
    -c cookies.txt
  
  # Get user
  curl https://api.sermonsmith.axiombiolabs.org/api/auth/me -b cookies.txt
  
  # Expected: Returns user object
  ```

- [ ] **Test Electron App** (quick check)
  - [ ] Launch installed Electron app
  - [ ] If first-run: Enter `https://api.sermonsmith.axiombiolabs.org`
  - [ ] Login
  - [ ] Verify: Main page loads
  - [ ] (Full testing done in pre-cutover)

- [ ] **Test Android App** (quick check)
  - [ ] Launch Android app on device
  - [ ] Login
  - [ ] Verify: Main page loads
  - [ ] (Full testing done in pre-cutover)

#### Step 4: Monitor & Verify (15 minutes)

- [ ] **Check Railway API logs**
  ```bash
  railway logs --tail 50
  ```
  - [ ] Verify: Incoming requests from Vercel web app
  - [ ] Verify: No 5xx errors
  - [ ] Verify: Response times < 200ms

- [ ] **Check Vercel deployment status**
  - [ ] Vercel dashboard → Deployments
  - [ ] Verify: Latest deployment is "Ready"
  - [ ] Verify: No failed deployments

- [ ] **Check error rates**
  - [ ] Railway metrics: Error rate < 1%
  - [ ] Vercel Analytics: Error rate < 1%
  - [ ] No alerts triggered

- [ ] **Test from multiple browsers**
  - [ ] Chrome: Login successful
  - [ ] Firefox: Login successful
  - [ ] Safari: Login successful
  - [ ] Edge: Login successful

- [ ] **Test from mobile devices**
  - [ ] iPhone Safari: Login successful
  - [ ] Android Chrome: Login successful

#### Step 5: Disable Maintenance Mode

- [ ] **Remove maintenance banner**
  - [ ] Remove in-app banner (if shown)
  - [ ] Post "System back online" message (if applicable)

- [ ] **Announce completion**
  - [ ] Team Slack/Discord: "Cutover complete, all systems green"
  - [ ] Users (if applicable): "Maintenance complete, thank you for your patience"

### T-Plus 1 Hour (Monitoring)

- [ ] **Check key metrics**
  - [ ] Login success rate: ___% (target: ≥95%)
  - [ ] API error rate: ___% (target: <1%)
  - [ ] Web app uptime: ___% (target: >99%)
  - [ ] Support tickets: ___ (target: <5)

- [ ] **Review logs for anomalies**
  - [ ] Railway logs: Any unexpected errors?
  - [ ] Vercel logs: Any 5xx responses?
  - [ ] Database logs: Any slow queries?

- [ ] **User feedback**
  - [ ] Support channel: Any complaints?
  - [ ] GitHub issues: New issues opened?
  - [ ] Social media: Negative comments?

- [ ] **Decision checkpoint**
  - [ ] ✅ **GREEN:** All metrics good → Continue monitoring
  - [ ] ⚠️ **YELLOW:** Some minor issues → Fix forward, continue monitoring
  - [ ] ❌ **RED:** Critical issues → **INITIATE ROLLBACK** (see below)

### T-Plus 4 Hours (Stabilization)

- [ ] **Extended monitoring**
  - [ ] Login success rate still ≥95%
  - [ ] API error rate still <1%
  - [ ] No data loss reports
  - [ ] Support tickets stable

- [ ] **Performance check**
  - [ ] API response times: Median ___ ms (target: <200ms)
  - [ ] Web load times: Median ___ s (target: <3s)
  - [ ] Database CPU: ___% (target: <80%)
  - [ ] Database memory: ___% (target: <80%)

- [ ] **Final smoke tests**
  - [ ] Create 5 test sermons
  - [ ] Search Bible passages
  - [ ] Test offline mode (disconnect → reload)
  - [ ] Test edit sermon
  - [ ] Test delete sermon

### T-Plus 24 Hours (Success Criteria)

- [ ] **24-hour metrics review**
  - [ ] Total logins: ___
  - [ ] Failed logins: ___
  - [ ] Login success rate: ___% (target: ≥90%)
  - [ ] API calls: ___
  - [ ] API errors: ___
  - [ ] API error rate: ___% (target: <5%)
  - [ ] Support tickets: ___ (target: <10)
  - [ ] Critical bugs: ___ (target: 0)

- [ ] **Decision: Declare success or rollback**
  - [ ] ✅ **SUCCESS:** Metrics meet targets → Declare migration complete
  - [ ] ❌ **FAILURE:** Metrics below targets → **INITIATE ROLLBACK**

---

## Rollback Plan

### When to Rollback

**Immediate Rollback Triggers** (within 1 hour of cutover):
- Login success rate drops below 80%
- API error rate exceeds 10%
- Database connection failures
- Data loss confirmed
- Security vulnerability discovered

**Extended Rollback Triggers** (1-24 hours after cutover):
- Login success rate persistently below 90%
- API error rate persistently above 5%
- Multiple critical bugs reported
- User complaints exceed 10/day

### Rollback Procedure

#### Option 1: DNS Rollback (Fastest, < 15 minutes)

If Base44 backend still active and has recent data:

1. **Revert DNS in GoDaddy**
   - [ ] Login to GoDaddy DNS
   - [ ] Update `sermonsmith.axiombiolabs.org`:
     - Change CNAME back to Base44 URL (or delete CNAME)
   - [ ] Update `api.sermonsmith.axiombiolabs.org`:
     - Change CNAME back to Base44 API URL (or delete CNAME)
   - [ ] Save changes
   - [ ] Wait 5-15 minutes for propagation

2. **Verify rollback**
   - [ ] `dig sermonsmith.axiombiolabs.org` → Points to Base44
   - [ ] Load web app → Shows Base44 version
   - [ ] Test login → Works with Base44

3. **Notify team**
   - [ ] "Rollback complete, back on Base44"

#### Option 2: Code Rollback (Medium, < 1 hour)

If DNS cannot be reverted, rollback frontend code:

1. **Revert Vercel to previous deployment**
   - [ ] Vercel dashboard → Deployments
   - [ ] Find deployment tagged `pre-migration-base44`
   - [ ] Click "..." → "Promote to Production"
   - [ ] Confirm promotion

2. **Revert Railway API** (if needed)
   - [ ] Railway dashboard → Deployments
   - [ ] Find previous deployment
   - [ ] Click "Redeploy"

3. **Reinstall Base44 dependencies**
   ```bash
   git checkout pre-migration-base44
   npm install  # Restores @base44/sdk
   npm run build
   ```
   - [ ] Commit: `git commit -m "Rollback: Restore Base44 SDK"`
   - [ ] Push: `git push origin main`
   - [ ] Vercel auto-deploys reverted code

4. **Verify rollback**
   - [ ] Load web app → Uses Base44 client
   - [ ] Test login → Works
   - [ ] Check console → No errors

#### Option 3: Full Rollback with Data Sync (Slow, 2-4 hours)

If new data created on Railway after cutover:

1. **Export data from Railway**
   ```bash
   railway run node scripts/export-to-json.js --output=rollback-export.json
   ```

2. **Import data to Base44** (if API available)
   ```bash
   node scripts/import-to-base44.js --input=rollback-export.json
   ```
   - [ ] Verify: New sermons appear in Base44
   - [ ] Verify: No duplicates

3. **Perform DNS or code rollback** (see above)

4. **Verify data integrity**
   - [ ] Check latest sermon created during cutover
   - [ ] Verify it exists in Base44
   - [ ] Test editing and saving

### Post-Rollback Actions

- [ ] **Announce rollback to users**
  - [ ] In-app message: "We've reverted to previous system due to technical issues"
  - [ ] Email: "We apologize for the inconvenience"

- [ ] **Conduct post-mortem**
  - [ ] What went wrong?
  - [ ] Why did it go wrong?
  - [ ] How to prevent next time?

- [ ] **Plan remediation**
  - [ ] Fix identified issues
  - [ ] Re-test thoroughly
  - [ ] Schedule new cutover date

---

## Success Criteria

✅ **Cutover is successful if:**
- Login success rate ≥ 90% (24 hours)
- API error rate < 5% (24 hours)
- Zero data loss incidents
- Zero security vulnerabilities
- Support tickets < 10 (24 hours)
- Electron + Android apps functional
- Team agrees system is stable

📊 **Metrics Dashboard** (create after cutover):
- Login success rate (real-time)
- API error rate (real-time)
- Response times (p50, p95, p99)
- Active users (real-time)
- Support ticket count

---

## Post-Cutover Cleanup (Week After)

- [ ] **Cancel Base44 subscription** (if satisfied)
  - [ ] Verify no more usage for 7 days
  - [ ] Export final backup from Base44
  - [ ] Store backup securely (cloud + local)
  - [ ] Cancel subscription
  - [ ] Confirm cancellation

- [ ] **Remove legacy code**
  - [ ] Delete `src/lib/app-params.js` (if not already removed)
  - [ ] Remove Base44 environment variables from Vercel/Railway
  - [ ] Remove unused Electron first-run wizard code for appId

- [ ] **Update documentation**
  - [ ] Update README.md (remove Base44 references)
  - [ ] Update docs/BUILD.md (new build instructions)
  - [ ] Create docs/ARCHITECTURE.md (new architecture diagram)

- [ ] **Conduct retrospective**
  - [ ] What went well?
  - [ ] What could be improved?
  - [ ] Document lessons learned
  - [ ] Update this checklist for future use

- [ ] **Celebrate! 🎉**
  - [ ] Team celebration
  - [ ] Thank everyone involved
  - [ ] Share success metrics

---

## Emergency Contacts

| Role | Name | Contact |
|------|------|---------|
| Lead Developer | [Name] | [Email/Phone] |
| DevOps Engineer | [Name] | [Email/Phone] |
| QA Lead | [Name] | [Email/Phone] |
| Product Owner | [Name] | [Email/Phone] |
| On-Call Support | [Name] | [Email/Phone] |

## Key URLs

| Resource | URL |
|----------|-----|
| Railway Dashboard | https://railway.app/project/[project-id] |
| Vercel Dashboard | https://vercel.com/[user]/sermonsmith |
| GoDaddy DNS | https://dcc.godaddy.com/manage/[domain]/dns |
| GitHub Repo | https://github.com/buckeye7066/sermonsmith |
| Production Web | https://sermonsmith.axiombiolabs.org |
| Production API | https://api.sermonsmith.axiombiolabs.org |

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-28  
**Next Review:** Before cutover day  
**Owner:** DevOps Team

---

## Appendix: Command Reference

### Railway Commands
```bash
# Login
railway login

# Link to project
railway link

# Run command in Railway environment
railway run [command]

# View logs
railway logs --tail 100

# Create database backup
railway run pg_dump > backup.sql

# Database shell
railway run psql
```

### Vercel Commands
```bash
# Login
vercel login

# Deploy
vercel --prod

# View logs
vercel logs [deployment-url]

# List deployments
vercel ls

# Promote deployment
vercel promote [deployment-url]
```

### DNS Testing Commands
```bash
# Check DNS
dig sermonsmith.axiombiolabs.org

# Check from specific server
dig @8.8.8.8 sermonsmith.axiombiolabs.org

# Check SSL
openssl s_client -connect sermonsmith.axiombiolabs.org:443 -servername sermonsmith.axiombiolabs.org

# Check HTTPS
curl -I https://sermonsmith.axiombiolabs.org
```

### Database Commands
```bash
# Count users
railway run psql -c "SELECT COUNT(*) FROM users;"

# List recent sermons
railway run psql -c "SELECT id, title, created_at FROM sermons ORDER BY created_at DESC LIMIT 10;"

# Check database size
railway run psql -c "SELECT pg_size_pretty(pg_database_size('railway'));"

# Vacuum database
railway run psql -c "VACUUM ANALYZE;"
```
