import { describe, it, expect } from 'vitest';
import { isAdOwner, validateAd, flightEnd } from './adsPolicy.js';
describe('advertisement authority and purchased dates', () => {
  it('requires the configured authenticated identity, never a generic role or profile', () => {
    expect(isAdOwner({ userId: 'other', userRole: 'admin', profile: { owner: true } }, 'owner')).toBe(false);
    expect(isAdOwner({ userId: 'owner', userRole: 'user' }, 'owner')).toBe(true);
    expect(isAdOwner({ userId: 'owner' }, '')).toBe(false);
    expect(isAdOwner({ body: { userId: 'owner' } }, 'owner')).toBe(false);
  });
  it('resolves inclusive week and two-week purchases', () => {
    expect(flightEnd('2026-09-09','1w')).toBe('2026-09-15');
    expect(flightEnd('2026-09-09','2w')).toBe('2026-09-22');
  });
  it('rejects script links, impossible dates and inverted dates', () => {
    const ad = { advertiser:'A', headline:'B', body:'', url:'https://example.com', seconds:15, startsAt:'2026-09-09', endsAt:'2026-09-15', active:true };
    expect(validateAd(ad).headline).toBe('B');
    for(const patch of [{url:'javascript:alert(1)'},{startsAt:'2026-02-30'},{endsAt:'2026-01-01'},{seconds:0},{headline:'<script>x</script>'}]) expect(()=>validateAd({...ad,...patch})).toThrow();
  });
});
