# FlexFactor audit — sermonsmith-monorepo

- **Project:** `C:\Users\firer\sermonsmith`
- **Branch:** `main`
- **Toolchains:** java, node
- **Files reviewed:** 0 of 318 candidate(s)
- **FILE ACCOUNTING: 318 candidate(s) = 0 reviewed + 294 never_attempted + 24 review_incomplete**
- **ZERO WORK: not one of 318 candidate file(s) was reviewed. This run did nothing; treat it as a FAILURE, not a clean repo.**
- **Defects found:** 4
- **Files fixed:** 0
- **Errors recorded:** 10 (see the Errors section below; ledger at `C:\Users\firer\.flexfactor\runs\sermonsmith-monorepo-20260826-173455-744421-36728\errors.md`)
- **Baseline build:** FAILED
- **Unit tests added:** 0 (suite not run)
- **Button/UI (Playwright):** skipped
- **Cycles run:** 1
- **Providers:** rotation:groq/compound-mini
- **Git:** PROVIDER-OUTAGE ABORT on main: checkpoint preserved; no unverified commit created

## System inventory

**968 entries accounted for.**

| Category | Count |
|---|---:|
| artifact-subtree | 9 |
| binary-asset | 69 |
| configuration-documentation-or-data | 348 |
| first-party-source | 542 |

The immutable run manifest contains the complete path-level inventory. Artifact, binary, and reparse entries are named and classified; they are not represented as line-reviewed source.

## Executable evidence

- **Evidence run:** `sermonsmith-monorepo-20260826-173455-744421-36728`
- **Exact final commit:** `bf0b588966054e30504f76efcf8d73fbd156b5a1`
- **Code map:** 580 file(s), 2978 function(s), 112 route(s), 1206 material control(s)
- **Function execution:** 0/2785 with invocation evidence
- **Route execution:** 0/112
- **Control execution:** 0/1206
- **Changed-file rescan:** 1/1 (complete)
- **Blast radius:** 1 affected file(s); analysis ran
- **Normalized gates:** 4 pass, 3 fail, 2 blocked

- **Blast Radius:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-monorepo-20260826-173455-744421-36728\blast-radius.json`
- **Changed File Rescan:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-monorepo-20260826-173455-744421-36728\changed-file-rescan.json`
- **Code Index:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-monorepo-20260826-173455-744421-36728\code-index.json`
- **Coverage Ledger:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-monorepo-20260826-173455-744421-36728\coverage-ledger.json`
- **Manifest:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-monorepo-20260826-173455-744421-36728\manifest.json`
- **Purpose Graph:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-monorepo-20260826-173455-744421-36728\purpose-graph.json`
- **Quality Gates:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-monorepo-20260826-173455-744421-36728\quality-gates.json`
- **Sarif:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-monorepo-20260826-173455-744421-36728\results.sarif`

## Production readiness

**NOT PRODUCTION READY** — 12/15 evaluated gates passed, 3 blocker(s).

Full scorecard: `C:\Users\firer\sermonsmith\sermonsmith-monorepo_readiness.md`

- **Project builds** [critical] — build command failed
  - Fix: Fix the compile/build errors.
- **Test suite passes** [high] — tests were not run
  - Fix: Run the suite and fix failures.
- **Dependencies are lock-pinned** [high] — no lockfile: java:apps/mobile/android
  - Fix: Commit the lockfile so builds are reproducible.

## Competitor research

**Coverage:** 5 competitor(s) covered with corroborating sources (target 5).

- **Sources used:** web:duckduckgo, github, repo-rewards
- **Repo Rewards endpoint:** `https://web-production-d7db7.up.railway.app`
- **Sources SKIPPED (named, not silent):**
  - `idea:BibleTime` - model returned an incomplete idea (missing why_valuable) - forced to accept=False for BibleTime
  - `idea:Faithlife/Logos.Utility` - model returned an incomplete idea (missing why_valuable) - forced to accept=False for Faithlife/Logos.Utility
  - `idea:Logos Bible Software` - model returned an incomplete idea (missing why_valuable) - forced to accept=False for Logos Bible Software
  - `idea:mdshearer/preaching-workflow` - model returned an incomplete idea (missing why_valuable) - forced to accept=False for mdshearer/preaching-workflow
  - `idea:situmorang-com/skills-sermon-adventist` - model returned an incomplete idea (missing why_valuable) - forced to accept=False for situmorang-com/skills-sermon-adventist
  - `web:searxng` - RuntimeError: FLEXFACTOR_SEARXNG_URL is not set

- **Ideas accepted as serving this program's purpose:** 0 (rejected 5 - the purpose contract, not the competitor, decides)

- **Bridged into the fix stream:** 0 of 5 candidate(s)
  - NOT bridged (5): BibleTime, Faithlife/Logos.Utility, Logos Bible Software, mdshearer/preaching-workflow, situmorang-com/skills-sermon-adventist - idea rejected by the purpose contract

| Competitor | Kind | Licence | Reuse mode | Purpose mapping | Verdict | Fix stream | Adoptable idea |
|---|---|---|---|---|---|---|---|
| [BibleTime](https://github.com/bibletime/bibletime) | oss | `GPL-2.0` | `clean-room-from-documented-behavior` | purpose-only | reject | NOT entered - idea rejected by the purpose contract | (idea extraction failed) |
| [Faithlife/Logos.Utility](https://github.com/Faithlife/Logos.Utility) | oss | `UNKNOWN` | `reference-only` | purpose-only | reject | NOT entered - idea rejected by the purpose contract | (idea extraction failed) |
| [situmorang-com/skills-sermon-adventist](https://github.com/situmorang-com/skills-sermon-adventist) | oss | `UNKNOWN` | `reference-only` | purpose-only | reject | NOT entered - idea rejected by the purpose contract | (idea extraction failed) |
| [mdshearer/preaching-workflow](https://github.com/mdshearer/preaching-workflow) | oss | `MIT` | `direct-code-reuse` | purpose-only | reject | NOT entered - idea rejected by the purpose contract | (idea extraction failed) |
| [Logos Bible Software](https://learnlogos.com/topics/sermon-preparation) | market | `UNKNOWN` | `clean-room-from-documented-behavior` | purpose-only | reject | NOT entered - idea rejected by the purpose contract | (idea extraction failed) |

### BibleTime

- **Evidence:** <https://github.com/bibletime/bibletime>, <https://github.com/bibletime/bibletimemobile>
- **Licence:** `GPL-2.0` (via github-api)
- **Reuse mode:** `clean-room-from-documented-behavior` - licence GPL-2.0 is copyleft/restricted; source must NOT be copied - work from documented behaviour only
- **Idea:** (idea extraction failed) - 
- **Value here:** 
- **Purpose / criterion mapping:** purpose-only - NOT ACTED ON: model returned an incomplete idea (missing why_valuable) - forced to accept=False. not judged: no strong route available (119 enabled routes in catalog). Pools skipped: cerebras:free-tier (pool cooling down); gemini:free-tier (gemini:free-tier allowance exhausted (account-wide)); groq:free-tier (pool cooling down); local:ollama (pool cooling down); nvidia_nim:free-tier (pool cooling down); openrouter:credits (openrouter:free-tier allowance exhausted (account-wide))
- **Purpose verdict:** REJECTED - NOT ACTED ON: model returned an incomplete idea (missing why_valuable) - forced to accept=False. not judged: no strong route available (119 enabled routes in catalog). Pools skipped: cerebras:free-tier (pool cooling down); gemini:free-tier (gemini:free-tier allowance exhausted (account-wide)); groq:free-tier (pool cooling down); local:ollama (pool cooling down); nvidia_nim:free-tier (pool cooling down); openrouter:credits (openrouter:free-tier allowance exhausted (account-wide))
- **Fix-stream decision:** DID NOT enter the fix stream - idea rejected by the purpose contract
- **Evidence basis:**  (confidence ?)

### Faithlife/Logos.Utility

- **Evidence:** <https://github.com/Faithlife/Logos.Utility>
- **Licence:** `UNKNOWN` (via repo-rewards)
- **Reuse mode:** `reference-only` - licence UNKNOWN could not be verified; record the capability as a reference and copy nothing
- **Idea:** (idea extraction failed) - 
- **Value here:** 
- **Purpose / criterion mapping:** purpose-only - NOT ACTED ON: model returned an incomplete idea (missing why_valuable) - forced to accept=False. not judged: no strong route available (119 enabled routes in catalog). Pools skipped: cerebras:free-tier (pool cooling down); gemini:free-tier (gemini:free-tier allowance exhausted (account-wide)); groq:free-tier (pool cooling down); local:ollama (pool cooling down); nvidia_nim:free-tier (pool cooling down); openrouter:credits (openrouter:free-tier allowance exhausted (account-wide))
- **Purpose verdict:** REJECTED - NOT ACTED ON: model returned an incomplete idea (missing why_valuable) - forced to accept=False. not judged: no strong route available (119 enabled routes in catalog). Pools skipped: cerebras:free-tier (pool cooling down); gemini:free-tier (gemini:free-tier allowance exhausted (account-wide)); groq:free-tier (pool cooling down); local:ollama (pool cooling down); nvidia_nim:free-tier (pool cooling down); openrouter:credits (openrouter:free-tier allowance exhausted (account-wide))
- **Fix-stream decision:** DID NOT enter the fix stream - idea rejected by the purpose contract
- **Evidence basis:**  (confidence ?)

### situmorang-com/skills-sermon-adventist

- **Evidence:** <https://github.com/situmorang-com/skills-sermon-adventist>
- **Licence:** `UNKNOWN` (via repo-rewards)
- **Reuse mode:** `reference-only` - licence UNKNOWN could not be verified; record the capability as a reference and copy nothing
- **Idea:** (idea extraction failed) - 
- **Value here:** 
- **Purpose / criterion mapping:** purpose-only - NOT ACTED ON: model returned an incomplete idea (missing why_valuable) - forced to accept=False. not judged: no strong route available (119 enabled routes in catalog). Pools skipped: cerebras:free-tier (pool cooling down); gemini:free-tier (gemini:free-tier allowance exhausted (account-wide)); groq:free-tier (pool cooling down); local:ollama (pool cooling down); nvidia_nim:free-tier (pool cooling down); openrouter:credits (openrouter:free-tier allowance exhausted (account-wide))
- **Purpose verdict:** REJECTED - NOT ACTED ON: model returned an incomplete idea (missing why_valuable) - forced to accept=False. not judged: no strong route available (119 enabled routes in catalog). Pools skipped: cerebras:free-tier (pool cooling down); gemini:free-tier (gemini:free-tier allowance exhausted (account-wide)); groq:free-tier (pool cooling down); local:ollama (pool cooling down); nvidia_nim:free-tier (pool cooling down); openrouter:credits (openrouter:free-tier allowance exhausted (account-wide))
- **Fix-stream decision:** DID NOT enter the fix stream - idea rejected by the purpose contract
- **Evidence basis:**  (confidence ?)

### mdshearer/preaching-workflow

- **Evidence:** <https://github.com/mdshearer/preaching-workflow>
- **Licence:** `MIT` (via repo-rewards)
- **Reuse mode:** `direct-code-reuse` - licence MIT is permissive and compatible; source may be read and adapted with attribution
- **Idea:** (idea extraction failed) - 
- **Value here:** 
- **Purpose / criterion mapping:** purpose-only - NOT ACTED ON: model returned an incomplete idea (missing why_valuable) - forced to accept=False. not judged: no strong route available (119 enabled routes in catalog). Pools skipped: cerebras:free-tier (pool cooling down); gemini:free-tier (gemini:free-tier allowance exhausted (account-wide)); groq:free-tier (pool cooling down); local:ollama (pool cooling down); nvidia_nim:free-tier (pool cooling down); openrouter:credits (openrouter:free-tier allowance exhausted (account-wide))
- **Purpose verdict:** REJECTED - NOT ACTED ON: model returned an incomplete idea (missing why_valuable) - forced to accept=False. not judged: no strong route available (119 enabled routes in catalog). Pools skipped: cerebras:free-tier (pool cooling down); gemini:free-tier (gemini:free-tier allowance exhausted (account-wide)); groq:free-tier (pool cooling down); local:ollama (pool cooling down); nvidia_nim:free-tier (pool cooling down); openrouter:credits (openrouter:free-tier allowance exhausted (account-wide))
- **Fix-stream decision:** DID NOT enter the fix stream - idea rejected by the purpose contract
- **Evidence basis:**  (confidence ?)

### Logos Bible Software

- **Evidence:** <https://learnlogos.com/topics/sermon-preparation>, <https://www.logos.com/product/173573/sermon-preparation>, <https://support.logos.com/hc/en-us/articles/360016747391-Writing-Sermons-Using-Sermon-Builder>
- **Licence:** `UNKNOWN` (via none (no repository could be attributed to this competitor))
- **Reuse mode:** `clean-room-from-documented-behavior` - no inspectable source (licence UNKNOWN); only publicly documented behaviour may inform our own independent design
- **Idea:** (idea extraction failed) - 
- **Value here:** 
- **Purpose / criterion mapping:** purpose-only - NOT ACTED ON: model returned an incomplete idea (missing why_valuable) - forced to accept=False. not judged: no strong route available (119 enabled routes in catalog). Pools skipped: cerebras:free-tier (pool cooling down); gemini:free-tier (gemini:free-tier allowance exhausted (account-wide)); groq:free-tier (pool cooling down); local:ollama (pool cooling down); nvidia_nim:free-tier (pool cooling down); openrouter:credits (openrouter:free-tier allowance exhausted (account-wide))
- **Purpose verdict:** REJECTED - NOT ACTED ON: model returned an incomplete idea (missing why_valuable) - forced to accept=False. not judged: no strong route available (119 enabled routes in catalog). Pools skipped: cerebras:free-tier (pool cooling down); gemini:free-tier (gemini:free-tier allowance exhausted (account-wide)); groq:free-tier (pool cooling down); local:ollama (pool cooling down); nvidia_nim:free-tier (pool cooling down); openrouter:credits (openrouter:free-tier allowance exhausted (account-wide))
- **Fix-stream decision:** DID NOT enter the fix stream - idea rejected by the purpose contract
- **Evidence basis:**  (confidence ?)

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
- `(purpose)` line 0 (quality-gate) - **Purpose assessment evidence is incomplete**: baseline purpose assessment failed: RuntimeError: all 3 purpose assessment samples failed: EgressBlockedError: flexfactor_egress_blocked: payload contains ['password_assignment'] (near line(s) [1021, 1024, 1082, 1145, 1201]); refusing to send to a cloud model. Re-run with --redact to mask and send, --allow-sensitive to send anyway, or allow categories via FLEXFACTOR_ALLOW_EGRESS / ~/.flexfactor/policy.json {"allow_egress": [...]}.; EgressBlockedError: flexfactor_egress_blocked: payload contains ['password_assignment'] (near line(s) [1021, 1024, 1082, 1145, 1201]); refusing to send to a cloud model. Re-run with --redact to mask and send, --allow-sensitive to send anyway, or allow categories via FLEXFACTOR_ALLOW_EGRESS / ~/.flexfactor/policy.json {"allow_egress": [...]}.; EgressBlockedError: flexfactor_egress_blocked: payload contains ['password_assignment'] (near line(s) [1021, 1024, 1082, 1145, 1201]); refusing to send to a cloud model. Re-run with --redact to mask and send, --allow-sensitive to send anyway, or allow categories via FLEXFACTOR_ALLOW_EGRESS / ~/.flexfactor/policy.json {"allow_egress": [...]}.; final purpose assessment returned no usable result _Suggested fix:_ Retry the resumable run after restoring a responsive provider.

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
| 4 | rotation | provider | TimeoutError: timed out | flexfactor.py:2755 |
| 5 | rotation | provider | TimeoutError: timed out | flexfactor.py:2755 |
| 6 | rotation | program-defect | EgressBlockedError: flexfactor_egress_blocked: payload contains ['password_assignment'] (n | flexfactor.py:1294 |
| 7 | rotation | provider | APIStatusError: Error code: 413 - {'error': {'message': 'Request Entity Too Large', 'type' | flexfactor.py:2412 |
| 8 | rotation | provider | TimeoutError: timed out | flexfactor.py:2755 |
| 9 | rotation | provider | NotFoundError: Error code: 404 - {'status': 404, 'title': 'Not Found', 'detail': "Function | flexfactor.py:2412 |
| 10 | baseline-gate | program-defect | review made no progress: three consecutive semantic review batches completed ZERO files (0 | - |

Counts by kind: program-defect 5, provider 5

### 1. baseline — program-defect

**Error**

```
baseline publication suite is RED and bounded targeted repair did not fix it
```

**Detail**

```
> sermonsmith-monorepo@0.0.0 typecheck
> npm run typecheck -w @sermonsmith/web && npm run typecheck -w @sermonsmith/api


> @sermonsmith/web@1.0.1 typecheck
> tsc -p ./jsconfig.json


> @sermonsmith/api@1.0.0 typecheck
> node scripts/typecheck.mjs

Typecheck OK: 54 files parsed.


$ npm run build
[22m[39m[Bible Reader] static chapter source unavailable; trying bible-api.com: Static Bible source returned no verses for 2 Corinthians 13


[31m⎯⎯⎯⎯⎯⎯⎯[39m[1m[41m Failed Tests 1 [49m[22m[31m⎯⎯⎯⎯⎯⎯⎯[39m

[41m[1m FAIL [22m[49m src/__tests__/functions.test.js[2m > [22mfunction routes - Bible source registry[2m > [22mserves every chapter of every multi-token book from all pinned static datasets without fallback
[31m[1mError[22m: Test timed out in 15000ms.
If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".[39m
[36m [2m❯[22m src/__tests__/functions.test.js:[2m150:3[22m[39m
    [90m148|[39m   })[33m;[39m
    [90m149|[39m
    [90m150|[39m   it('serves every chapter of every multi-token book from all pinned s…
    [90m   |[39m   [31m^[39m
    [90m151|[39m     [35mconst[39m affectedBooks [33m=[39m [
    [90m152|[39m       [[32m'1 Samuel'[39m[33m,[39m [34m31[39m[33m,[39m [32m'1samuel'[39m][33m,[39m [[32m'2 Samuel'[39m[33m,[39m [34m24[39m[33m,[39m [32m'2samuel'[39m][33m,[39m

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯[22m[39m

npm error Lifecycle script `te
```

**Responsible code**

- Not attributable to a specific line from the evidence recorded.

**Suggested fix** (signature)

Read the full log at C:\Users\firer\.flexfactor\runs\sermonsmith-monorepo-20260826-173455-744421-36728\baseline-publication-failure.log. Publication (push/merge) stays refused while the baseline is red; the review still runs.

### 2. rotation — program-defect

**Error**

```
EgressBlockedError: flexfactor_egress_blocked: payload contains ['password_assignment'] (near line(s) [1021, 1024, 1082, 1145, 1201]); refusing to send to a cloud model. Re-run with --redact to mask and send, --allow-sensitive to send anyway, or allow categories via FLEXFACTOR_ALLOW_EGRESS / ~/.flexfactor/policy.json {"allow_egress": [...]}.
```

**Responsible code**

- FlexFactor `flexfactor.py:1294` in `_egress_gate()`

```python
raise EgressBlockedError(
```
- Route: `groq/groq/compound-mini`

**Suggested fix** (signature)

The egress gate found a secret/PII pattern in repo-derived text and refused to send it to a cloud model. Remove the secret from the repo (or use --redact / FLEXFACTOR_ALLOW_EGRESS for a known-safe fixture).

### 3. rotation — program-defect

**Error**

```
EgressBlockedError: flexfactor_egress_blocked: payload contains ['password_assignment'] (near line(s) [1021, 1024, 1082, 1145, 1201]); refusing to send to a cloud model. Re-run with --redact to mask and send, --allow-sensitive to send anyway, or allow categories via FLEXFACTOR_ALLOW_EGRESS / ~/.flexfactor/policy.json {"allow_egress": [...]}.
```

**Responsible code**

- FlexFactor `flexfactor.py:1294` in `_egress_gate()`

```python
raise EgressBlockedError(
```
- Route: `gemini/gemini-2.5-flash`

**Suggested fix** (signature)

The egress gate found a secret/PII pattern in repo-derived text and refused to send it to a cloud model. Remove the secret from the repo (or use --redact / FLEXFACTOR_ALLOW_EGRESS for a known-safe fixture).

### 4. rotation — provider

**Error**

```
TimeoutError: timed out
```

**Responsible code**

- FlexFactor `flexfactor.py:2755` in `_chat()`

```python
with self._opener.open(req, timeout=_ollama_http_timeout()) as resp:
```
- Route: `ollama/phi4-mini:latest`

**Suggested fix** (none)

no known fix; start from the responsible code above

### 5. rotation — provider

**Error**

```
TimeoutError: timed out
```

**Responsible code**

- FlexFactor `flexfactor.py:2755` in `_chat()`

```python
with self._opener.open(req, timeout=_ollama_http_timeout()) as resp:
```
- Route: `ollama/mistral:latest`

**Suggested fix** (none)

no known fix; start from the responsible code above

### 6. rotation — program-defect

**Error**

```
EgressBlockedError: flexfactor_egress_blocked: payload contains ['password_assignment'] (near line(s) [1021, 1024, 1082, 1145, 1201]); refusing to send to a cloud model. Re-run with --redact to mask and send, --allow-sensitive to send anyway, or allow categories via FLEXFACTOR_ALLOW_EGRESS / ~/.flexfactor/policy.json {"allow_egress": [...]}.
```

**Responsible code**

- FlexFactor `flexfactor.py:1294` in `_egress_gate()`

```python
raise EgressBlockedError(
```
- Route: `nvidia_nim/microsoft/phi-3-vision-128k-instruct`

**Suggested fix** (signature)

The egress gate found a secret/PII pattern in repo-derived text and refused to send it to a cloud model. Remove the secret from the repo (or use --redact / FLEXFACTOR_ALLOW_EGRESS for a known-safe fixture).

### 7. rotation — provider

**Error**

```
APIStatusError: Error code: 413 - {'error': {'message': 'Request Entity Too Large', 'type': 'invalid_request_error', 'code': 'request_too_large'}}
```

**Responsible code**

- FlexFactor `flexfactor.py:2412` in `_chat_create()`

```python
return client.chat.completions.create(**kwargs)
```
- Route: `groq/groq/compound`

**Suggested fix** (none)

no known fix; start from the responsible code above

### 8. rotation — provider

**Error**

```
TimeoutError: timed out
```

**Responsible code**

- FlexFactor `flexfactor.py:2755` in `_chat()`

```python
with self._opener.open(req, timeout=_ollama_http_timeout()) as resp:
```
- Route: `ollama/gemma4:e4b`

**Suggested fix** (none)

no known fix; start from the responsible code above

### 9. rotation — provider

**Error**

```
NotFoundError: Error code: 404 - {'status': 404, 'title': 'Not Found', 'detail': "Function '767b5b9a-3f9d-4c1d-86e8-fa861988cee7': Not found for account 'hvux_0rjHS6OiBfWXcZvKgoOaUBy_3UsQqq6I6IAz7I'"}
```

**Responsible code**

- FlexFactor `flexfactor.py:2412` in `_chat_create()`

```python
return client.chat.completions.create(**kwargs)
```
- Route: `nvidia_nim/mistralai/mistral-large`

**Suggested fix** (none)

no known fix; start from the responsible code above

### 10. baseline-gate — program-defect

**Error**

```
review made no progress: three consecutive semantic review batches completed ZERO files (0 of 318 candidate file(s) reviewed all run). This is a provider/route fault, NOT evidence the repo is clean - stopped fail-closed for resumable retry
```

**Responsible code**

- Not attributable to a specific line from the evidence recorded.

**Suggested fix** (none)

no known fix; start from the responsible code above (model suggester failed: no light route available (119 enabled routes in catalog). Pools skipped: gemini:free-tier (gemini:free-tier allowance exhausted (account-wide)); groq:free-tier (pool cooling down); local:ollama (pool cooling down); nvidia_nim:free-tier (pool cooling down); openrouter:credits (openrouter:free-tier allowance exhausted (account-wide)); openrouter:free:cohere/north-mini-code:free (openrouter:free-tier allowance exhausted (account-wide)))