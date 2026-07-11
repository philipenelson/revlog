import { vehicleDisplayLabel, collectFieldErrors, buildVehicleParseInput } from './vehicleForm';

describe('vehicleForm', () => {
  describe('vehicleDisplayLabel', () => {
    it('prefers a non-blank nickname', () => {
      expect(vehicleDisplayLabel('  Blackbird ', 'Honda', 'CB650R')).toBe('Blackbird');
    });
    it('falls back to make + model when both present', () => {
      expect(vehicleDisplayLabel('', ' Honda ', ' CB650R ')).toBe('Honda CB650R');
    });
    it('is null when nickname is blank and make/model incomplete', () => {
      expect(vehicleDisplayLabel('', 'Honda', '')).toBeNull();
    });
  });

  describe('collectFieldErrors', () => {
    it('keeps the first message per top-level field', () => {
      expect(
        collectFieldErrors([
          { path: ['make'], message: 'Required' },
          { path: ['make'], message: 'Too short' },
          { path: ['year'], message: 'Invalid' },
        ]),
      ).toEqual({ make: 'Required', year: 'Invalid' });
    });
    it('ignores issues without a string field path', () => {
      expect(collectFieldErrors([{ path: [], message: 'root' }])).toEqual({});
    });
  });

  describe('buildVehicleParseInput', () => {
    it('strips thousands commas from mileage, passing everything else through', () => {
      expect(
        buildVehicleParseInput({ nickname: 'x', make: 'Honda', model: 'CB', year: '2019', mileage: '12,500' }),
      ).toEqual({ nickname: 'x', make: 'Honda', model: 'CB', year: '2019', mileage: '12500' });
    });
  });
});
