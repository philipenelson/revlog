import { normalizeOtpCode, isCompleteOtpCode } from './verify-email.logic';

describe('verify-email.logic', () => {
  describe('normalizeOtpCode', () => {
    it('strips non-digits and caps at 6', () => {
      expect(normalizeOtpCode('1a2b3c')).toBe('123');
      expect(normalizeOtpCode('12 34 56')).toBe('123456');
      expect(normalizeOtpCode('1234567890')).toBe('123456');
      expect(normalizeOtpCode('abc')).toBe('');
    });
  });

  describe('isCompleteOtpCode', () => {
    it('is true only for exactly six digits', () => {
      expect(isCompleteOtpCode('123456')).toBe(true);
      expect(isCompleteOtpCode('12345')).toBe(false);
      expect(isCompleteOtpCode('1234567')).toBe(false);
      expect(isCompleteOtpCode('12345a')).toBe(false);
    });
  });
});
