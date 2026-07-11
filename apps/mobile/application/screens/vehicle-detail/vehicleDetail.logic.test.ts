import { deriveDetailLoadState, entryCountText } from './useVehicleDetailViewModel';

describe('vehicleDetail.logic', () => {
  describe('deriveDetailLoadState', () => {
    it('is loading until the first read completes', () => {
      expect(deriveDetailLoadState(false, false)).toBe('loading');
      expect(deriveDetailLoadState(false, true)).toBe('loading');
    });
    it('is loaded/not-found once read, by presence of the vehicle', () => {
      expect(deriveDetailLoadState(true, true)).toBe('loaded');
      expect(deriveDetailLoadState(true, false)).toBe('not-found');
    });
  });

  describe('entryCountText', () => {
    it('shows the count, or None when empty', () => {
      expect(entryCountText(3)).toBe('3');
      expect(entryCountText(0)).toBe('None');
    });
  });
});
