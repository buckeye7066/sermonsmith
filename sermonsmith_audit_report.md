# FlexFactor audit — SermonSmith

- **Project:** `C:\Users\firer\sermonsmith`
- **Branch:** `main`
- **Toolchains:** java, node
- **Files reviewed:** 0 of 318 candidate(s)
- **FILE ACCOUNTING: 318 candidate(s) = 0 reviewed + 294 never_attempted + 24 review_incomplete**
- **ZERO WORK: not one of 318 candidate file(s) was reviewed. This run did nothing; treat it as a FAILURE, not a clean repo.**
- **Defects found:** 3
- **Files fixed:** 0
- **Errors recorded:** 11 (see the Errors section below; ledger at `C:\Users\firer\.flexfactor\runs\sermonsmith-20260827-011439-177584-19352\errors.md`)
- **Baseline build:** passed
- **Unit tests added:** 0 (suite not run)
- **Button/UI (Playwright):** skipped
- **Cycles run:** 1
- **Providers:** rotation:groq/compound-mini
- **Git:** PROVIDER-OUTAGE ABORT on main: checkpoint preserved; no unverified commit created

## System inventory

**970 entries accounted for.**

| Category | Count |
|---|---:|
| artifact-subtree | 9 |
| binary-asset | 69 |
| configuration-documentation-or-data | 350 |
| first-party-source | 542 |

The immutable run manifest contains the complete path-level inventory. Artifact, binary, and reparse entries are named and classified; they are not represented as line-reviewed source.

## Executable evidence

- **Evidence run:** `sermonsmith-20260827-011439-177584-19352`
- **Exact final commit:** `fb717c023f2c7f9dc9b3291eb9bb56625e41f0f8`
- **Code map:** 583 file(s), 2978 function(s), 112 route(s), 1206 material control(s)
- **Function execution:** 0/2785 with invocation evidence
- **Route execution:** 0/112
- **Control execution:** 0/1206
- **Changed-file rescan:** 1/1 (complete)
- **Blast radius:** 1 affected file(s); analysis ran
- **Normalized gates:** 5 pass, 2 fail, 2 blocked

- **Blast Radius:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-20260827-011439-177584-19352\blast-radius.json`
- **Changed File Rescan:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-20260827-011439-177584-19352\changed-file-rescan.json`
- **Code Index:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-20260827-011439-177584-19352\code-index.json`
- **Coverage Ledger:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-20260827-011439-177584-19352\coverage-ledger.json`
- **Manifest:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-20260827-011439-177584-19352\manifest.json`
- **Purpose Graph:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-20260827-011439-177584-19352\purpose-graph.json`
- **Quality Gates:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-20260827-011439-177584-19352\quality-gates.json`
- **Sarif:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-20260827-011439-177584-19352\results.sarif`

## Production readiness

**NOT PRODUCTION READY** — 13/15 evaluated gates passed, 2 blocker(s).

Full scorecard: `C:\Users\firer\sermonsmith\sermonsmith_readiness.md`

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
  - `idea:darinfranklin/AutomationForAccordance` - model returned an incomplete idea (missing why_valuable) - forced to accept=False for darinfranklin/AutomationForAccordance
  - `idea:tonny-kohar/alkitab-suite` - model returned an incomplete idea (missing why_valuable) - forced to accept=False for tonny-kohar/alkitab-suite
  - `web:searxng` - RuntimeError: FLEXFACTOR_SEARXNG_URL is not set

- **Ideas accepted as serving this program's purpose:** 2 (rejected 3 - the purpose contract, not the competitor, decides)

- **Bridged into the fix stream:** 0 of 5 candidate(s)
  - NOT bridged (3): BibleTime, darinfranklin/AutomationForAccordance, tonny-kohar/alkitab-suite - idea rejected by the purpose contract
  - NOT bridged (2): STEP Bible, digitalingenieur/contao-sermoner - not bridgeable (evidence=verified, reuse_mode=reference-only)

| Competitor | Kind | Licence | Reuse mode | Purpose mapping | Verdict | Fix stream | Adoptable idea |
|---|---|---|---|---|---|---|---|
| [BibleTime](https://github.com/bibletime/bibletime) | oss | `GPL-2.0` | `clean-room-from-documented-behavior` | purpose-only | reject | NOT entered - idea rejected by the purpose contract | (idea extraction failed) |
| [STEP Bible](https://github.com/STEPBible/STEPBible-Data) | oss | `UNKNOWN` | `reference-only` | acceptance #4. provider wording verification actually available in the user flow | ACCEPT | NOT entered - not bridgeable (evidence=verified, reuse_mode=reference-only) | Provider-attributed immutable verse wording verification |
| [tonny-kohar/alkitab-suite](https://github.com/tonny-kohar/alkitab-suite) | oss | `NOASSERTION` | `reference-only` | purpose-only | reject | NOT entered - idea rejected by the purpose contract | (idea extraction failed) |
| [darinfranklin/AutomationForAccordance](https://github.com/darinfranklin/AutomationForAccordance) | oss | `MIT` | `direct-code-reuse` | purpose-only | reject | NOT entered - idea rejected by the purpose contract | (idea extraction failed) |
| [digitalingenieur/contao-sermoner](https://github.com/digitalingenieur/contao-sermoner) | oss | `UNKNOWN` | `reference-only` | acceptance #3. sermon creation | ACCEPT | NOT entered - not bridgeable (evidence=verified, reuse_mode=reference-only) | Agent Mesh |

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

### STEP Bible

- **Evidence:** <https://github.com/STEPBible/STEPBible-Data>
- **Licence:** `UNKNOWN` (via github-api)
- **Reuse mode:** `reference-only` - licence UNKNOWN could not be verified; record the capability as a reference and copy nothing
- **Idea:** Provider-attributed immutable verse wording verification - STEP Bible exposes scripture data with explicit provider attribution and versioned exact wording that can be verified against the original publisher source.
- **Value here:** SermonSmith must preserve exact provider-sourced Scripture text and make provider wording verification available in the user flow; explicit source-attributed immutable verse wording closes the gap between current state and authored purpose and acceptance criterion 4.
- **Purpose / criterion mapping:** acceptance #4. provider wording verification actually available in the user flow - Advances the authored purpose of a pastor-led sermon workspace that preserves exact provider-sourced Scripture text and explicit human review, and serves acceptance criterion 4.
- **Purpose verdict:** ACCEPTED - Advances the authored purpose of a pastor-led sermon workspace that preserves exact provider-sourced Scripture text and explicit human review, and serves acceptance criterion 4.
- **Fix-stream decision:** DID NOT enter the fix stream - not bridgeable (evidence=verified, reuse_mode=reference-only)
- **Evidence basis:** Competitor repo description: Data created for www.STEPBible.org, available to other projects under CC BY 4.0; DuckDuckGo search evidence for https://github.com/STEPBible/STEPBible-Data. (confidence low)

### tonny-kohar/alkitab-suite

- **Evidence:** <https://github.com/tonny-kohar/alkitab-suite>
- **Licence:** `NOASSERTION` (via repo-rewards)
- **Reuse mode:** `reference-only` - licence NOASSERTION could not be verified; record the capability as a reference and copy nothing
- **Idea:** (idea extraction failed) - 
- **Value here:** 
- **Purpose / criterion mapping:** purpose-only - NOT ACTED ON: model returned an incomplete idea (missing why_valuable) - forced to accept=False. not judged: Expecting value: line 1 column 1 (char 0)
- **Purpose verdict:** REJECTED - NOT ACTED ON: model returned an incomplete idea (missing why_valuable) - forced to accept=False. not judged: Expecting value: line 1 column 1 (char 0)
- **Fix-stream decision:** DID NOT enter the fix stream - idea rejected by the purpose contract
- **Evidence basis:**  (confidence ?)

### darinfranklin/AutomationForAccordance

- **Evidence:** <https://github.com/darinfranklin/AutomationForAccordance>
- **Licence:** `MIT` (via repo-rewards)
- **Reuse mode:** `direct-code-reuse` - licence MIT is permissive and compatible; source may be read and adapted with attribution
- **Idea:** (idea extraction failed) - 
- **Value here:** 
- **Purpose / criterion mapping:** purpose-only - NOT ACTED ON: model returned an incomplete idea (missing why_valuable) - forced to accept=False. not judged: Expecting value: line 1 column 1 (char 0)
- **Purpose verdict:** REJECTED - NOT ACTED ON: model returned an incomplete idea (missing why_valuable) - forced to accept=False. not judged: Expecting value: line 1 column 1 (char 0)
- **Fix-stream decision:** DID NOT enter the fix stream - idea rejected by the purpose contract
- **Evidence basis:**  (confidence ?)

### digitalingenieur/contao-sermoner

- **Evidence:** <https://github.com/digitalingenieur/contao-sermoner>
- **Licence:** `UNKNOWN` (via repo-rewards)
- **Reuse mode:** `reference-only` - licence UNKNOWN could not be verified; record the capability as a reference and copy nothing
- **Idea:** Agent Mesh - Provides a framework for integrating multiple AI agents and services, allowing for more complex and dynamic interactions between them.
- **Value here:** Enabling the integration of multiple AI agents and services would allow SermonSmith to provide more comprehensive and accurate sermon preparation and Bible study tools, enhancing the overall user experience.
- **Purpose / criterion mapping:** acceptance #3. sermon creation - The integration of multiple AI agents and services aligns with SermonSmith's purpose of providing a comprehensive sermon preparation and Bible study application, and would help to advance the program's authored purpose.
- **Purpose verdict:** ACCEPTED - The integration of multiple AI agents and services aligns with SermonSmith's purpose of providing a comprehensive sermon preparation and Bible study application, and would help to advance the program's authored purpose.
- **Fix-stream decision:** DID NOT enter the fix stream - not bridgeable (evidence=verified, reuse_mode=reference-only)
- **Evidence basis:** services/api/src/services/agentMesh.js (confidence medium)

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


## Errors (11)

| # | phase | kind | error | responsible |
|---|---|---|---|---|
| 1 | rotation | program-defect | EgressBlockedError: flexfactor_egress_blocked: payload contains ['password_assignment'] (n | flexfactor.py:1294 |
| 2 | rotation | provider | TimeoutError: timed out | flexfactor.py:2755 |
| 3 | rotation | provider | TimeoutError: timed out | flexfactor.py:2755 |
| 4 | rotation | program-defect | EgressBlockedError: flexfactor_egress_blocked: payload contains ['password_assignment'] (n | flexfactor.py:1294 |
| 5 | rotation | provider | TimeoutError: timed out | flexfactor.py:2755 |
| 6 | rotation | program-defect | EgressBlockedError: flexfactor_egress_blocked: payload contains ['password_assignment'] (n | flexfactor.py:1294 |
| 7 | rotation | provider | TimeoutError: timed out | flexfactor.py:2755 |
| 8 | rotation | provider | NotFoundError: Error code: 404 - {'status': 404, 'title': 'Not Found', 'detail': "Function | flexfactor.py:2412 |
| 9 | rotation | provider | NotFoundError: Error code: 404 - {'status': 404, 'title': 'Not Found', 'detail': "Function | flexfactor.py:2412 |
| 10 | rotation | budget | RateLimitError: Error code: 429 - [{'error': {'code': 429, 'message': 'You exceeded your c | flexfactor.py:2412 |
| 11 | baseline-gate | program-defect | review made no progress: three consecutive semantic review batches completed ZERO files (0 | - |

Counts by kind: budget 1, program-defect 4, provider 6

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
- Route: `gemini/gemini-3.7-flash`

**Suggested fix** (signature)

The egress gate found a secret/PII pattern in repo-derived text and refused to send it to a cloud model. Remove the secret from the repo (or use --redact / FLEXFACTOR_ALLOW_EGRESS for a known-safe fixture).

### 2. rotation — provider

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
- Route: `ollama/mistral:latest`

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
- Route: `groq/allam-2-7b`

**Suggested fix** (signature)

The egress gate found a secret/PII pattern in repo-derived text and refused to send it to a cloud model. Remove the secret from the repo (or use --redact / FLEXFACTOR_ALLOW_EGRESS for a known-safe fixture).

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
EgressBlockedError: flexfactor_egress_blocked: payload contains ['password_assignment'] (near line(s) [1022, 1025, 1083, 1146, 1202]); refusing to send to a cloud model. Re-run with --redact to mask and send, --allow-sensitive to send anyway, or allow categories via FLEXFACTOR_ALLOW_EGRESS / ~/.flexfactor/policy.json {"allow_egress": [...]}.
```

**Responsible code**

- FlexFactor `flexfactor.py:1294` in `_egress_gate()`

```python
raise EgressBlockedError(
```
- Route: `groq/allam-2-7b`

**Suggested fix** (signature)

The egress gate found a secret/PII pattern in repo-derived text and refused to send it to a cloud model. Remove the secret from the repo (or use --redact / FLEXFACTOR_ALLOW_EGRESS for a known-safe fixture).

### 7. rotation — provider

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

### 8. rotation — provider

**Error**

```
NotFoundError: Error code: 404 - {'status': 404, 'title': 'Not Found', 'detail': "Function '6497fc2b-7ff8-4019-8946-123dccbfc863': Not found for account 'hvux_0rjHS6OiBfWXcZvKgoOaUBy_3UsQqq6I6IAz7I'"}
```

**Responsible code**

- FlexFactor `flexfactor.py:2412` in `_chat_create()`

```python
return client.chat.completions.create(**kwargs)
```
- Route: `nvidia_nim/ai21labs/jamba-1.5-large-instruct`

**Suggested fix** (none)

no known fix; start from the responsible code above

### 9. rotation — provider

**Error**

```
NotFoundError: Error code: 404 - {'status': 404, 'title': 'Not Found', 'detail': "Function 'e2d298c5-204e-4213-b921-9f492cc9011b': Not found for account 'hvux_0rjHS6OiBfWXcZvKgoOaUBy_3UsQqq6I6IAz7I'"}
```

**Responsible code**

- FlexFactor `flexfactor.py:2412` in `_chat_create()`

```python
return client.chat.completions.create(**kwargs)
```
- Route: `nvidia_nim/google/codegemma-1.1-7b`

**Suggested fix** (none)

no known fix; start from the responsible code above

### 10. rotation — budget

**Error**

```
RateLimitError: Error code: 429 - [{'error': {'code': 429, 'message': 'You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits. To monitor your current usage, head to: https://ai.dev/rate-limit. \n* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_input_token_count, limit: 0, model: gemini-3.1-pro\n* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_input_token_count, limit: 0, model: gemini-3.1-pro\n* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 0, model: gemini-3.1-pro\n* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 0, model: gemini-3.1-pro\nPlease retry in 54.996894211s.', 'status': 'RESOURCE_EXHAUSTED', 'details': [{'@type': 'type.googleapis.com/google.rpc.Help', 'links': [{'description': 'Learn more about Gemini API quotas', 'url': 'https://ai.google.dev/gemini-api/docs/rate-limits'}]}, {'@type': 'type.googleapis.com/google.rpc.QuotaFailure', 'violations': [{'quotaMetric': 'generativelanguage.googleapis.com/generate_content_free_tier_input_token_count', 'quotaId': 'GenerateContentInputTokensPerModelPerDay-FreeTier', 'quotaDimensions': {'location': 'global', 'model': 'gemini-3.1-pro'}}, {'quotaMetric': 'generativelanguage.googleapis.com/generate_content_free_tier_input_token_count', 'quotaId': 'GenerateContentInputTokensPerModelPerMinute-FreeTier', 'quotaDimensions': {'location': 'global', 'model': 'gemini-3.1-pro'}}, {'quotaMetric': 'generativelanguage.googleapis.com/generate_content_free_tier_requests', 'quotaId': 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier', 'quotaDimensions': {'location': 'global', 'model': 'gemini-3.1-pro'}}, {'quotaMetric': 'generativelanguage.googleapis.com/generate_content_free_tier_requests', 'quotaId': 'GenerateRequest
```

**Responsible code**

- FlexFactor `flexfactor.py:2412` in `_chat_create()`

```python
return client.chat.completions.create(**kwargs)
```
- Route: `gemini/gemini-3.1-pro-preview`

**Suggested fix** (signature)

The account's FREE DAILY allowance for that backend is spent - one allowance, however many models the catalog lists under it. FlexFactor now benches the whole allowance until the reset the provider named (X-RateLimit-Reset) instead of re-testing it every 60s, and the run continues on other backends. It returns by itself at the daily reset; do not add paid credit to compensate. If a run must not depend on it, point the run at a backend with headroom rather than waiting.

### 11. baseline-gate — program-defect

**Error**

```
review made no progress: three consecutive semantic review batches completed ZERO files (0 of 318 candidate file(s) reviewed all run). This is a provider/route fault, NOT evidence the repo is clean - stopped fail-closed for resumable retry
```

**Responsible code**

- Not attributable to a specific line from the evidence recorded.

**Suggested fix** (model)

model suggestion, unverified: The error report provides no file name, line number, or stack trace indicating where the semantic review batching logic resides. To propose a concrete fix we need the relevant source file (e.g., the module that schedules review batches) and the specific line(s) where the batch progress is checked or updated.