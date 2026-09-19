/** Shared authorization predicate: only the application's existing admin/dev roles. */
export function isAdministrativeRole(role) {
  return role === 'admin' || role === 'dev';
}
