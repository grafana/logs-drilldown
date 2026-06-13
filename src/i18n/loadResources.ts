import { type ResourceLoader } from '@grafana/i18n';

const SUPPORTED_LANGUAGES = new Set([
  'en-US',
  'cs-CZ',
  'de-DE',
  'es-ES',
  'fr-FR',
  'hu-HU',
  'id-ID',
  'it-IT',
  'ja-JP',
  'ko-KR',
  'nl-NL',
  'pl-PL',
  'pt-BR',
  'pt-PT',
  'ru-RU',
  'sv-SE',
  'tr-TR',
  'zh-Hans',
  'zh-Hant',
]);
const FALLBACK_LANGUAGE = 'en-US';

export const loadResources: ResourceLoader = async (language: string) => {
  const locale = language || FALLBACK_LANGUAGE;
  const resolvedLocale = SUPPORTED_LANGUAGES.has(locale) ? locale : FALLBACK_LANGUAGE;

  if (resolvedLocale === FALLBACK_LANGUAGE) {
    return {};
  }

  try {
    return await import(`../locales/${resolvedLocale}/grafana-lokiexplore-app.json`);
  } catch (error) {
    if (resolvedLocale !== FALLBACK_LANGUAGE) {
      return await import(`../locales/${FALLBACK_LANGUAGE}/grafana-lokiexplore-app.json`);
    }
    throw error;
  }
};
