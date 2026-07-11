import { reportStateFromShareUrl, buildSharePayload } from './mechanicPrintout.logic';

describe('mechanicPrintout.logic', () => {
  describe('reportStateFromShareUrl', () => {
    it('is has-token when a url exists, no-token otherwise', () => {
      expect(reportStateFromShareUrl('https://x/r/abc')).toBe('has-token');
      expect(reportStateFromShareUrl(null)).toBe('no-token');
    });
  });

  describe('buildSharePayload', () => {
    it('passes url + message on iOS', () => {
      expect(buildSharePayload(true, 'https://x/r/abc', 'History')).toEqual({
        url: 'https://x/r/abc',
        message: 'History',
      });
    });
    it('folds the link into the message on Android', () => {
      expect(buildSharePayload(false, 'https://x/r/abc', 'History')).toEqual({
        message: 'History\nhttps://x/r/abc',
      });
    });
  });
});
