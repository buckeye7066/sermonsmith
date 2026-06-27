# AI Guardrails

SermonSmith treats AI output as assistance, not authority. The backend enforces cost, shape, and audit controls; the frontend should still present generated content as review-required.

## Backend Controls

- Model allowlists are enforced by account tier in `services/api/src/routes/ai.js`.
- Token and prompt-size caps prevent unbounded spend.
- Daily usage counters are persisted in `AiUsage`.
- Structured-output prompts append a JSON-only instruction and return HTTP 502 if the model returns invalid JSON.
- AI audit rows are written to `AiAuditLog` with hashes, token estimates, duration, status, and failure type.

## Audit Privacy

The audit log deliberately does not store prompt text, system prompts, generated responses, or image URLs as raw values. It stores SHA-256 hashes so operators can correlate repeated requests without reading user content.

## Recommended UI Behavior

- Display generated sermon, study, and prayer content as drafts.
- Require explicit user save/publish action.
- Preserve scripture references supplied by the model and encourage manual verification.
- Surface retryable structured-output failures as "AI returned invalid JSON. Please retry."

## Operator Dashboard Inputs

An admin dashboard can safely aggregate:

- count by `feature`
- count by `model`
- count by `status`
- `tokenEstimate` sum by day
- p50/p95 `durationMs`
- failure types by day

Do not display raw prompts or responses unless a separate, explicit user-consented diagnostic channel is built.
