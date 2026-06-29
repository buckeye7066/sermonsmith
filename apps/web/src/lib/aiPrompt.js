export const USER_INPUT_START = '<<<USER INPUT>>>';
export const USER_INPUT_END = '<<<END USER INPUT>>>';

export function formatUserInputBlock(label, value, fallback = 'Not specified') {
  const text = String(value ?? '').trim() || fallback;
  return `${label}:\n${USER_INPUT_START}\n${text}\n${USER_INPUT_END}`;
}
