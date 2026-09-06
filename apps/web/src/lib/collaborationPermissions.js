export function canViewSermonRevisionHistory(sermon, user) {
  if (!sermon?.user_id || !user?.id) return false;
  return sermon.user_id === user.id || user.role === 'admin' || user.role === 'dev';
}
