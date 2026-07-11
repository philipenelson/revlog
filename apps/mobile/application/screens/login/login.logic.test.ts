import { SERVICE_ERROR } from '@/domain/apiError';
import {
  signInErrorMessage,
  shouldOfferBiometricEnrolment,
  SIGN_IN_USER_ERROR,
  OFFLINE_MISMATCH_ERROR,
} from './useLoginViewModel';

describe('login.logic', () => {
  describe('signInErrorMessage', () => {
    it('returns null for the success statuses', () => {
      expect(signInErrorMessage('online')).toBeNull();
      expect(signInErrorMessage('offline')).toBeNull();
    });
    it('maps each failure status to its copy', () => {
      expect(signInErrorMessage('invalidCredentials')).toBe(SIGN_IN_USER_ERROR);
      expect(signInErrorMessage('offlineUnavailable')).toBe(OFFLINE_MISMATCH_ERROR);
      expect(signInErrorMessage('serviceError')).toBe(SERVICE_ERROR);
    });
  });

  describe('shouldOfferBiometricEnrolment', () => {
    it('offers only when available and neither prompted nor already enabled', () => {
      expect(shouldOfferBiometricEnrolment(false, false, true)).toBe(true);
      expect(shouldOfferBiometricEnrolment(true, false, true)).toBe(false);
      expect(shouldOfferBiometricEnrolment(false, true, true)).toBe(false);
      expect(shouldOfferBiometricEnrolment(false, false, false)).toBe(false);
    });
  });
});
