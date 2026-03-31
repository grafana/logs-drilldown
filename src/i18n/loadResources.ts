import { type ResourceLoader } from '@grafana/i18n';

const SUPPORTED_LANGUAGES = new Set(['en-US']);
const FALLBACK_LANGUAGE = 'en-US';

export const loadResources: ResourceLoader = async (language: string) => {
  const locale = language || FALLBACK_LANGUAGE;
  const resolvedLocale = SUPPORTED_LANGUAGES.has(locale) ? locale : FALLBACK_LANGUAGE;

  try {
    return await import(`../locales/${resolvedLocale}/grafana-lokiexplore-app.json`);
  } catch (error) {
    if (resolvedLocale !== FALLBACK_LANGUAGE) {
      return await import(`../locales/${FALLBACK_LANGUAGE}/grafana-lokiexplore-app.json`);
    }
    throw error;
  }
};
