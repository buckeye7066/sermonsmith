# FlexFactor audit — sermonsmith-monorepo

- **Project:** `C:\Users\firer\sermonsmith`
- **Branch:** `main`
- **Toolchains:** java, node
- **Files reviewed:** 0 of 318 candidate(s)
- **FILE ACCOUNTING: 318 candidate(s) = 0 reviewed + 294 never_attempted + 24 review_incomplete**
- **ZERO WORK: not one of 318 candidate file(s) was reviewed. This run did nothing; treat it as a FAILURE, not a clean repo.**
- **Defects found:** 3
- **Files fixed:** 0
- **Errors recorded:** 16 (see the Errors section below; ledger at `C:\Users\firer\.flexfactor\runs\sermonsmith-monorepo-20260826-012300-983864-5432\errors.md`)
- **Baseline build:** passed
- **Unit tests added:** 0 (suite not run)
- **Button/UI (Playwright):** skipped
- **Cycles run:** 1
- **Providers:** rotation:groq/compound-mini
- **Git:** PROVIDER-OUTAGE ABORT on main: checkpoint preserved; no unverified commit created

## System inventory

**962 entries accounted for.**

| Category | Count |
|---|---:|
| artifact-subtree | 9 |
| binary-asset | 69 |
| configuration-documentation-or-data | 342 |
| first-party-source | 542 |

The immutable run manifest contains the complete path-level inventory. Artifact, binary, and reparse entries are named and classified; they are not represented as line-reviewed source.

## Executable evidence

- **Evidence run:** `sermonsmith-monorepo-20260826-012300-983864-5432`
- **Exact final commit:** `4f5d46e69c50b3ea7b5e9a3eec3f19c3b0b4080c`
- **Code map:** 577 file(s), 2978 function(s), 112 route(s), 1206 material control(s)
- **Function execution:** 0/2785 with invocation evidence
- **Route execution:** 0/112
- **Control execution:** 0/1206
- **Changed-file rescan:** 1/1 (complete)
- **Blast radius:** 1 affected file(s); analysis ran
- **Normalized gates:** 5 pass, 2 fail, 2 blocked

- **Blast Radius:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-monorepo-20260826-012300-983864-5432\blast-radius.json`
- **Changed File Rescan:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-monorepo-20260826-012300-983864-5432\changed-file-rescan.json`
- **Code Index:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-monorepo-20260826-012300-983864-5432\code-index.json`
- **Coverage Ledger:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-monorepo-20260826-012300-983864-5432\coverage-ledger.json`
- **Manifest:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-monorepo-20260826-012300-983864-5432\manifest.json`
- **Purpose Graph:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-monorepo-20260826-012300-983864-5432\purpose-graph.json`
- **Quality Gates:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-monorepo-20260826-012300-983864-5432\quality-gates.json`
- **Sarif:** `C:\Users\firer\.flexfactor\evidence\972fd58e1dc96f87\sermonsmith-monorepo-20260826-012300-983864-5432\results.sarif`

## Production readiness

**NOT PRODUCTION READY** — 13/15 evaluated gates passed, 2 blocker(s).

Full scorecard: `C:\Users\firer\sermonsmith\sermonsmith-monorepo_readiness.md`

- **Test suite passes** [high] — tests were not run
  - Fix: Run the suite and fix failures.
- **Dependencies are lock-pinned** [high] — no lockfile: java:apps/mobile/android
  - Fix: Commit the lockfile so builds are reproducible.

## Competitor research

**Coverage:** ONLY 4 of the target 5 competitors could be corroborated from a reachable source. This is a coverage SHORTFALL, not evidence that fewer competitors exist.

- **Sources used:** web:duckduckgo, repo-rewards
- **Repo Rewards endpoint:** `https://web-production-d7db7.up.railway.app`
- **Sources SKIPPED (named, not silent):**
  - `idea:amenify214/my-mvp-project` - model returned an incomplete idea (missing why_valuable) - forced to accept=False for amenify214/my-mvp-project
  - `idea:digitalingenieur/contao-sermoner` - model returned an incomplete idea (missing why_valuable) - forced to accept=False for digitalingenieur/contao-sermoner
  - `model-discovery` - JSONDecodeError: Expecting value: line 1 column 1 (char 0)
  - `web:searxng` - RuntimeError: FLEXFACTOR_SEARXNG_URL is not set

- **Ideas accepted as serving this program's purpose:** 0 (rejected 4 - the purpose contract, not the competitor, decides)

- **Bridged into the fix stream:** 0 of 4 candidate(s)
  - NOT bridged (4): amenify214/my-mvp-project, digitalingenieur/contao-sermoner, mailekah/churchweb, praisenter/praisenter - idea rejected by the purpose contract

| Competitor | Kind | Licence | Reuse mode | Purpose mapping | Verdict | Fix stream | Adoptable idea |
|---|---|---|---|---|---|---|---|
| [praisenter/praisenter](https://github.com/praisenter/praisenter) | oss | `BSD-3-Clause` | `direct-code-reuse` | purpose-only | reject | NOT entered - idea rejected by the purpose contract | Dual-screen presentation mode for live worship |
| [mailekah/churchweb](https://github.com/mailekah/churchweb) | oss | `NOASSERTION` | `reference-only` | purpose-only | reject | NOT entered - idea rejected by the purpose contract | Church Directory Management |
| [digitalingenieur/contao-sermoner](https://github.com/digitalingenieur/contao-sermoner) | oss | `UNKNOWN` | `reference-only` | purpose-only | reject | NOT entered - idea rejected by the purpose contract | (idea extraction failed) |
| [amenify214/my-mvp-project](https://github.com/amenify214/my-mvp-project) | oss | `UNKNOWN` | `reference-only` | purpose-only | reject | NOT entered - idea rejected by the purpose contract | (idea extraction failed) |

### praisenter/praisenter

- **Evidence:** <https://github.com/praisenter/praisenter>
- **Licence:** `BSD-3-Clause` (via repo-rewards)
- **Reuse mode:** `direct-code-reuse` - licence BSD-3-Clause is permissive and compatible; source may be read and adapted with attribution
- **Idea:** Dual-screen presentation mode for live worship - Allows users to display sermon slides, scripture, and media on an external projector while showing presenter notes and controls on a local screen.
- **Value here:** Would enable pastors to use SermonSmith directly during worship services, eliminating need for separate presentation software and streamlining the passage-to-delivery workflow.
- **Purpose / criterion mapping:** purpose-only - SermonSmith's stated purpose is sermon preparation workspace, not live presentation/display; adding presentation mode extends beyond its core job of creating review-ready outlines.
- **Purpose verdict:** REJECTED - SermonSmith's stated purpose is sermon preparation workspace, not live presentation/display; adding presentation mode extends beyond its core job of creating review-ready outlines.
- **Fix-stream decision:** DID NOT enter the fix stream - idea rejected by the purpose contract
- **Evidence basis:** Competitor repository described as 'Free Church Presentation Software' (https://github.com/praisenter/praisenter), indicating it provides presentation/display capabilities. (confidence medium)

### mailekah/churchweb

- **Evidence:** <https://github.com/mailekah/churchweb>
- **Licence:** `NOASSERTION` (via repo-rewards)
- **Reuse mode:** `reference-only` - licence NOASSERTION could not be verified; record the capability as a reference and copy nothing
- **Idea:** Church Directory Management - Provides a searchable, editable directory of congregation members with profiles, contact info, and groups.
- **Value here:** Would let pastors manage flock data inside the sermon workspace, reducing context-switching and supporting pastoral care.
- **Purpose / criterion mapping:** purpose-only - Adding a directory extends beyond the sermon‑creation workspace purpose; it does not advance passage‑to‑outline workflow, exegesis, or review‑ready outline.
- **Purpose verdict:** REJECTED - Adding a directory extends beyond the sermon‑creation workspace purpose; it does not advance passage‑to‑outline workflow, exegesis, or review‑ready outline.
- **Fix-stream decision:** DID NOT enter the fix stream - idea rejected by the purpose contract
- **Evidence basis:** Competitor description: 'Packaged online apps for churches including: a website, a church directory, a worship planner, and a content management system.' (confidence low)

### digitalingenieur/contao-sermoner

- **Evidence:** <https://github.com/digitalingenieur/contao-sermoner>
- **Licence:** `UNKNOWN` (via repo-rewards)
- **Reuse mode:** `reference-only` - licence UNKNOWN could not be verified; record the capability as a reference and copy nothing
- **Idea:** (idea extraction failed) - 
- **Value here:** 
- **Purpose / criterion mapping:** purpose-only - NOT ACTED ON: model returned an incomplete idea (missing why_valuable) - forced to accept=False. not judged: Expecting value: line 1 column 1 (char 0)
- **Purpose verdict:** REJECTED - NOT ACTED ON: model returned an incomplete idea (missing why_valuable) - forced to accept=False. not judged: Expecting value: line 1 column 1 (char 0)
- **Fix-stream decision:** DID NOT enter the fix stream - idea rejected by the purpose contract
- **Evidence basis:**  (confidence ?)

### amenify214/my-mvp-project

- **Evidence:** <https://github.com/amenify214/my-mvp-project>
- **Licence:** `UNKNOWN` (via repo-rewards)
- **Reuse mode:** `reference-only` - licence UNKNOWN could not be verified; record the capability as a reference and copy nothing
- **Idea:** (idea extraction failed) - 
- **Value here:** 
- **Purpose / criterion mapping:** purpose-only - NOT ACTED ON: model returned an incomplete idea (missing why_valuable) - forced to accept=False. not judged: Expecting value: line 1 column 1 (char 0)
- **Purpose verdict:** REJECTED - NOT ACTED ON: model returned an incomplete idea (missing why_valuable) - forced to accept=False. not judged: Expecting value: line 1 column 1 (char 0)
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
- `(purpose)` line 0 (quality-gate) - **Purpose assessment evidence is incomplete**: baseline purpose assessment incomplete: 1/3 sample(s) usable; EgressBlockedError: flexfactor_egress_blocked: payload contains ['password_assignment'] (near line(s) [1018, 1021, 1079, 1142, 1198]); refusing to send to a cloud model. Re-run with --redact to mask and send, --allow-sensitive to send anyway, or allow categories via FLEXFACTOR_ALLOW_EGRESS / ~/.flexfactor/policy.json {"allow_egress": [...]}.; EgressBlockedError: flexfactor_egress_blocked: payload contains ['password_assignment'] (near line(s) [1018, 1021, 1079, 1142, 1198]); refusing to send to a cloud model. Re-run with --redact to mask and send, --allow-sensitive to send anyway, or allow categories via FLEXFACTOR_ALLOW_EGRESS / ~/.flexfactor/policy.json {"allow_egress": [...]}.; final purpose assessment returned no usable result _Suggested fix:_ Retry the resumable run after restoring a responsive provider.

## Defects by file

_No defects found in the reviewed files._

## Fix notes / left unfixed

- review made no progress: three consecutive semantic review batches completed ZERO files (0 of 318 candidate file(s) reviewed all run). This is a provider/route fault, NOT evidence the repo is clean - stopped fail-closed for resumable retry
- rollback failed; working tree requires inspection


## Errors (16)

| # | phase | kind | error | responsible |
|---|---|---|---|---|
| 1 | rotation | program-defect | EgressBlockedError: flexfactor_egress_blocked: payload contains ['password_assignment'] (n | flexfactor.py:1294 |
| 2 | rotation | program-defect | EgressBlockedError: flexfactor_egress_blocked: payload contains ['password_assignment'] (n | flexfactor.py:1294 |
| 3 | rotation | provider | PermissionDeniedError: Error code: 403 - {'error': {'message': 'thinkingmachines/inkling:f | flexfactor.py:2412 |
| 4 | rotation | provider | PermissionDeniedError: Error code: 403 - {'error': {'message': 'thinkingmachines/inkling-s | flexfactor.py:2412 |
| 5 | rotation | provider | JSONDecodeError: Expecting value: line 2 column 1 (char 1) | flexfactor.py:2563 |
| 6 | rotation | provider | JSONDecodeError: Expecting value: line 1 column 1 (char 0) | flexfactor.py:2563 |
| 7 | rotation | provider | TimeoutError: timed out | flexfactor.py:2755 |
| 8 | rotation | provider | TimeoutError: timed out | flexfactor.py:2755 |
| 9 | rotation | provider | TimeoutError: timed out | flexfactor.py:2755 |
| 10 | rotation | provider | TimeoutError: timed out | flexfactor.py:2755 |
| 11 | rotation | provider | TimeoutError: timed out | flexfactor.py:2755 |
| 12 | rotation | provider | TimeoutError: timed out | flexfactor.py:2755 |
| 13 | rotation | provider | TimeoutError: timed out | flexfactor.py:2755 |
| 14 | rotation | provider | TimeoutError: timed out | flexfactor.py:2755 |
| 15 | rotation | provider | APIStatusError: Error code: 410 - {'type': 'about:blank', 'title': 'Gone', 'status': 410,  | flexfactor.py:2412 |
| 16 | baseline-gate | program-defect | review made no progress: three consecutive semantic review batches completed ZERO files (0 | - |

Counts by kind: program-defect 3, provider 13

### 1. rotation — program-defect

**Error**

```
EgressBlockedError: flexfactor_egress_blocked: payload contains ['password_assignment'] (near line(s) [1018, 1021, 1079, 1142, 1198]); refusing to send to a cloud model. Re-run with --redact to mask and send, --allow-sensitive to send anyway, or allow categories via FLEXFACTOR_ALLOW_EGRESS / ~/.flexfactor/policy.json {"allow_egress": [...]}.
```

**Responsible code**

- FlexFactor `flexfactor.py:1294` in `_egress_gate()`

```python
raise EgressBlockedError(
```
- Route: `openrouter/minimax/minimax-m3:free`

**Suggested fix** (signature)

The egress gate found a secret/PII pattern in repo-derived text and refused to send it to a cloud model. Remove the secret from the repo (or use --redact / FLEXFACTOR_ALLOW_EGRESS for a known-safe fixture).

### 2. rotation — program-defect

**Error**

```
EgressBlockedError: flexfactor_egress_blocked: payload contains ['password_assignment'] (near line(s) [1018, 1021, 1079, 1142, 1198]); refusing to send to a cloud model. Re-run with --redact to mask and send, --allow-sensitive to send anyway, or allow categories via FLEXFACTOR_ALLOW_EGRESS / ~/.flexfactor/policy.json {"allow_egress": [...]}.
```

**Responsible code**

- FlexFactor `flexfactor.py:1294` in `_egress_gate()`

```python
raise EgressBlockedError(
```
- Route: `openrouter/minimax/minimax-m2.7:free`

**Suggested fix** (signature)

The egress gate found a secret/PII pattern in repo-derived text and refused to send it to a cloud model. Remove the secret from the repo (or use --redact / FLEXFACTOR_ALLOW_EGRESS for a known-safe fixture).

### 3. rotation — provider

**Error**

```
PermissionDeniedError: Error code: 403 - {'error': {'message': 'thinkingmachines/inkling:free is only available on agentic harnesses. Try plugging it into a coding agent or productivity app listed on https://openrouter.ai/apps', 'code': 403}}
```

**Responsible code**

- FlexFactor `flexfactor.py:2412` in `_chat_create()`

```python
return client.chat.completions.create(**kwargs)
```
- Route: `openrouter/thinkingmachines/inkling:free`

**Suggested fix** (signature)

This route is gated or not permitted for the key in use. Rotation skips it after strikes; to stop retrying it, exclude it (FLEXFACTOR_ROTATION_EXCLUDE=<fragment>) or have AI Time's catalog mark it disabled.

### 4. rotation — provider

**Error**

```
PermissionDeniedError: Error code: 403 - {'error': {'message': 'thinkingmachines/inkling-small:free is only available on agentic harnesses. Try plugging it into a coding agent or productivity app listed on https://openrouter.ai/apps', 'code': 403}}
```

**Responsible code**

- FlexFactor `flexfactor.py:2412` in `_chat_create()`

```python
return client.chat.completions.create(**kwargs)
```
- Route: `openrouter/thinkingmachines/inkling-small:free`

**Suggested fix** (signature)

This route is gated or not permitted for the key in use. Rotation skips it after strikes; to stop retrying it, exclude it (FLEXFACTOR_ROTATION_EXCLUDE=<fragment>) or have AI Time's catalog mark it disabled.

### 5. rotation — provider

**Error**

```
JSONDecodeError: Expecting value: line 2 column 1 (char 1)
```

**Responsible code**

- FlexFactor `flexfactor.py:2563` in `structured()`

```python
data = json.loads(text)
```
- Route: `openrouter/minimax/minimax-m2.7:free`

**Suggested fix** (none)

no known fix; start from the responsible code above

### 6. rotation — provider

**Error**

```
JSONDecodeError: Expecting value: line 1 column 1 (char 0)
```

**Responsible code**

- FlexFactor `flexfactor.py:2563` in `structured()`

```python
data = json.loads(text)
```
- Route: `openrouter/minimax/minimax-m3:free`

**Suggested fix** (none)

no known fix; start from the responsible code above

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
- Route: `ollama/qwen2.5-coder:7b`

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
- Route: `ollama/gemma4:26b`

**Suggested fix** (none)

no known fix; start from the responsible code above

### 9. rotation — provider

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

### 10. rotation — provider

**Error**

```
TimeoutError: timed out
```

**Responsible code**

- FlexFactor `flexfactor.py:2755` in `_chat()`

```python
with self._opener.open(req, timeout=_ollama_http_timeout()) as resp:
```
- Route: `ollama/gemma4:26b`

**Suggested fix** (none)

no known fix; start from the responsible code above

### 11. rotation — provider

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

### 12. rotation — provider

**Error**

```
TimeoutError: timed out
```

**Responsible code**

- FlexFactor `flexfactor.py:2755` in `_chat()`

```python
with self._opener.open(req, timeout=_ollama_http_timeout()) as resp:
```
- Route: `ollama/qwen2.5-coder:7b`

**Suggested fix** (none)

no known fix; start from the responsible code above

### 13. rotation — provider

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

### 14. rotation — provider

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

### 15. rotation — provider

**Error**

```
APIStatusError: Error code: 410 - {'type': 'about:blank', 'title': 'Gone', 'status': 410, 'detail': "The model 'nvidia/nvidia-nemotron-nano-9b-v2' has reached its end of life on 2026-08-26T09:00:00Z and is no longer available."}
```

**Responsible code**

- FlexFactor `flexfactor.py:2412` in `_chat_create()`

```python
return client.chat.completions.create(**kwargs)
```
- Route: `nvidia_nim/nvidia/nvidia-nemotron-nano-9b-v2`

**Suggested fix** (none)

no known fix; start from the responsible code above

### 16. baseline-gate — program-defect

**Error**

```
review made no progress: three consecutive semantic review batches completed ZERO files (0 of 318 candidate file(s) reviewed all run). This is a provider/route fault, NOT evidence the repo is clean - stopped fail-closed for resumable retry
```

**Responsible code**

- Not attributable to a specific line from the evidence recorded.

**Suggested fix** (model)

model suggestion, unverified: The error message does not include any stack trace, file name, or line number indicating where the failure occurred. To propose a concrete fix, we need the relevant log output or code location (e.g., the provider/route implementation file and the line where the batch processing loop aborts). Please provide that missing diagnostic information.