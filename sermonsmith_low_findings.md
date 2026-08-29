# SermonSmith — low / info findings (12)

_Generated 2026-08-29T10:50:14. These are below the auto-fix bar and were left unchanged on purpose. Review and decide per item._

**Files with low/info issues:** 12

## `apps/web/public/sw.js` (1)
- [ ] line 46 **[low]** (correctness) — **Ignoring Cross-Origin Requests**: The current implementation ignores all fetch requests that do not match the service worker's origin, which may lead to inconsistent behavior when interacting with APIs hosted on different domains. _Suggested fix:_ Consider adding functionality to handle cross-origin requests if needed, or explicitly document that the service worker is limited to same-origin requests only.

## `apps/web/src/Layout.jsx` (1)
- [ ] line 88 **[low]** (performance) — **Multiple DOM Manipulations for Apple Touch Icons**: The addAppleTouchIcon function creates multiple DOM elements for each call, which can be improved to reduce reflows and improve performance. _Suggested fix:_ Check if the link element already exists before creating it, and use a single function implementation to manage icon additions.

## `apps/web/src/components/plans/SharePlanDialog.jsx` (1)
- [ ] line 28 **[low]** (edge-case) — **Potential Undefined Plan Overview**: `plan.plan_overview` may be undefined if `plan` is defined but lacks the `plan_overview` property, causing the API call to carry undefined data. _Suggested fix:_ Add a fallback value for `description`, such as an empty string or a default message.

## `apps/web/src/components/resources/TagManager.jsx` (1)
- [ ] line 61 **[low]** (error-handling) — **Silent error logging while loading existing tags**: While fetching existing tags, any error caught is only logged to the console and no user feedback is given, potentially leaving the user unaware of an issue. _Suggested fix:_ Display a toast notification to inform the user that there was an error loading the tags.

## `apps/web/src/components/sermon/TheologicalExplorer.jsx` (1)
- [ ] line 331 **[low]** (correctness) — **Hardcoded string in alert description**: The alert description for the 'Denominational Perspectives' tab is hardcoded and doesn't reflect the current context of the analysis about denominations, may lead to confusion. _Suggested fix:_ Consider providing a dynamic context-based description instead of a hardcoded string to maintain clarity.

## `apps/web/src/pages/ContactSupport.jsx` (1)
- [ ] line 68 **[low]** (error-handling) — **Lack of User Feedback on Message Loading Failure**: When loading messages in loadMyMessages, the error is logged to the console but no user feedback is provided to inform them of the failure. _Suggested fix:_ Add a user-facing notification (e.g., toast) informing them that the loading of messages has failed, similar to the other error handling in the code.

## `apps/web/src/pages/Home.jsx` (1)
- [ ] line 1093 **[low]** (correctness) — **Improper Closing of Modal**: The button used to close the demo modal may not provide user feedback on whether the action is successful. _Suggested fix:_ Consider providing a visual indication or temporary state change when the Close button is clicked.

## `apps/web/src/pages/MySermons.jsx` (1)
- [ ] line 31 **[low]** (edge-case) — **Initial State of filteredSermons not handled**: The initial state of filteredSermons is set to an empty array, which may cause issues if not properly handled in subsequent operations such as rendering or filtering. There should be validations or checks on expected behaviors when operating on this state. _Suggested fix:_ Ensure that components rendering filteredSermons handle the case where it is an empty array appropriately to prevent potential errors during rendering.

## `apps/web/src/pages/Pricing.jsx` (1)
- [ ] line 41 **[low]** (edge-case) — **No feedback for unauthenticated users**: When users who are not authenticated try to upgrade, they receive only a toast notification. However, if the `useAuth` hook doesn't initialize properly, there could be a scenario where this toast is not shown, leading to confusion about the need to log in. _Suggested fix:_ Ensure there's a fallback way to notify users if there's an issue with authentication check or modify the notification logic to handle loading states more clearly.

## `apps/web/src/pages/WorldviewExplorer.jsx` (1)
- [ ] line 1310 **[low]** (edge-case) — **Not allowing empty notes to be saved**: The button to save notes is disabled if `currentNote.trim()` is false, which is a good check, but users might not realize they need to enter notes. There is no feedback provided on why the button is disabled. _Suggested fix:_ Add a simple tooltip or message indicating that the notes field cannot be empty before saving.

## `packages/shared/prompts/index.js` (1)
- [ ] line 50 **[low]** (bug) — **Default audienceLabel does not reflect potential edge cases**: The `audienceLabel` is set to default to `AUDIENCE_CONTEXT.general`, but if the `AUDIENCE_CONTEXT` does not contain the appropriate value for some reason, it could lead to unexpected outputs. _Suggested fix:_ Consider implementing a safeguard to verify if the default audienceLabel exists in the AUDIENCE_CONTEXT and handle it appropriately if it doesn't.

## `services/api/src/routes/auth.js` (1)
- [ ] line 165 **[low]** (error-handling) — **Uncaught error logging in recordAudit function**: In the recordAudit function, any caught errors during the creation of audit logs do not provide any feedback or logging of their own; this leads to silent failures if the audit log insertion fails, making it hard to track audit trail issues. _Suggested fix:_ Implement error logging inside the catch block for easier tracking of issues regarding audit logging errors.
