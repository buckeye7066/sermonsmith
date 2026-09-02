import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('../../prisma/migrations/20260902_community_group_members/migration.sql', import.meta.url),
  'utf8',
);
const promotionalIdentityMigration = readFileSync(
  new URL('../../prisma/migrations/20260902_verified_promotional_principals/migration.sql', import.meta.url),
  'utf8',
);

describe('community membership migration safety', () => {
  it('preserves only authenticated owners of public legacy memberships as plain members', () => {
    expect(migration).toContain('m."user_id"');
    expect(migration).toContain("'member'");
    expect(migration).toContain("COALESCE(g.\"data\"->>'is_private', 'false') = 'false'");
    expect(migration).not.toContain("m.\"data\"->>'role'");
    expect(migration).not.toContain("m.\"data\"->>'user_id'");
    expect(migration).not.toContain('u."email"');
    expect(migration).toContain("'Member'");
  });

  it('does not seed deleted owners and has an ownerless-group recovery path', () => {
    expect(migration).toContain('u."deleted_at" IS NULL');
    expect(migration).toContain('SET "role" = \'leader\'');
    expect(migration).toContain('SET "user_id" = r."user_id"');
    expect(migration).toContain('"deleted"');
  });
});

describe('promotional identity migration safety', () => {
  it('uses a dedicated grant column and scrubs legacy email display names', () => {
    expect(promotionalIdentityMigration).toContain('ADD COLUMN "promotional_email"');
    expect(promotionalIdentityMigration).toContain('WHERE "deleted_at" IS NULL');
    expect(promotionalIdentityMigration).toContain('community_group_members');
    expect(promotionalIdentityMigration).toContain("jsonb_set(entity.\"data\", '{user_name}'");
    expect(promotionalIdentityMigration).not.toContain('SET "premium"');
  });
});
