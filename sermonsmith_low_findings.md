# SermonSmith — low / info findings (12)

_Generated 2026-08-30T08:39:13. These are below the auto-fix bar and were left unchanged on purpose. Review and decide per item._

**Files with low/info issues:** 12

## `apps/web/public/sw.js` (1)
- [ ] line 46 **[low]** (correctness) — **Ignoring Cross-Origin Requests**: The current implementation ignores all fetch requests that do not match the service worker's origin, which may lead to inconsistent behavior when interacting with APIs hosted on different domains. _Suggested fix:_ Consider adding functionality to handle cross-origin requests if needed, or explicitly document that the service worker is limited to same-origin requests only.

## `apps/web/src/Layout.jsx` (1)
- [ ] line 88 **[low]** (performance) — **Multiple DOM Manipulations for Apple Touch Icons**: The addAppleTouchIcon function creates multiple DOM elements for each call, which can be improved to reduce reflows and improve performance. _Suggested fix:_ Check if the link element already exists before creating it, and use a single function implementation to manage icon additions.

## `apps/web/src/components/library/RatingDialog.jsx` (1)
- [ ] line 41 **[low]** (edge-case) — **Potential Undefined Values**: Accessing `existing[0].review_text` and `existing[0].used_in_ministry` without ensuring `existing[0]` is valid could lead to runtime errors in very rare cases where the existing data structure differs from expectations. _Suggested fix:_ Add proper checks to ensure `existing[0]` exists before accessing its properties.

## `apps/web/src/components/plans/SharePlanDialog.jsx` (1)
- [ ] line 26 **[low]** (edge-case) — **Risk of Undefined User Name in Share Payload**: When 'user.full_name' is undefined, the system defaults to using 'user.email', which might not be appropriate for identifying the share creator, especially if an email address is too generic (possible for multiple users). _Suggested fix:_ Consider handling undefined cases for 'user.full_name' to provide a clearer identifier or default to a pseudonym instead of email.

## `apps/web/src/components/reader/AudioPlayer.jsx` (1)
- [ ] line 90 **[low]** (bug) — **Unused State for isGenerating**: The `useState` for `isGenerating` is initialized but never updated, leading to confusion as it seems like it should control asynchronous operations. _Suggested fix:_ Remove `isGenerating` unless future code updates will actually utilize it to handle ongoing operations.

## `apps/web/src/components/resources/TagManager.jsx` (1)
- [ ] line 61 **[low]** (error-handling) — **Silent error logging while loading existing tags**: While fetching existing tags, any error caught is only logged to the console and no user feedback is given, potentially leaving the user unaware of an issue. _Suggested fix:_ Display a toast notification to inform the user that there was an error loading the tags.

## `apps/web/src/pages/BibleMaps.jsx` (1)
- [ ] line 444 **[low]** (correctness) — **Imprecise Search Query Recommendations**: The hardcoded search query strings in `onClick` events of the `Badge` components do not impart informative hints to users about the types of queries and may lead to user ambiguity about expected input. _Suggested fix:_ Consider adding more descriptive tooltips or additional UI elements to guide users in constructing effective queries.

## `apps/web/src/pages/ContactSupport.jsx` (1)
- [ ] line 68 **[low]** (error-handling) — **Lack of User Feedback on Message Loading Failure**: When loading messages in loadMyMessages, the error is logged to the console but no user feedback is provided to inform them of the failure. _Suggested fix:_ Add a user-facing notification (e.g., toast) informing them that the loading of messages has failed, similar to the other error handling in the code.

## `apps/web/src/pages/Home.jsx` (1)
- [ ] line 1093 **[low]** (correctness) — **Improper Closing of Modal**: The button used to close the demo modal may not provide user feedback on whether the action is successful. _Suggested fix:_ Consider providing a visual indication or temporary state change when the Close button is clicked.

## `apps/web/src/pages/Pricing.jsx` (1)
- [ ] line 41 **[low]** (edge-case) — **No feedback for unauthenticated users**: When users who are not authenticated try to upgrade, they receive only a toast notification. However, if the `useAuth` hook doesn't initialize properly, there could be a scenario where this toast is not shown, leading to confusion about the need to log in. _Suggested fix:_ Ensure there's a fallback way to notify users if there's an issue with authentication check or modify the notification logic to handle loading states more clearly.

## `packages/shared/prompts/index.js` (1)
- [ ] line 50 **[low]** (bug) — **Default audienceLabel does not reflect potential edge cases**: The `audienceLabel` is set to default to `AUDIENCE_CONTEXT.general`, but if the `AUDIENCE_CONTEXT` does not contain the appropriate value for some reason, it could lead to unexpected outputs. _Suggested fix:_ Consider implementing a safeguard to verify if the default audienceLabel exists in the AUDIENCE_CONTEXT and handle it appropriately if it doesn't.

## `services/api/src/__tests__/clientErrors.test.js` (1)
- [ ] line 169 **[low]** (correctness) — **Silent Failure on Dropped Payloads**: The code silently drops payloads that do not conform to the expected structure without logging any information, making it difficult to track issues related to malformed requests. _Suggested fix:_ Add logging or a warning mechanism when a garbage payload is detected and dropped.
