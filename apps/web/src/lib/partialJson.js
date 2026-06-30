/**
 * Tolerant partial-JSON parsing for streamed AI output.
 *
 * When we stream a structured (json_object) completion token-by-token, the
 * accumulated text is almost always INCOMPLETE JSON mid-stream — an open
 * string, an unclosed object/array, a trailing comma. parsePartialJson()
 * best-effort closes those so the UI can render fields as they arrive
 * ("watch Larry write"), falling back to null when a fragment isn't yet
 * parseable (the caller keeps the last good parse until the next one lands).
 */

// Walk the fragment, track string/escape state and the bracket stack, then
// append the closers needed to make it syntactically complete.
function completeJson(input) {
  const stack = [];
  let inString = false;
  let escaped = false;
  let out = '';

  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    out += c;
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
    } else if (c === '"') {
      inString = true;
    } else if (c === '{') {
      stack.push('}');
    } else if (c === '[') {
      stack.push(']');
    } else if (c === '}' || c === ']') {
      stack.pop();
    }
  }

  // Close a dangling string, drop a trailing comma / dangling colon, then close
  // every still-open object/array.
  if (inString) out += '"';
  out = out.replace(/\\\s*$/, ''); // dangling escape
  out = out.replace(/[,:]\s*$/, ''); // trailing comma or "key": with no value yet
  for (let i = stack.length - 1; i >= 0; i--) out += stack[i];
  return out;
}

export function parsePartialJson(text) {
  if (typeof text !== 'string' || text.trim() === '') return null;
  let s = text.trim();

  // Strip a leading ```json fence if the model added one.
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)\s*(?:```|$)/i);
  if (fence) s = fence[1].trim();

  // Start at the first { or [.
  const start = s.search(/[{[]/);
  if (start === -1) return null;
  s = s.slice(start);

  // Fast path: already-valid JSON.
  try { return JSON.parse(s); } catch { /* fall through to repair */ }

  // Repair path: close open structures, then parse. If still broken (e.g. a
  // half-written key), peel off the last line/segment and retry a few times so
  // a single bad fragment doesn't blank the whole preview.
  let candidate = s;
  for (let attempt = 0; attempt < 4; attempt++) {
    try { return JSON.parse(completeJson(candidate)); } catch { /* trim and retry */ }
    const cut = Math.max(candidate.lastIndexOf(','), candidate.lastIndexOf('}'), candidate.lastIndexOf(']'));
    if (cut <= 0) break;
    candidate = candidate.slice(0, cut);
  }
  return null;
}
