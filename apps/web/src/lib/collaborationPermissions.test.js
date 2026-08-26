import { describe, expect, it } from 'vitest';
import { canViewSermonRevisionHistory } from './collaborationPermissions';

describe('collaborative sermon permissions', () => {
  it('keeps revision history visible to its owner and support administrators', () => {
    const sermon = { id: 'sermon-1', user_id: 'owner' };
    expect(canViewSermonRevisionHistory(sermon, { id: 'owner', role: 'user' })).toBe(true);
    expect(canViewSermonRevisionHistory(sermon, { id: 'admin', role: 'admin' })).toBe(true);
  });

  it('does not offer an owner-scoped history request to a collaborator', () => {
    const sermon = { id: 'sermon-1', user_id: 'owner' };
    expect(canViewSermonRevisionHistory(sermon, { id: 'collaborator', role: 'user' })).toBe(false);
  });
});
