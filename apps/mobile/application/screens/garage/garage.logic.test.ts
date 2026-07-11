import { deriveGarageLoading } from './useGarageViewModel';

describe('garage.logic — deriveGarageLoading', () => {
  it('is never loading once vehicles are present', () => {
    expect(deriveGarageLoading(2, null, 'idle')).toBe(false);
  });

  it('is loading when empty and no sync attempt has completed', () => {
    expect(deriveGarageLoading(0, null, 'idle')).toBe(true);
    expect(deriveGarageLoading(0, null, 'syncing')).toBe(true);
  });

  it('stops loading once a sync attempt concludes (synced or errored)', () => {
    expect(deriveGarageLoading(0, new Date(), 'idle')).toBe(false);
    expect(deriveGarageLoading(0, null, 'error')).toBe(false);
  });
});
