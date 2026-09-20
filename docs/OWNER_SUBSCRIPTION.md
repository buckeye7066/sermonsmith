# Owner subscription verification boundaries

The owner route requires the configured ID and email plus the same `admin` or `dev` role predicate used by the API. Customers keep their existing provider route. Owner subscription failures never fall through to a metered API.

## Hosting and request affinity

The owner broker is process-local. Production enrollment is disabled unless `OWNER_AI_API_REPLICAS=1`, and `railway.json` declares one replica in the single `us-west2` region. Keep the service at that topology while this broker is enrolled. Scaling it requires shared durable jobs/leases or routing affinity, not changing the environment assertion alone. Live deployment settings must be checked before enrollment; repository configuration is not proof of a deployed setting.

## Token budgets and receipts

The worker requests the caller's token budget in its task input and rejects/terminates a session when an authoritative token-usage receipt exceeds that budget. The broker independently refuses such a result. No over-budget output is represented as a completed call. This is **verified output-usage enforcement**, not an undocumented provider-side hard generation setting. A provider may report usage only after spending those tokens. Deadline and byte limits remain independent hard safeguards. Actual provider/model/usage metadata is retained; no API billing is inferred from generated text.

## Browser-visible provenance

Successful owner responses expose `X-AI-Billing-Mode`, `X-AI-Provider`, and `X-AI-Model` through CORS. `InvokeLLM` and `StreamLLM` retain their original return types and optionally call `onMetadata` with the validated receipt metadata. Streaming metadata is delivered only after the terminal Scripture/truncation checks pass.

## Private worker installation

The installer protects both the bridge directory and its dedicated Codex home, including existing files, using a protected current-user-only ACL. It refuses directory roots and reparse points. It copies the existing shared API module along with the worker so the installed task does not depend on a disposable Git worktree. Authentication credentials are neither copied into source nor included in the runtime bundle.

The worker's requests use the existing shared API module, with dedicated server worker authentication, HTTPS origin checks, no redirects, request deadlines, and bounded responses. The response limit accommodates the server's permitted prompt after JSON escaping without permitting unbounded input.
