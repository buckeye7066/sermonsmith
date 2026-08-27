# FlexFactor audit — sermonsmith-monorepo

- **Project:** `C:\Users\firer\sermonsmith`
- **Branch:** `main`
- **Toolchains:** java, node
- **Files reviewed:** 0 of 318 candidate(s)
- **FILE ACCOUNTING: 318 candidate(s) = 0 reviewed + 294 never_attempted + 24 review_incomplete**
- **ZERO WORK: not one of 318 candidate file(s) was reviewed. This run did nothing; treat it as a FAILURE, not a clean repo.**
- **Defects found:** 3
- **Files fixed:** 0
- **Errors recorded:** 10 (see the Errors section below; ledger at `C:\Users\firer\.flexfactor\runs\sermonsmith-monorepo-20260826-215927-039852-2424\errors.md`)
- **Baseline build:** FAILED
- **Unit tests added:** 0 (suite not run)
- **Button/UI (Playwright):** skipped
- **Cycles run:** 1
- **Providers:** rotation:dots-studio/dots-3-note-preview:free
- **Git:** PROVIDER-OUTAGE ABORT on main: checkpoint preserved; no unverified commit created

## System inventory

**969 entries accounted for.**

| Category | Count |
|---|---:|
| artifact-subtree | 9 |
| binary-asset | 69 |
| configuration-documentation-or-data | 349 |
| first-party-source | 542 |

The immutable run manifest contains the complete path-level inventory. Artifact, binary, and reparse entries are named and classified; they are not represented as line-reviewed source.

## Executable evidence

- **Evidence run:** `sermonsmith-monorepo-20260826-215927-039852-2424`
- **Exact final commit:** `af695c494d251701c1da980e14e762637f829617`
- **Code map:** 581 file(s), 2978 function(s), 112 route(s), 1206 material control(s)
- **Function execution:** 0/2785 with invocation evidence
- **Route execution:** 0/112
- **Control execution:** 0/1206
- **Changed-file rescan:** 1/1 (complete)
- **Blast radius:** 1 affected file(s); analysis ran
- **Normalized gates:** 4 pass, 3 fail, 2 blocked

- **Blast Radius:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-monorepo-20260826-215927-039852-2424\blast-radius.json`
- **Changed File Rescan:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-monorepo-20260826-215927-039852-2424\changed-file-rescan.json`
- **Code Index:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-monorepo-20260826-215927-039852-2424\code-index.json`
- **Coverage Ledger:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-monorepo-20260826-215927-039852-2424\coverage-ledger.json`
- **Manifest:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-monorepo-20260826-215927-039852-2424\manifest.json`
- **Purpose Graph:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-monorepo-20260826-215927-039852-2424\purpose-graph.json`
- **Quality Gates:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-monorepo-20260826-215927-039852-2424\quality-gates.json`
- **Sarif:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-monorepo-20260826-215927-039852-2424\results.sarif`

## Production readiness

**NOT PRODUCTION READY** — 13/15 evaluated gates passed, 2 blocker(s).

Full scorecard: `C:\Users\firer\sermonsmith\sermonsmith-monorepo_readiness.md`

- **Test suite passes** [high] — tests were not run
  - Fix: Run the suite and fix failures.
- **Dependencies are lock-pinned** [high] — no lockfile: java:apps/mobile/android
  - Fix: Commit the lockfile so builds are reproducible.

## Competitor research

**Coverage:** 5 competitor(s) covered with corroborating sources (target 5).

- **Sources used:** web:duckduckgo, github, repo-rewards
- **Repo Rewards endpoint:** `https://web-production-d7db7.up.railway.app`
- **Sources SKIPPED (named, not silent):**
  - `idea:FaithLife-Community/OuDedetai` - model returned an incomplete idea (missing why_valuable) - forced to accept=False for FaithLife-Community/OuDedetai
  - `web:searxng` - RuntimeError: FLEXFACTOR_SEARXNG_URL is not set

- **Ideas accepted as serving this program's purpose:** 1 (rejected 4 - the purpose contract, not the competitor, decides)

- **Bridged into the fix stream:** 0 of 5 candidate(s)
  - NOT bridged (4): AlexanderDemko/BibleNote, FaithLife-Community/OuDedetai, darinfranklin/AutomationForAccordance, tonny-kohar/alkitab-suite - idea rejected by the purpose contract
  - NOT bridged (1): Faithlife/Logos.Utility - not bridgeable (evidence=verified, reuse_mode=reference-only)

| Competitor | Kind | Licence | Reuse mode | Purpose mapping | Verdict | Fix stream | Adoptable idea |
|---|---|---|---|---|---|---|---|
| [Faithlife/Logos.Utility](https://github.com/Faithlife/Logos.Utility) | oss | `UNKNOWN` | `reference-only` | acceptance #4 | ACCEPT | NOT entered - not bridgeable (evidence=verified, reuse_mode=reference-only) | Scripture Text Verification Utility |
| [FaithLife-Community/OuDedetai](https://github.com/FaithLife-Community/OuDedetai) | oss | `MIT` | `direct-code-reuse` | purpose-only | reject | NOT entered - idea rejected by the purpose contract | (idea extraction failed) |
| [tonny-kohar/alkitab-suite](https://github.com/tonny-kohar/alkitab-suite) | oss | `NOASSERTION` | `reference-only` | purpose-only | reject | NOT entered - idea rejected by the purpose contract | Free open-source desktop Bible study core |
| [AlexanderDemko/BibleNote](https://github.com/AlexanderDemko/BibleNote) | oss | `UNKNOWN` | `reference-only` | purpose-only | reject | NOT entered - idea rejected by the purpose contract | Insufficient competitor detail |
| [darinfranklin/AutomationForAccordance](https://github.com/darinfranklin/AutomationForAccordance) | oss | `MIT` | `direct-code-reuse` | purpose-only | reject | NOT entered - idea rejected by the purpose contract | Accordance Automation Scripts |

### Faithlife/Logos.Utility

- **Evidence:** <https://github.com/Faithlife/Logos.Utility>
- **Licence:** `UNKNOWN` (via repo-rewards)
- **Reuse mode:** `reference-only` - licence UNKNOWN could not be verified; record the capability as a reference and copy nothing
- **Idea:** Scripture Text Verification Utility - Provides functions to retrieve exact provider-sourced Scripture text and compare it against user input for verification.
- **Value here:** Would enable the program to fulfill acceptance criterion #4 by giving users a reliable way to verify provider wording during sermon creation/review.
- **Purpose / criterion mapping:** acceptance #4 - Directly supports the purpose of preserving exact provider-sourced Scripture text and making provider wording verification available in the user flow.
- **Purpose verdict:** ACCEPTED - Directly supports the purpose of preserving exact provider-sourced Scripture text and making provider wording verification available in the user flow.
- **Fix-stream decision:** DID NOT enter the fix stream - not bridgeable (evidence=verified, reuse_mode=reference-only)
- **Evidence basis:** The competitor repo is described as 'C#/.NET Utility code created by Logos Bible Software', indicating it contains utility functions for Bible software tasks such as scripture text handling. (confidence low)

### FaithLife-Community/OuDedetai

- **Evidence:** <https://github.com/FaithLife-Community/OuDedetai>
- **Licence:** `MIT` (via repo-rewards)
- **Reuse mode:** `direct-code-reuse` - licence MIT is permissive and compatible; source may be read and adapted with attribution
- **Idea:** (idea extraction failed) - 
- **Value here:** 
- **Purpose / criterion mapping:** purpose-only - NOT ACTED ON: model returned an incomplete idea (missing why_valuable) - forced to accept=False. not judged: Expecting value: line 1 column 1 (char 0)
- **Purpose verdict:** REJECTED - NOT ACTED ON: model returned an incomplete idea (missing why_valuable) - forced to accept=False. not judged: Expecting value: line 1 column 1 (char 0)
- **Fix-stream decision:** DID NOT enter the fix stream - idea rejected by the purpose contract
- **Evidence basis:**  (confidence ?)

### tonny-kohar/alkitab-suite

- **Evidence:** <https://github.com/tonny-kohar/alkitab-suite>
- **Licence:** `NOASSERTION` (via repo-rewards)
- **Reuse mode:** `reference-only` - licence NOASSERTION could not be verified; record the capability as a reference and copy nothing
- **Idea:** Free open-source desktop Bible study core - Provides a completely free, open-source desktop application for Bible study that users can download, install, and use without any cost or account requirement.
- **Value here:** Would remove cost barriers for pastors, increasing adoption and fulfillment of the program's purpose to serve pastor-led sermon preparation.
- **Purpose / criterion mapping:** purpose-only - Being free/open source does not directly advance the core purpose of providing a pastor-led sermon workspace with prayer, exegesis, etc.; the program already aims to serve that purpose regardless of licensing.
- **Purpose verdict:** REJECTED - Being free/open source does not directly advance the core purpose of providing a pastor-led sermon workspace with prayer, exegesis, etc.; the program already aims to serve that purpose regardless of licensing.
- **Fix-stream decision:** DID NOT enter the fix stream - idea rejected by the purpose contract
- **Evidence basis:** Competitor description states it is an open source and free desktop Bible study software. (confidence low)

### AlexanderDemko/BibleNote

- **Evidence:** <https://github.com/AlexanderDemko/BibleNote>
- **Licence:** `UNKNOWN` (via repo-rewards)
- **Reuse mode:** `reference-only` - licence UNKNOWN could not be verified; record the capability as a reference and copy nothing
- **Idea:** Insufficient competitor detail - Cannot determine specific capability from provided evidence
- **Value here:** Unable to assess value without concrete competitor features
- **Purpose / criterion mapping:** purpose-only - Without evidence of a missing capability, adoption cannot be shown to serve the audited program's purpose
- **Purpose verdict:** REJECTED - Without evidence of a missing capability, adoption cannot be shown to serve the audited program's purpose
- **Fix-stream decision:** DID NOT enter the fix stream - idea rejected by the purpose contract
- **Evidence basis:** Only generic description "Bible study software. The next version of" given; no feature list or screenshots (confidence low)

### darinfranklin/AutomationForAccordance

- **Evidence:** <https://github.com/darinfranklin/AutomationForAccordance>
- **Licence:** `MIT` (via repo-rewards)
- **Reuse mode:** `direct-code-reuse` - licence MIT is permissive and compatible; source may be read and adapted with attribution
- **Idea:** Accordance Automation Scripts - Provides Automator workflows and shell scripts that automate interactions with Accordance Bible Software, such as fetching passages, exporting notes, and launching study tools.
- **Value here:** Would allow SermonSmith users to quickly import Scripture passages and notes from Accordance into the sermon workspace, reducing manual entry and speeding up sermon creation while preserving exact provider-sourced text.
- **Purpose / criterion mapping:** purpose-only - Automation scripts do not directly satisfy any of the program's acceptance criteria (public routes, account/recovery, sermon creation, provider wording verification, PDF inspection, truthful claims, billing, hash-router safety, release journeys, exact SHA, or deletion safety) and risk bypassing explicit human review required by the purpose.
- **Purpose verdict:** REJECTED - Automation scripts do not directly satisfy any of the program's acceptance criteria (public routes, account/recovery, sermon creation, provider wording verification, PDF inspection, truthful claims, billing, hash-router safety, release journeys, exact SHA, or deletion safety) and risk bypassing explicit human review required by the purpose.
- **Fix-stream decision:** DID NOT enter the fix stream - idea rejected by the purpose contract
- **Evidence basis:** Competitor evidence: description 'Scripts and Automator workflows for Accordance Bible Software' shows the competitor supplies automation scripts for Accordance. (confidence low)

## Release status

**BLOCKED**

Status vocabulary is the owner's (master prompt section 4). `DONE` is not a release status, and none of these are equivalent to PRODUCTION READY: tests pass, build passes, merged, deployed, health endpoint returns 200, works locally, PR opened.

Standing between this program and PRODUCTION READY (20 condition(s) without passing evidence):

- `purpose_fulfilled` — The core purpose is fully implemented and the purpose-defining journey produces the outcome the program exists to produce.
- `journeys_end_to_end` — Primary user journeys work end to end.
- `modes_behave` — Major roles, modes, controls and configuration choices materially change behavior as intended.
- `data_paths` — Production data paths are functional and protected.
- `authz` — Authentication and authorization are correct.
- `privacy_security` — Privacy and security controls are appropriate.
- `defects_resolved` — Critical and high-severity defects are resolved.
- `tests_pass` — Applicable tests pass, on full rather than selectively narrowed gates.
- `reviewed` — The complete release candidate received substantive review.
- `merged` — Required changes are merged to the verified default branch.
- `ci_on_sha` — CI passes on the exact final default-branch SHA.
- `sha_deployed` — The exact merge SHA is deployed, packaged, or installed.
- `release_identity` — Live or installed release identity is independently verified.
- `output_inspected` — The actual purpose-defining production journey was executed and its final output inspected.
- `observability` — Monitoring, logging and error reporting are operational and do not expose secrets.
- `recovery_docs` — Backup, rollback, upgrade, uninstall and recovery documentation exists and was tested where applicable.
- `claims_match` — Product claims match verified capabilities.
- `no_abandoned_work` — No production-required work is abandoned in another PR, branch, worktree, or local artifact.
- `user_understandable` — The application is understandable to its intended users without developer assistance.
- `no_external_gap` — No required credential, certificate, legal review, payment validation, or external production proof remains incomplete.

## Runtime-data evidence (read-only production)

**UNAVAILABLE** - FLEXFACTOR_READONLY_DATABASE_URL is not set - FlexFactor has NO read path to production data, so NO data-shaped or environment-shaped root cause could be looked for (this is not evidence that none exists)

_This is NOT a clean data bill of health: no data-shaped or environment-shaped root cause could be looked for._

## Remaining defects NOT auto-fixed (fix floor = medium)

_These were found but left as-is - review and decide. Critical/high here means a file that could not be safely auto-fixed (see manual-review list)._

### high (1)
- `(purpose)` line 0 (quality-gate) - **Purpose assessment evidence is incomplete**: baseline purpose assessment failed: RuntimeError: all 3 purpose assessment samples failed: EgressBlockedError: flexfactor_egress_blocked: payload contains ['password_assignment'] (near line(s) [1022, 1025, 1083, 1146, 1202]); refusing to send to a cloud model. Re-run with --redact to mask and send, --allow-sensitive to send anyway, or allow categories via FLEXFACTOR_ALLOW_EGRESS / ~/.flexfactor/policy.json {"allow_egress": [...]}.; EgressBlockedError: flexfactor_egress_blocked: payload contains ['password_assignment'] (near line(s) [1022, 1025, 1083, 1146, 1202]); refusing to send to a cloud model. Re-run with --redact to mask and send, --allow-sensitive to send anyway, or allow categories via FLEXFACTOR_ALLOW_EGRESS / ~/.flexfactor/policy.json {"allow_egress": [...]}.; EgressBlockedError: flexfactor_egress_blocked: payload contains ['password_assignment'] (near line(s) [1022, 1025, 1083, 1146, 1202]); refusing to send to a cloud model. Re-run with --redact to mask and send, --allow-sensitive to send anyway, or allow categories via FLEXFACTOR_ALLOW_EGRESS / ~/.flexfactor/policy.json {"allow_egress": [...]}.; final purpose assessment returned no usable result _Suggested fix:_ Retry the resumable run after restoring a responsive provider.

## Defects by file

_No defects found in the reviewed files._

## Fix notes / left unfixed

- publication failure made no progress and did not name another repairable source file
- baseline publication suite is red and bounded repair did not fix it; review continued, publication stays blocked
- review made no progress: three consecutive semantic review batches completed ZERO files (0 of 318 candidate file(s) reviewed all run). This is a provider/route fault, NOT evidence the repo is clean - stopped fail-closed for resumable retry
- rollback failed; working tree requires inspection


## Errors (10)

| # | phase | kind | error | responsible |
|---|---|---|---|---|
| 1 | baseline | program-defect | baseline publication suite is RED and bounded targeted repair did not fix it | - |
| 2 | rotation | program-defect | EgressBlockedError: flexfactor_egress_blocked: payload contains ['password_assignment'] (n | flexfactor.py:1294 |
| 3 | rotation | program-defect | EgressBlockedError: flexfactor_egress_blocked: payload contains ['password_assignment'] (n | flexfactor.py:1294 |
| 4 | rotation | program-defect | EgressBlockedError: flexfactor_egress_blocked: payload contains ['password_assignment'] (n | flexfactor.py:1294 |
| 5 | rotation | provider | RateLimitError: Error code: 429 - {'error': {'message': 'Provider returned error', 'code': | flexfactor.py:2412 |
| 6 | rotation | provider | APIStatusError: Error code: 413 - {'error': {'message': 'Request too large for model `alla | flexfactor.py:2412 |
| 7 | rotation | provider | RateLimitError: Error code: 429 - {'error': {'message': 'Provider returned error', 'code': | flexfactor.py:2412 |
| 8 | rotation | provider | RateLimitError: Error code: 429 - {'error': {'message': 'Provider returned error', 'code': | flexfactor.py:2412 |
| 9 | rotation | provider | RuntimeError: Structured output matched no schema key (decoy/unrelated JSON object; expect | flexfactor.py:3048 |
| 10 | baseline-gate | program-defect | review made no progress: three consecutive semantic review batches completed ZERO files (0 | - |

Counts by kind: program-defect 5, provider 5

### 1. baseline — program-defect

**Error**

```
baseline publication suite is RED and bounded targeted repair did not fix it
```

**Detail**

```
[90mstderr[2m | src/__tests__/env.test.js[2m > [22m[2mloadEnv[2m > [22m[2mparses CORS_ORIGIN as a list
[22m[39m[env] DATABASE_URL is not set (allowed in development, REQUIRED in production)
[env] JWT_SECRET is not set (allowed in development, REQUIRED in production)
[env] COOKIE_SECRET is not set (allowed in development, REQUIRED in production)

[90mstderr[2m | src/__tests__/firstLoginNotifier.test.js[2m > [22m[2mfirstLoginNotifier.recordSuccessfulLogin[2m > [22m[2mnever throws — missing prisma/user degrade to a skipped result
[22m[39m[firstLoginNotifier] failed (non-fatal): user.update: not found

[90mstderr[2m | src/__tests__/functions.test.js[2m > [22m[2mfunction routes - Bible source registry[2m > [22m[2mstill serves a chapter when the durable chapter-cache table is unavailable
[22m[39m[Bible Reader] chapter cache read unavailable; serving from source: table missing

[90mstderr[2m | src/__tests__/functions.test.js[2m > [22m[2mfunction routes - Bible source registry[2m > [22m[2mstill serves a chapter when the durable chapter-cache table is unavailable
[22m[39m[Bible Reader] chapter cache write unavailable; returning uncached text: table missing

[90mstderr[2m | src/__tests__/functions.test.js[2m > [22m[2mfunction routes - Bible source registry[2m > [22m[2mrejects quoted wording that does not match provider text for a valid reference
[22m[39m[Bible Reader] static chapter source unavailable; trying bible-api.com: Static Bible
```

**Responsible code**

- Not attributable to a specific line from the evidence recorded.

**Suggested fix** (signature)

Read the full log at C:\Users\firer\.flexfactor\runs\sermonsmith-monorepo-20260826-215927-039852-2424\baseline-publication-failure.log. Publication (push/merge) stays refused while the baseline is red; the review still runs.

### 2. rotation — program-defect

**Error**

```
EgressBlockedError: flexfactor_egress_blocked: payload contains ['password_assignment'] (near line(s) [1022, 1025, 1083, 1146, 1202]); refusing to send to a cloud model. Re-run with --redact to mask and send, --allow-sensitive to send anyway, or allow categories via FLEXFACTOR_ALLOW_EGRESS / ~/.flexfactor/policy.json {"allow_egress": [...]}.
```

**Responsible code**

- FlexFactor `flexfactor.py:1294` in `_egress_gate()`

```python
raise EgressBlockedError(
```
- Route: `openrouter/poolside/laguna-xs-2.1:free`

**Suggested fix** (signature)

The egress gate found a secret/PII pattern in repo-derived text and refused to send it to a cloud model. Remove the secret from the repo (or use --redact / FLEXFACTOR_ALLOW_EGRESS for a known-safe fixture).

### 3. rotation — program-defect

**Error**

```
EgressBlockedError: flexfactor_egress_blocked: payload contains ['password_assignment'] (near line(s) [1022, 1025, 1083, 1146, 1202]); refusing to send to a cloud model. Re-run with --redact to mask and send, --allow-sensitive to send anyway, or allow categories via FLEXFACTOR_ALLOW_EGRESS / ~/.flexfactor/policy.json {"allow_egress": [...]}.
```

**Responsible code**

- FlexFactor `flexfactor.py:1294` in `_egress_gate()`

```python
raise EgressBlockedError(
```
- Route: `openrouter/cohere/north-mini-code:free`

**Suggested fix** (signature)

The egress gate found a secret/PII pattern in repo-derived text and refused to send it to a cloud model. Remove the secret from the repo (or use --redact / FLEXFACTOR_ALLOW_EGRESS for a known-safe fixture).

### 4. rotation — program-defect

**Error**

```
EgressBlockedError: flexfactor_egress_blocked: payload contains ['password_assignment'] (near line(s) [1022, 1025, 1083, 1146, 1202]); refusing to send to a cloud model. Re-run with --redact to mask and send, --allow-sensitive to send anyway, or allow categories via FLEXFACTOR_ALLOW_EGRESS / ~/.flexfactor/policy.json {"allow_egress": [...]}.
```

**Responsible code**

- FlexFactor `flexfactor.py:1294` in `_egress_gate()`

```python
raise EgressBlockedError(
```
- Route: `openrouter/nvidia/nemotron-3.5-lightning:free`

**Suggested fix** (signature)

The egress gate found a secret/PII pattern in repo-derived text and refused to send it to a cloud model. Remove the secret from the repo (or use --redact / FLEXFACTOR_ALLOW_EGRESS for a known-safe fixture).

### 5. rotation — provider

**Error**

```
RateLimitError: Error code: 429 - {'error': {'message': 'Provider returned error', 'code': 429, 'metadata': {'raw': 'liquid/lfm-2.5-2.6b:free is temporarily rate-limited upstream. Please retry shortly, or add your own key to accumulate your rate limits: https://openrouter.ai/settings/integrations', 'provider_name': 'Liquid', 'is_byok': False, 'provider_error_code': 'model_unavailable', 'limit_source': 'upstream_provider_shared_pool', 'remedy_hint': 'Retry shortly, add your own provider key (https://openrouter.ai/settings/integrations), or route to another provider with provider routing: https://openrouter.ai/docs/features/provider-routing'}}, 'user_id': 'user_3GWU0JMa1TcZebCavX9qtXxTXSU'}
```

**Responsible code**

- FlexFactor `flexfactor.py:2412` in `_chat_create()`

```python
return client.chat.completions.create(**kwargs)
```
- Route: `openrouter/liquid/lfm-2.5-2.6b:free`

**Suggested fix** (signature)

Rate-limited. The rotator cools the pool down and moves on; nothing to fix unless it recurs on every pool, which means the free tiers are exhausted for now.

### 6. rotation — provider

**Error**

```
APIStatusError: Error code: 413 - {'error': {'message': 'Request too large for model `allam-2-7b` in organization `org_01kxhxdkh3e7nasshjpfbkzh11` service tier `on_demand` on tokens per minute (TPM): Limit 6000, Requested 7750, please reduce your message size and try again. Need more tokens? Upgrade to Dev Tier today at https://console.groq.com/settings/billing', 'type': 'tokens', 'code': 'rate_limit_exceeded'}}
```

**Responsible code**

- FlexFactor `flexfactor.py:2412` in `_chat_create()`

```python
return client.chat.completions.create(**kwargs)
```
- Route: `groq/allam-2-7b`

**Suggested fix** (signature)

Rate-limited. The rotator cools the pool down and moves on; nothing to fix unless it recurs on every pool, which means the free tiers are exhausted for now.

### 7. rotation — provider

**Error**

```
RateLimitError: Error code: 429 - {'error': {'message': 'Provider returned error', 'code': 429, 'metadata': {'raw': 'z-ai/glm-5.2:free is temporarily rate-limited upstream. Please retry shortly, or add your own key to accumulate your rate limits: https://openrouter.ai/settings/integrations', 'provider_name': 'Decart', 'is_byok': False, 'provider_error_code': 'upstream_429', 'limit_source': 'upstream_provider_shared_pool', 'remedy_hint': 'Retry shortly, add your own provider key (https://openrouter.ai/settings/integrations), or route to another provider with provider routing: https://openrouter.ai/docs/features/provider-routing', 'retry_after_seconds': 5, 'retry_after_seconds_raw': 5, 'headers': {'Retry-After': '5'}}}, 'user_id': 'user_3GWU0JMa1TcZebCavX9qtXxTXSU'}
```

**Responsible code**

- FlexFactor `flexfactor.py:2412` in `_chat_create()`

```python
return client.chat.completions.create(**kwargs)
```
- Route: `openrouter/z-ai/glm-5.2:free`

**Suggested fix** (signature)

Rate-limited. The rotator cools the pool down and moves on; nothing to fix unless it recurs on every pool, which means the free tiers are exhausted for now.

### 8. rotation — provider

**Error**

```
RateLimitError: Error code: 429 - {'error': {'message': 'Provider returned error', 'code': 429, 'metadata': {'raw': 'poolside/laguna-s-2.1:free is temporarily rate-limited upstream. Please retry shortly, or add your own key to accumulate your rate limits: https://openrouter.ai/settings/integrations', 'provider_name': 'Poolside', 'is_byok': False, 'limit_source': 'upstream_provider_shared_pool', 'remedy_hint': 'Retry shortly, add your own provider key (https://openrouter.ai/settings/integrations), or route to another provider with provider routing: https://openrouter.ai/docs/features/provider-routing'}}, 'user_id': 'user_3GWU0JMa1TcZebCavX9qtXxTXSU'}
```

**Responsible code**

- FlexFactor `flexfactor.py:2412` in `_chat_create()`

```python
return client.chat.completions.create(**kwargs)
```
- Route: `openrouter/poolside/laguna-s-2.1:free`

**Suggested fix** (signature)

Rate-limited. The rotator cools the pool down and moves on; nothing to fix unless it recurs on every pool, which means the free tiers are exhausted for now.

### 9. rotation — provider

**Error**

```
RuntimeError: Structured output matched no schema key (decoy/unrelated JSON object; expected one of ['competitors']); len=111 head='{ "name": "Logos Bible Software", "kind": "market", "search_query": "Logos Bible Software sermon preparation" }'
```

**Responsible code**

- FlexFactor `flexfactor.py:3048` in `_check_structured_type()`

```python
raise RuntimeError(
```
- Route: `openrouter/openrouter/free`

**Suggested fix** (none)

no known fix; start from the responsible code above

### 10. baseline-gate — program-defect

**Error**

```
review made no progress: three consecutive semantic review batches completed ZERO files (0 of 318 candidate file(s) reviewed all run). This is a provider/route fault, NOT evidence the repo is clean - stopped fail-closed for resumable retry
```

**Responsible code**

- Not attributable to a specific line from the evidence recorded.

**Suggested fix** (model)

model suggestion, unverified: The error is a provider/route fault with no stack trace or file/line provided. Missing details: the specific AI provider, API endpoint, authentication method, and any error logs from the semantic review batches. Check the provider's status, API keys, and network connectivity to resolve.