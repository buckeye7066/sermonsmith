# FlexFactor audit — sermonsmith-monorepo

- **Project:** `C:\Users\firer\sermonsmith`
- **Branch:** `main`
- **Toolchains:** java, node
- **Files reviewed:** 0 of 318 candidate(s)
- **FILE ACCOUNTING: 318 candidate(s) = 0 reviewed + 294 never_attempted + 24 review_incomplete**
- **ZERO WORK: not one of 318 candidate file(s) was reviewed. This run did nothing; treat it as a FAILURE, not a clean repo.**
- **Defects found:** 3
- **Files fixed:** 0
- **Errors recorded:** 7 (see the Errors section below; ledger at `C:\Users\firer\.flexfactor\runs\sermonsmith-monorepo-20260826-130626-611953-4264\errors.md`)
- **Baseline build:** passed
- **Unit tests added:** 0 (suite not run)
- **Button/UI (Playwright):** skipped
- **Cycles run:** 1
- **Providers:** rotation:google/diffusiongemma-26b-a4b-it
- **Git:** PROVIDER-OUTAGE ABORT on main: checkpoint preserved; no unverified commit created

## System inventory

**967 entries accounted for.**

| Category | Count |
|---|---:|
| artifact-subtree | 9 |
| binary-asset | 69 |
| configuration-documentation-or-data | 347 |
| first-party-source | 542 |

The immutable run manifest contains the complete path-level inventory. Artifact, binary, and reparse entries are named and classified; they are not represented as line-reviewed source.

## Executable evidence

- **Evidence run:** `sermonsmith-monorepo-20260826-130626-611953-4264`
- **Exact final commit:** `d6bde68915a1c35a4e062a19b8469ba3aac29426`
- **Code map:** 579 file(s), 2978 function(s), 112 route(s), 1206 material control(s)
- **Function execution:** 0/2785 with invocation evidence
- **Route execution:** 0/112
- **Control execution:** 0/1206
- **Changed-file rescan:** 0/0 (complete)
- **Blast radius:** 0 affected file(s); analysis ran
- **Normalized gates:** 5 pass, 2 fail, 2 blocked

- **Blast Radius:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-monorepo-20260826-130626-611953-4264\blast-radius.json`
- **Changed File Rescan:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-monorepo-20260826-130626-611953-4264\changed-file-rescan.json`
- **Code Index:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-monorepo-20260826-130626-611953-4264\code-index.json`
- **Coverage Ledger:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-monorepo-20260826-130626-611953-4264\coverage-ledger.json`
- **Manifest:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-monorepo-20260826-130626-611953-4264\manifest.json`
- **Purpose Graph:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-monorepo-20260826-130626-611953-4264\purpose-graph.json`
- **Quality Gates:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-monorepo-20260826-130626-611953-4264\quality-gates.json`
- **Sarif:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-monorepo-20260826-130626-611953-4264\results.sarif`

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
  - `idea:Accordance Bible Software` - model returned an incomplete idea (missing why_valuable) - forced to accept=False for Accordance Bible Software
  - `idea:Kalradia/AdventistHymnal` - model returned an incomplete idea (missing why_valuable) - forced to accept=False for Kalradia/AdventistHymnal
  - `idea:ktrue/proclaim-utility` - model returned an incomplete idea (missing why_valuable) - forced to accept=False for ktrue/proclaim-utility
  - `web:searxng` - RuntimeError: FLEXFACTOR_SEARXNG_URL is not set

- **Ideas accepted as serving this program's purpose:** 1 (rejected 4 - the purpose contract, not the competitor, decides)

- **Bridged into the fix stream:** 0 of 5 candidate(s)
  - NOT bridged (1): solafide-dev/simpleworship - accepted idea did not map to a valid acceptance criterion
  - NOT bridged (4): Accordance Bible Software, Kalradia/AdventistHymnal, ktrue/proclaim-utility, praisenter/praisenter - idea rejected by the purpose contract

| Competitor | Kind | Licence | Reuse mode | Purpose mapping | Verdict | Fix stream | Adoptable idea |
|---|---|---|---|---|---|---|---|
| [praisenter/praisenter](https://github.com/praisenter/praisenter) | oss | `BSD-3-Clause` | `direct-code-reuse` | purpose-only | reject | NOT entered - idea rejected by the purpose contract | Prayer Generator AI |
| [Kalradia/AdventistHymnal](https://github.com/Kalradia/AdventistHymnal) | oss | `MIT` | `direct-code-reuse` | purpose-only | reject | NOT entered - idea rejected by the purpose contract | (idea extraction failed) |
| [ktrue/proclaim-utility](https://github.com/ktrue/proclaim-utility) | oss | `GPL-3.0` | `clean-room-from-documented-behavior` | purpose-only | reject | NOT entered - idea rejected by the purpose contract | (idea extraction failed) |
| [solafide-dev/simpleworship](https://github.com/solafide-dev/simpleworship) | oss | `GPL-3.0` | `clean-room-from-documented-behavior` | acceptance #4. provider wording verification actually available in the user flow (review & collaboration). | ACCEPT | NOT entered - accepted idea did not map to a valid acceptance criterion | Real‑time Collaborative Sermon Editing |
| [Accordance Bible Software](https://github.com/Accordance-Bible-Software-Mac/.github) | oss | `UNKNOWN` | `reference-only` | purpose-only | reject | NOT entered - idea rejected by the purpose contract | (idea extraction failed) |

### praisenter/praisenter

- **Evidence:** <https://github.com/praisenter/praisenter>
- **Licence:** `BSD-3-Clause` (via repo-rewards)
- **Reuse mode:** `direct-code-reuse` - licence BSD-3-Clause is permissive and compatible; source may be read and adapted with attribution
- **Idea:** Prayer Generator AI - AI-assisted prayer writing feature that generates personalized prayers based on user input or sermon topics.
- **Value here:** Adding an AI-powered prayer generator would directly fulfill the audited program's stated purpose of providing 'AI-assisted prayer writing' as a core feature for pastors and users during sermon preparation.
- **Purpose / criterion mapping:** purpose-only - Although the audited program's purpose includes 'AI-assisted prayer writing', the competitor praisenter/praisenter does not provide clear evidence of having this specific feature. Without confirmation that the competitor possesses this capability, the idea cannot be validated as adoptable from them.
- **Purpose verdict:** REJECTED - Although the audited program's purpose includes 'AI-assisted prayer writing', the competitor praisenter/praisenter does not provide clear evidence of having this specific feature. Without confirmation that the competitor possesses this capability, the idea cannot be validated as adoptable from them.
- **Fix-stream decision:** DID NOT enter the fix stream - idea rejected by the purpose contract
- **Evidence basis:** The competitor praisenter/praisenter is described as 'Free Church Presentation Software' and, while not explicitly detailed in the snippet, such tools commonly include prayer generation aids; however, the audited program's README already lists 'Prayer Generator - AI-assisted prayer writing' as a feature, suggesting this may already be planned or partially implemented. No direct evidence from the competitor confirms this specific capability. (confidence low)

### Kalradia/AdventistHymnal

- **Evidence:** <https://github.com/Kalradia/AdventistHymnal>
- **Licence:** `MIT` (via repo-rewards)
- **Reuse mode:** `direct-code-reuse` - licence MIT is permissive and compatible; source may be read and adapted with attribution
- **Idea:** (idea extraction failed) - 
- **Value here:** 
- **Purpose / criterion mapping:** purpose-only - NOT ACTED ON: model returned an incomplete idea (missing why_valuable) - forced to accept=False. not judged: 404 page not found
- **Purpose verdict:** REJECTED - NOT ACTED ON: model returned an incomplete idea (missing why_valuable) - forced to accept=False. not judged: 404 page not found
- **Fix-stream decision:** DID NOT enter the fix stream - idea rejected by the purpose contract
- **Evidence basis:**  (confidence ?)

### ktrue/proclaim-utility

- **Evidence:** <https://github.com/ktrue/proclaim-utility>
- **Licence:** `GPL-3.0` (via repo-rewards)
- **Reuse mode:** `clean-room-from-documented-behavior` - licence GPL-3.0 is copyleft/restricted; source must NOT be copied - work from documented behaviour only
- **Idea:** (idea extraction failed) - 
- **Value here:** 
- **Purpose / criterion mapping:** purpose-only - NOT ACTED ON: model returned an incomplete idea (missing why_valuable) - forced to accept=False. not judged: no strong route available (102 enabled routes in catalog). Pools skipped: cerebras:free-tier (pool cooling down); groq:free-tier (pool cooling down); local:ollama (pool cooling down); nvidia_nim:free-tier (pool cooling down); openrouter:credits (openrouter:free-tier allowance exhausted (account-wide)); openrouter:free:cohere/north-mini-code:free (openrouter:free-tier allowance exhausted (account-wide))
- **Purpose verdict:** REJECTED - NOT ACTED ON: model returned an incomplete idea (missing why_valuable) - forced to accept=False. not judged: no strong route available (102 enabled routes in catalog). Pools skipped: cerebras:free-tier (pool cooling down); groq:free-tier (pool cooling down); local:ollama (pool cooling down); nvidia_nim:free-tier (pool cooling down); openrouter:credits (openrouter:free-tier allowance exhausted (account-wide)); openrouter:free:cohere/north-mini-code:free (openrouter:free-tier allowance exhausted (account-wide))
- **Fix-stream decision:** DID NOT enter the fix stream - idea rejected by the purpose contract
- **Evidence basis:**  (confidence ?)

### solafide-dev/simpleworship

- **Evidence:** <https://github.com/solafide-dev/simpleworship>
- **Licence:** `GPL-3.0` (via repo-rewards)
- **Reuse mode:** `clean-room-from-documented-behavior` - licence GPL-3.0 is copyleft/restricted; source must NOT be copied - work from documented behaviour only
- **Idea:** Real‑time Collaborative Sermon Editing - Allows multiple users to simultaneously edit and review sermon outlines in real‑time, providing live updates, comments, and versioning.
- **Value here:** Pastor teams can co‑author sermons, iterate quickly and ensure joint oversight, directly supporting the program’s focus on explicit human review and pastoral judgment.
- **Purpose / criterion mapping:** acceptance #4. provider wording verification actually available in the user flow (review & collaboration). - It advances the audited program’s privacy‑preserving, collaborative review workflow by enabling multiple reviewers to interact directly with the outline, which is central to the described purpose.
- **Purpose verdict:** ACCEPTED - It advances the audited program’s privacy‑preserving, collaborative review workflow by enabling multiple reviewers to interact directly with the outline, which is central to the described purpose.
- **Fix-stream decision:** DID NOT enter the fix stream - accepted idea did not map to a valid acceptance criterion
- **Evidence basis:** Competitor repo includes a dedicated component apps/web/src/components/collaboration/CollaborativeEditor.jsx showing a real‑time collaborative editing interface. (confidence medium)

### Accordance Bible Software

- **Evidence:** <https://github.com/Accordance-Bible-Software-Mac/.github>
- **Licence:** `UNKNOWN` (via github-api)
- **Reuse mode:** `reference-only` - licence UNKNOWN could not be verified; record the capability as a reference and copy nothing
- **Idea:** (idea extraction failed) - 
- **Value here:** 
- **Purpose / criterion mapping:** purpose-only - NOT ACTED ON: model returned an incomplete idea (missing why_valuable) - forced to accept=False. not judged: 404 page not found
- **Purpose verdict:** REJECTED - NOT ACTED ON: model returned an incomplete idea (missing why_valuable) - forced to accept=False. not judged: 404 page not found
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

- review made no progress: three consecutive semantic review batches completed ZERO files (0 of 318 candidate file(s) reviewed all run). This is a provider/route fault, NOT evidence the repo is clean - stopped fail-closed for resumable retry
- rollback failed; working tree requires inspection


## Errors (7)

| # | phase | kind | error | responsible |
|---|---|---|---|---|
| 1 | rotation | program-defect | EgressBlockedError: flexfactor_egress_blocked: payload contains ['password_assignment'] (n | flexfactor.py:1294 |
| 2 | rotation | program-defect | EgressBlockedError: flexfactor_egress_blocked: payload contains ['password_assignment'] (n | flexfactor.py:1294 |
| 3 | rotation | provider | TimeoutError: timed out | flexfactor.py:2755 |
| 4 | rotation | program-defect | EgressBlockedError: flexfactor_egress_blocked: payload contains ['password_assignment'] (n | flexfactor.py:1294 |
| 5 | rotation | provider | RateLimitError: Error code: 429 - {'error': {'message': 'Rate limit reached for model `met | flexfactor.py:2412 |
| 6 | rotation | provider | TimeoutError: timed out | flexfactor.py:2755 |
| 7 | baseline-gate | program-defect | review made no progress: three consecutive semantic review batches completed ZERO files (0 | - |

Counts by kind: program-defect 4, provider 3

### 1. rotation — program-defect

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
- Route: `nvidia_nim/stepfun-ai/step-3.7-flash`

**Suggested fix** (signature)

The egress gate found a secret/PII pattern in repo-derived text and refused to send it to a cloud model. Remove the secret from the repo (or use --redact / FLEXFACTOR_ALLOW_EGRESS for a known-safe fixture).

### 3. rotation — provider

**Error**

```
TimeoutError: timed out
```

**Responsible code**

- FlexFactor `flexfactor.py:2755` in `_chat()`

```python
with self._opener.open(req, timeout=_ollama_http_timeout()) as resp:
```
- Route: `ollama/gpt-oss:20b`

**Suggested fix** (none)

no known fix; start from the responsible code above

### 4. rotation — program-defect

**Error**

```
EgressBlockedError: flexfactor_egress_blocked: payload contains ['password_assignment'] (near line(s) [1021, 1024, 1082, 1145, 1201]); refusing to send to a cloud model. Re-run with --redact to mask and send, --allow-sensitive to send anyway, or allow categories via FLEXFACTOR_ALLOW_EGRESS / ~/.flexfactor/policy.json {"allow_egress": [...]}.
```

**Responsible code**

- FlexFactor `flexfactor.py:1294` in `_egress_gate()`

```python
raise EgressBlockedError(
```
- Route: `nvidia_nim/01-ai/yi-large`

**Suggested fix** (signature)

The egress gate found a secret/PII pattern in repo-derived text and refused to send it to a cloud model. Remove the secret from the repo (or use --redact / FLEXFACTOR_ALLOW_EGRESS for a known-safe fixture).

### 5. rotation — provider

**Error**

```
RateLimitError: Error code: 429 - {'error': {'message': 'Rate limit reached for model `meta-llama/llama-4-scout-17b-16e-instruct` in organization `org_01kxhxdkh3e7nasshjpfbkzh11` service tier `on_demand` on tokens per minute (TPM): Limit 30000, Used 29007, Requested 6920. Please try again in 11.854s. Need more tokens? Upgrade to Dev Tier today at https://console.groq.com/settings/billing', 'type': 'compound', 'code': 'rate_limit_exceeded'}}
```

**Responsible code**

- FlexFactor `flexfactor.py:2412` in `_chat_create()`

```python
return client.chat.completions.create(**kwargs)
```
- Route: `groq/groq/compound`

**Suggested fix** (signature)

Rate-limited. The rotator cools the pool down and moves on; nothing to fix unless it recurs on every pool, which means the free tiers are exhausted for now.

### 6. rotation — provider

**Error**

```
TimeoutError: timed out
```

**Responsible code**

- FlexFactor `flexfactor.py:2755` in `_chat()`

```python
with self._opener.open(req, timeout=_ollama_http_timeout()) as resp:
```
- Route: `ollama/deepseek-r1:8b`

**Suggested fix** (none)

no known fix; start from the responsible code above

### 7. baseline-gate — program-defect

**Error**

```
review made no progress: three consecutive semantic review batches completed ZERO files (0 of 318 candidate file(s) reviewed all run). This is a provider/route fault, NOT evidence the repo is clean - stopped fail-closed for resumable retry
```

**Responsible code**

- Not attributable to a specific line from the evidence recorded.

**Suggested fix** (none)

no known fix; start from the responsible code above (model suggester failed: no light route available (102 enabled routes in catalog). Pools skipped: groq:free-tier (pool cooling down); local:ollama (pool cooling down); nvidia_nim:free-tier (pool cooling down); openrouter:credits (openrouter:free-tier allowance exhausted (account-wide)); openrouter:free:cohere/north-mini-code:free (openrouter:free-tier allowance exhausted (account-wide)); openrouter:free:dots-studio/dots-3-note-preview:free (openrouter:free-tier allowance exhausted (account-wide)))