/**
 * Classify client-reported errors that are injected by external scanners
 * rather than thrown by our own code.
 *
 * The canonical case: Microsoft Outlook SafeLinks (and similar mail-security
 * crawlers) pre-fetch links found in emails — including our password-reset
 * links to /Login?reset_token=… — inside an instrumented WebView that proxies
 * JS calls over an RPC bridge. When that bridge loses one of its own object
 * handles it throws
 *
 *   Object Not Found Matching Id:<n>, MethodName:<name>, ParamCount:<n>
 *
 * as an unhandled rejection inside our page, which our global error reporter
 * dutifully forwards. It is NOT an app error: every Prisma primary key in this
 * app is a UUID string (numeric "Id:4" cannot come from our data layer) and no
 * app method is invoked with 4 parameters. No real user sees anything.
 *
 * Classified errors are still logged server-side (audit trail) — they just
 * don't trigger the owner email pipeline.
 */

const EXTERNAL_SCANNER_RE = /^Object Not Found Matching Id:(\d+), MethodName:([\w$.]+), ParamCount:(\d+)/i;

/**
 * @param {unknown} message
 * @returns {{ classification: 'external-scanner', detail: { objectId?: string, methodName?: string, paramCount?: string } } | null}
 */
export function classifyExternalError(message) {
  const match = EXTERNAL_SCANNER_RE.exec(String(message ?? ''));
  if (match) {
    return {
      classification: 'external-scanner',
      detail: { objectId: match[1], methodName: match[2], paramCount: match[3] },
    };
  }
  return null;
}
