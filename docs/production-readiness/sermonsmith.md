# SermonSmith AI — Production Readiness Report

**Program:** SermonSmith AI by Axiom BioLabs  
**Date:** 2026-08-18  
**Source of truth:** `buckeye7066/sermonsmith` default branch `main`  
**Current main SHA:** `969bbb7e3851240bd14a8c5b096e282bcdb2df9c`  
**Deployed app:** https://sermonsmith.vercel.app

This document records evidence. It is not proof that SermonSmith is production ready.

## Current checkpoint (2026-08-18)

Software on `main` includes public routing, verse-wording verification, Terms, account deletion, and Android signed-release workflow configuration through #96/#103/#104/#105.

FlexFactor's false `deps_pinned` fail on nested `apps/web` (workspace lockfile only at repo root) is fixed in FlexFactor `2e15c9c7`. Scoring SermonSmith `main` must not fail production-ready solely because `apps/web` has no local lockfile.

**Status: `SOFTWARE COMPLETE, EXTERNAL RELEASE BLOCKER`.** Not Production Ready.

Remaining owner-ops:

1. Production smoke on the exact deployed SHA: registration → reset → first sermon → pastoral review → PDF → upgrade → cancellation → deletion.
2. Signed Android APK/AAB + certificate checksum published for that SHA (workflow needs the four keystore secrets; do not paste them into chat).
3. Public distribution decision for Android (private GitHub Releases vs store vs granted installer access).
4. Brand/trademark review before substantial paid promotion.
5. Optional: signup email-verification tokens if product wants gated activation.

## Purpose / destination

Pastor-led sermon workspace from passage to review-ready outline while preserving prayer, exegesis, pastoral judgment, denominational context, exact provider-sourced Scripture text, and explicit human review across web, desktop, and mobile.

## Ready criteria (software vs live)

| ID | Software | Live on exact SHA |
| --- | --- | --- |
| 66 Public ungated / private protected | Met in code + tests | Confirm on deployed SHA |
| 67 Provider wording + canon description | Met in code + tests | Confirm provider keys on prod |
| 68 No unsupported claims | Met for audited public + Settings surfaces | Confirm copy on prod |
| 69 Full surface journeys | Not fully met | Owner smoke + Electron/Android RC |

The 2026-08-08/12 implementation notes remain in git history on this path before this checkpoint.
