import { describe, expect, it } from 'vitest';
import { shouldUpgradeInsecureRequests } from './browserSecurityPolicy';

describe('runtime HTTPS upgrade policy', () => {
  it.each(['http://localhost:4173', 'http://127.0.0.1:5173', 'http://[::1]:4173'])(
    'keeps the loopback HTTP preview usable at %s', (url) => {
      expect(shouldUpgradeInsecureRequests(new URL(url))).toBe(false);
    },
  );
  it.each([
    'https://sermonsmith.vercel.app', 'http://sermonsmith.vercel.app',
    'https://sermonsmith.axiombiolabs.org', 'https://localhost:4173',
    'http://localhost.example.com', 'http://localhost@attacker.example.com',
    'http://192.168.1.1', 'file:///Applications/SermonSmith/app.html',
  ])('preserves the upgrade policy at %s', (url) => {
    expect(shouldUpgradeInsecureRequests(new URL(url))).toBe(true);
  });
  it('does not exempt an unknown location', () => {
    expect(shouldUpgradeInsecureRequests(undefined)).toBe(true);
  });
});
