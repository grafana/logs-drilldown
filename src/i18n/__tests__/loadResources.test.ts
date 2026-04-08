import { loadResources } from '../loadResources';

describe('loadResources', () => {
  describe('successful resource loading', () => {
    it('should load en-US resources when language is en-US', async () => {
      const result = await loadResources('en-US');

      expect(result).toMatchObject({
        components: {
          logs: {
            'log-line-details': {
              'copy-to-clipboard': 'Copy to clipboard',
            },
          },
        },
      });
    });

    it('should load en-US resources when language is empty string', async () => {
      const result = await loadResources('');

      expect(result).toMatchObject({
        components: {
          logs: {
            'log-line-details': {
              'copy-to-clipboard': 'Copy to clipboard',
            },
          },
        },
      });
    });
  });

  describe('fallback behavior', () => {
    it('should fallback to en-US when requested language is not found', async () => {
      const result = await loadResources('xx-XX');

      expect(result).toMatchObject({
        components: {
          logs: {
            'log-line-details': {
              'copy-to-clipboard': 'Copy to clipboard',
            },
          },
        },
      });
    });
  });
});
