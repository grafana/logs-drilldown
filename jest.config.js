const { grafanaESModules, nodeModulesToTransform } = require('./.config/jest/utils');

// force timezone to UTC to allow tests to work regardless of local timezone
// generally used by snapshots, but can affect specific tests
process.env.TZ = 'UTC';
// i18next v25+ logs a Locize promo on first init; suppress in test runs (see I18NEXT_NO_SUPPORT_NOTICE in i18next)
process.env.I18NEXT_NO_SUPPORT_NOTICE = '1';

const config = require('./.config/jest.config');

module.exports = {
  // Jest configuration provided by Grafana scaffolding
  ...config,
  testEnvironmentOptions: {
    // Set base URL for jsdom - tests can use history.pushState to change pathname/search
    url: 'http://localhost:3000/',
  },
  moduleNameMapper: {
    ...config.moduleNameMapper,
    '/@bsull/augurs/changepoint/': '@bsull/augurs/changepoint.js',
    '/@bsull/augurs/outlier/': '@bsull/augurs/outlier.js',
    '^marked$': '<rootDir>/src/__mocks__/marked.js',
    '^react-calendar$': '<rootDir>/src/__mocks__/react-calendar.js',
  },
  transform: {
    ...config.transform,
    '^.+\\.svg$': '<rootDir>/.config/svgTransform.js',
  },
  transformIgnorePatterns: [nodeModulesToTransform([...grafanaESModules, '@bsull/augurs'])],
};
