# SermonSmith — low / info findings (19)

_Generated 2026-08-29T18:03:16. These are below the auto-fix bar and were left unchanged on purpose. Review and decide per item._

**Files with low/info issues:** 17

## `apps/mobile/android/app/capacitor.build.gradle` (2)
- [ ] line 10 **[low]** (dead-code) — **Unused plugin Import in Dependencies**: The project imports plugins (capacitor-local-notifications, capacitor-splash-screen, etc.) in the dependencies block, but there is no indication in this snippet of how or if these are utilized, which may indicate unnecessary bloat. _Suggested fix:_ Confirm that these dependencies are actively used in the application; if not, remove them from the dependencies block.
- [ ] line 20 **[low]** (dead-code) — **Conditional Post-Build Script Execution**: The block of code that checks for 'postBuildExtras' and calls it seems somewhat unnecessary unless postBuildExtras() is actively being defined and utilized in the build process, leading to confusion regarding its necessity. _Suggested fix:_ Review the necessity of postBuildExtras and remove this condition if it is not being utilized anywhere in the build process; otherwise, ensure its implementation is clear and accessible.

## `apps/web/playwright.config.js` (1)
- [ ] line 18 **[low]** (edge-case) — **Invalid Trace Configuration on First Retry**: Setting `trace: 'on-first-retry'` could lead to confusing debugging information if tests don't fail on first retry since trace information won't be generated for subsequent retries. _Suggested fix:_ Consider changing the trace configuration to capture all retries for better debugging information.

## `apps/web/public/sw.js` (1)
- [ ] line 46 **[low]** (correctness) — **Ignoring Cross-Origin Requests**: The current implementation ignores all fetch requests that do not match the service worker's origin, which may lead to inconsistent behavior when interacting with APIs hosted on different domains. _Suggested fix:_ Consider adding functionality to handle cross-origin requests if needed, or explicitly document that the service worker is limited to same-origin requests only.

## `apps/web/src/Layout.jsx` (1)
- [ ] line 88 **[low]** (performance) — **Multiple DOM Manipulations for Apple Touch Icons**: The addAppleTouchIcon function creates multiple DOM elements for each call, which can be improved to reduce reflows and improve performance. _Suggested fix:_ Check if the link element already exists before creating it, and use a single function implementation to manage icon additions.

## `apps/web/src/components/maps/TimelineViewer.jsx` (1)
- [ ] line 10 **[low]** (performance) — **Using index as key prop may lead to performance issues**: Using the index as a key in a list can lead to performance issues and bugs with component state if the order of items changes. _Suggested fix:_ Use a unique identifier from the event object, if available, as the key (e.g., event.id).

## `apps/web/src/components/plans/SharePlanDialog.jsx` (1)
- [ ] line 28 **[low]** (edge-case) — **Potential Undefined Plan Overview**: `plan.plan_overview` may be undefined if `plan` is defined but lacks the `plan_overview` property, causing the API call to carry undefined data. _Suggested fix:_ Add a fallback value for `description`, such as an empty string or a default message.

## `apps/web/src/components/resources/TagManager.jsx` (1)
- [ ] line 61 **[low]** (error-handling) — **Silent error logging while loading existing tags**: While fetching existing tags, any error caught is only logged to the console and no user feedback is given, potentially leaving the user unaware of an issue. _Suggested fix:_ Display a toast notification to inform the user that there was an error loading the tags.

## `apps/web/src/components/ui/slider.jsx` (1)
- [ ] line 17 **[low]** (bug) — **Array Handling of Value Prop**: The value prop is being treated as an array, leading to potential issues if a consumer passes a single number instead of an array, creating complexity that isn't documented or handled. _Suggested fix:_ Document the value prop type clearly and consider unifying the expected input type to avoid confusion and ensure consistent behavior.

## `apps/web/src/components/utils/apiCall.jsx` (1)
- [ ] line 30 **[low]** (edge-case) — **Potential issue with nullish coalescing**: The use of nullish coalescing (??) could lead to a situation where valid responses that are falsy (like 0 or '') are not returned as intended because they are treated as 'not data'. _Suggested fix:_ Clarify the logic to ensure valid returns are handled correctly and not coerced or excluded erroneously.

## `apps/web/src/pages/ContactSupport.jsx` (1)
- [ ] line 68 **[low]** (error-handling) — **Lack of User Feedback on Message Loading Failure**: When loading messages in loadMyMessages, the error is logged to the console but no user feedback is provided to inform them of the failure. _Suggested fix:_ Add a user-facing notification (e.g., toast) informing them that the loading of messages has failed, similar to the other error handling in the code.

## `apps/web/src/pages/Home.jsx` (1)
- [ ] line 1093 **[low]** (correctness) — **Improper Closing of Modal**: The button used to close the demo modal may not provide user feedback on whether the action is successful. _Suggested fix:_ Consider providing a visual indication or temporary state change when the Close button is clicked.

## `apps/web/src/pages/PlanLibrary.jsx` (1)
- [ ] line 268 **[low]** (error-handling) — **Missing error handling on optional rendering**: If 'plan.description' is undefined, the rendering of the paragraph will not happen, leading to possible unintended UI behavior where the loading state or empty state is not managed properly. _Suggested fix:_ Conditionally render the paragraph only when 'plan.description' is a valid string, or show a default message.

## `apps/web/src/pages/Pricing.jsx` (1)
- [ ] line 41 **[low]** (edge-case) — **No feedback for unauthenticated users**: When users who are not authenticated try to upgrade, they receive only a toast notification. However, if the `useAuth` hook doesn't initialize properly, there could be a scenario where this toast is not shown, leading to confusion about the need to log in. _Suggested fix:_ Ensure there's a fallback way to notify users if there's an issue with authentication check or modify the notification logic to handle loading states more clearly.

## `apps/web/src/pages/WorldviewExplorer.jsx` (1)
- [ ] line 1310 **[low]** (edge-case) — **Not allowing empty notes to be saved**: The button to save notes is disabled if `currentNote.trim()` is false, which is a good check, but users might not realize they need to enter notes. There is no feedback provided on why the button is disabled. _Suggested fix:_ Add a simple tooltip or message indicating that the notes field cannot be empty before saving.

## `packages/shared/aiFeatures/index.js` (1)
- [ ] line 84 **[low]** (performance) — **Potential Performance Issue in Feature Registration Check**: Using `Object.prototype.hasOwnProperty.call` can be less performant than a direct property access, especially if the `AI_FEATURES` object grows larger in scope. _Suggested fix:_ Consider using a simple property access instead of using hasOwnProperty if the keys are guaranteed to be present and the situation does not require checking for inheritance concerns.

## `packages/shared/prompts/index.js` (1)
- [ ] line 50 **[low]** (bug) — **Default audienceLabel does not reflect potential edge cases**: The `audienceLabel` is set to default to `AUDIENCE_CONTEXT.general`, but if the `AUDIENCE_CONTEXT` does not contain the appropriate value for some reason, it could lead to unexpected outputs. _Suggested fix:_ Consider implementing a safeguard to verify if the default audienceLabel exists in the AUDIENCE_CONTEXT and handle it appropriately if it doesn't.

## `services/api/src/routes/auth.js` (2)
- [ ] line 1 **[low]** (dead-code) — **Unused Imports**: The `crypto` module is imported but never used in the codebase. This adds unnecessary clutter and overhead to the module. _Suggested fix:_ Remove the import statement for `crypto` if it's not being used anywhere in the file.
- [ ] line 4 **[low]** (dead-code) — **Redundant import of bcrypt package**: The code imports `bcrypt` but uses `bcryptjs` for hashing. This redundancy can cause confusion among developers regarding which library should be used for dealing with bcrypt operations. _Suggested fix:_ Remove the import statement for `bcrypt` if only `bcryptjs` is intended to be used.
