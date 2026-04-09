import { loadResources } from '../loadResources';

describe('loadResources', () => {
  describe('default language short-circuit', () => {
    it('should return an empty object when language is en-US', async () => {
      const result = await loadResources('en-US');

      expect(result).toEqual({});
    });

    it('should return an empty object when language is empty string', async () => {
      const result = await loadResources('');

      expect(result).toEqual({});
    });
  });

  describe('fallback behavior', () => {
    it('should return an empty object when requested language is not supported', async () => {
      const result = await loadResources('xx-XX');

      expect(result).toEqual({});
    });
  });
});
