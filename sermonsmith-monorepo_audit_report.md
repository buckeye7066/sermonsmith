# FlexFactor audit — sermonsmith-monorepo

- **Project:** `C:\Users\firer\sermonsmith`
- **Branch:** `main`
- **Toolchains:** java, node
- **Files reviewed:** 0 of 318 candidate(s)
- **FILE ACCOUNTING: 318 candidate(s) = 0 reviewed + 294 never_attempted + 24 review_incomplete**
- **ZERO WORK: not one of 318 candidate file(s) was reviewed. This run did nothing; treat it as a FAILURE, not a clean repo.**
- **Defects found:** 3
- **Files fixed:** 0
- **Errors recorded:** 5 (see the Errors section below; ledger at `C:\Users\firer\.flexfactor\runs\sermonsmith-monorepo-20260826-064607-381878-31220\errors.md`)
- **Baseline build:** passed
- **Unit tests added:** 0 (suite not run)
- **Button/UI (Playwright):** skipped
- **Cycles run:** 1
- **Providers:** rotation:gemini-2.5-flash
- **Git:** PROVIDER-OUTAGE ABORT on main: checkpoint preserved; no unverified commit created

## System inventory

**966 entries accounted for.**

| Category | Count |
|---|---:|
| artifact-subtree | 9 |
| binary-asset | 69 |
| configuration-documentation-or-data | 346 |
| first-party-source | 542 |

The immutable run manifest contains the complete path-level inventory. Artifact, binary, and reparse entries are named and classified; they are not represented as line-reviewed source.

## Executable evidence

- **Evidence run:** `sermonsmith-monorepo-20260826-064607-381878-31220`
- **Exact final commit:** `d82a4dcdabe8ee9659589f5810943653fa592aa0`
- **Code map:** 578 file(s), 2978 function(s), 112 route(s), 1206 material control(s)
- **Function execution:** 0/2785 with invocation evidence
- **Route execution:** 0/112
- **Control execution:** 0/1206
- **Changed-file rescan:** 0/0 (complete)
- **Blast radius:** 0 affected file(s); analysis ran
- **Normalized gates:** 5 pass, 2 fail, 2 blocked

- **Blast Radius:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-monorepo-20260826-064607-381878-31220\blast-radius.json`
- **Changed File Rescan:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-monorepo-20260826-064607-381878-31220\changed-file-rescan.json`
- **Code Index:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-monorepo-20260826-064607-381878-31220\code-index.json`
- **Coverage Ledger:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-monorepo-20260826-064607-381878-31220\coverage-ledger.json`
- **Manifest:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-monorepo-20260826-064607-381878-31220\manifest.json`
- **Purpose Graph:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-monorepo-20260826-064607-381878-31220\purpose-graph.json`
- **Quality Gates:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-monorepo-20260826-064607-381878-31220\quality-gates.json`
- **Sarif:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-monorepo-20260826-064607-381878-31220\results.sarif`

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
  - `idea:BibleTime` - model returned an incomplete idea (missing why_valuable) - forced to accept=False for BibleTime
  - `idea:robrawks/LogosBibleSoftwareMCP` - model returned an incomplete idea (missing why_valuable) - forced to accept=False for robrawks/LogosBibleSoftwareMCP
  - `idea:tonny-kohar/alkitab-suite` - model returned an incomplete idea (missing why_valuable) - forced to accept=False for tonny-kohar/alkitab-suite
  - `web:searxng` - RuntimeError: FLEXFACTOR_SEARXNG_URL is not set

- **Ideas accepted as serving this program's purpose:** 1 (rejected 4 - the purpose contract, not the competitor, decides)

- **Bridged into the fix stream:** 0 of 5 candidate(s)
  - NOT bridged (4): Accordance Bible Software, BibleTime, robrawks/LogosBibleSoftwareMCP, tonny-kohar/alkitab-suite - idea rejected by the purpose contract
  - NOT bridged (1): Accordance-Bible-Software-Mac/.github - not bridgeable (evidence=verified, reuse_mode=reference-only)

| Competitor | Kind | Licence | Reuse mode | Purpose mapping | Verdict | Fix stream | Adoptable idea |
|---|---|---|---|---|---|---|---|
| [BibleTime](https://github.com/bibletime/bibletime) | oss | `GPL-2.0` | `clean-room-from-documented-behavior` | purpose-only | reject | NOT entered - idea rejected by the purpose contract | (idea extraction failed) |
| [tonny-kohar/alkitab-suite](https://github.com/tonny-kohar/alkitab-suite) | oss | `NOASSERTION` | `reference-only` | purpose-only | reject | NOT entered - idea rejected by the purpose contract | (idea extraction failed) |
| [robrawks/LogosBibleSoftwareMCP](https://github.com/robrawks/LogosBibleSoftwareMCP) | oss | `MIT` | `direct-code-reuse` | purpose-only | reject | NOT entered - idea rejected by the purpose contract | (idea extraction failed) |
| [Accordance Bible Software](https://github.com/Accordance-Bible-Software-Mac/.github) | oss | `UNKNOWN` | `reference-only` | purpose-only | reject | NOT entered - idea rejected by the purpose contract | (idea extraction failed) |
| [Accordance-Bible-Software-Mac/.github](https://github.com/Accordance-Bible-Software-Mac/.github) | oss | `UNKNOWN` | `reference-only` | acceptance #3. sermon creation | ACCEPT | NOT entered - not bridgeable (evidence=verified, reuse_mode=reference-only) | Original Language Search |

### BibleTime

- **Evidence:** <https://github.com/bibletime/bibletime>, <https://github.com/bibletime/bibletimemobile>
- **Licence:** `GPL-2.0` (via github-api)
- **Reuse mode:** `clean-room-from-documented-behavior` - licence GPL-2.0 is copyleft/restricted; source must NOT be copied - work from documented behaviour only
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
- **Idea:** (idea extraction failed) - 
- **Value here:** 
- **Purpose / criterion mapping:** purpose-only - NOT ACTED ON: model returned an incomplete idea (missing why_valuable) - forced to accept=False. not judged: no strong route available (120 enabled routes in catalog). Pools skipped: cerebras:free-tier (pool cooling down); gemini:free-tier (pool cooling down); groq:free-tier (pool cooling down); local:ollama (pool cooling down); nvidia_nim:free-tier (pool cooling down); openrouter:credits (openrouter:free-tier allowance exhausted (account-wide))
- **Purpose verdict:** REJECTED - NOT ACTED ON: model returned an incomplete idea (missing why_valuable) - forced to accept=False. not judged: no strong route available (120 enabled routes in catalog). Pools skipped: cerebras:free-tier (pool cooling down); gemini:free-tier (pool cooling down); groq:free-tier (pool cooling down); local:ollama (pool cooling down); nvidia_nim:free-tier (pool cooling down); openrouter:credits (openrouter:free-tier allowance exhausted (account-wide))
- **Fix-stream decision:** DID NOT enter the fix stream - idea rejected by the purpose contract
- **Evidence basis:**  (confidence ?)

### robrawks/LogosBibleSoftwareMCP

- **Evidence:** <https://github.com/robrawks/LogosBibleSoftwareMCP>
- **Licence:** `MIT` (via repo-rewards)
- **Reuse mode:** `direct-code-reuse` - licence MIT is permissive and compatible; source may be read and adapted with attribution
- **Idea:** (idea extraction failed) - 
- **Value here:** 
- **Purpose / criterion mapping:** purpose-only - NOT ACTED ON: model returned an incomplete idea (missing why_valuable) - forced to accept=False. not judged: Expecting value: line 1 column 1 (char 0)
- **Purpose verdict:** REJECTED - NOT ACTED ON: model returned an incomplete idea (missing why_valuable) - forced to accept=False. not judged: Expecting value: line 1 column 1 (char 0)
- **Fix-stream decision:** DID NOT enter the fix stream - idea rejected by the purpose contract
- **Evidence basis:**  (confidence ?)

### Accordance Bible Software

- **Evidence:** <https://github.com/Accordance-Bible-Software-Mac/.github>
- **Licence:** `UNKNOWN` (via github-api)
- **Reuse mode:** `reference-only` - licence UNKNOWN could not be verified; record the capability as a reference and copy nothing
- **Idea:** (idea extraction failed) - 
- **Value here:** 
- **Purpose / criterion mapping:** purpose-only - NOT ACTED ON: model returned an incomplete idea (missing why_valuable) - forced to accept=False. not judged: Expecting value: line 1 column 1 (char 0)
- **Purpose verdict:** REJECTED - NOT ACTED ON: model returned an incomplete idea (missing why_valuable) - forced to accept=False. not judged: Expecting value: line 1 column 1 (char 0)
- **Fix-stream decision:** DID NOT enter the fix stream - idea rejected by the purpose contract
- **Evidence basis:**  (confidence ?)

### Accordance-Bible-Software-Mac/.github

- **Evidence:** <https://github.com/Accordance-Bible-Software-Mac/.github>
- **Licence:** `UNKNOWN` (via repo-rewards)
- **Reuse mode:** `reference-only` - licence UNKNOWN could not be verified; record the capability as a reference and copy nothing
- **Idea:** Original Language Search - Enables searching Scripture in Hebrew, Aramaic, and Greek with morphological and lexical analysis tools.
- **Value here:** Would allow pastors to perform exegesis in original languages, directly supporting the program's purpose of preserving exegesis and pastoral judgment in sermon preparation.
- **Purpose / criterion mapping:** acceptance #3. sermon creation - Directly advances the program's purpose of preserving exegesis and pastoral judgment by enabling deeper scriptural analysis in original languages.
- **Purpose verdict:** ACCEPTED - Directly advances the program's purpose of preserving exegesis and pastoral judgment by enabling deeper scriptural analysis in original languages.
- **Fix-stream decision:** DID NOT enter the fix stream - not bridgeable (evidence=verified, reuse_mode=reference-only)
- **Evidence basis:** Competitor description: 'It offers original language search, extensive theological libraries, and seamless synchronization across your Apple devices.' (confidence medium)

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

- review made no progress: three consecutive semantic review batches completed ZERO files (0 of 318 candidate file(s) reviewed all run). This is a provider/route fault, NOT evidence the repo is clean - stopped fail-closed for resumable retry
- rollback failed; working tree requires inspection


## Errors (5)

| # | phase | kind | error | responsible |
|---|---|---|---|---|
| 1 | rotation | program-defect | EgressBlockedError: flexfactor_egress_blocked: payload contains ['password_assignment'] (n | flexfactor.py:1294 |
| 1 | rotation | program-defect | EgressBlockedError: flexfactor_egress_blocked: payload contains ['password_assignment'] (n | flexfactor.py:1294 |
| 3 | rotation | provider | TimeoutError: timed out | flexfactor.py:2755 |
| 4 | rotation | program-defect | EgressBlockedError: flexfactor_egress_blocked: payload contains ['password_assignment'] (n | flexfactor.py:1294 |
| 5 | baseline-gate | program-defect | review made no progress: three consecutive semantic review batches completed ZERO files (0 | - |

Counts by kind: program-defect 4, provider 1

### 1. rotation — program-defect

**Error**

```
EgressBlockedError: flexfactor_egress_blocked: payload contains ['password_assignment'] (near line(s) [1022, 1025, 1083, 1146, 1202]); refusing to send to a cloud model. Re-run with --redact to mask and send, --allow-sensitive to send anyway, or allow categories via FLEXFACTOR_ALLOW_EGRESS / ~/.flexfactor/policy.json {"allow_egress": [...]}.
```

**Responsible code**

- FlexFactor `flexfactor.py:1294` in `_egress_gate()`

```python
raise EgressBlockedError(
```
- Route: `groq/groq/compound`

**Suggested fix** (signature)

The egress gate found a secret/PII pattern in repo-derived text and refused to send it to a cloud model. Remove the secret from the repo (or use --redact / FLEXFACTOR_ALLOW_EGRESS for a known-safe fixture).

### 1. rotation — program-defect

**Error**

```
EgressBlockedError: flexfactor_egress_blocked: payload contains ['password_assignment'] (near line(s) [1022, 1025, 1083, 1146, 1202]); refusing to send to a cloud model. Re-run with --redact to mask and send, --allow-sensitive to send anyway, or allow categories via FLEXFACTOR_ALLOW_EGRESS / ~/.flexfactor/policy.json {"allow_egress": [...]}.
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
- Route: `ollama/gemma4:e4b`

**Suggested fix** (none)

no known fix; start from the responsible code above

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
- Route: `nvidia_nim/zyphra/zamba2-7b-instruct`

**Suggested fix** (signature)

The egress gate found a secret/PII pattern in repo-derived text and refused to send it to a cloud model. Remove the secret from the repo (or use --redact / FLEXFACTOR_ALLOW_EGRESS for a known-safe fixture).

### 5. baseline-gate — program-defect

**Error**

```
review made no progress: three consecutive semantic review batches completed ZERO files (0 of 318 candidate file(s) reviewed all run). This is a provider/route fault, NOT evidence the repo is clean - stopped fail-closed for resumable retry
```

**Responsible code**

- Not attributable to a specific line from the evidence recorded.

**Suggested fix** (model)

model suggestion, unverified: The error indicates a problem with the semantic review provider or its routing, not the repository code itself. The most likely fix involves inspecting the logs of the semantic review provider service, checking network connectivity to the semantic analysis engine, and verifying the health and configuration of that engine to determine why it's failing to process any files. No specific file or line can be named as this is an infrastructure issue.