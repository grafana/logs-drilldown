import { defineConfig } from 'i18next-cli';

export default defineConfig({
  locales: ['en-US'],
  extract: {
    input: ['src/**/*.{ts,tsx}'],
    output: 'src/locales/{{language}}/{{namespace}}.json',
    defaultNS: 'grafana-lokiexplore-app',
    keySeparator: '.',
    nsSeparator: false,
    contextSeparator: '_',
    pluralSeparator: '_',
    defaultValue: '',
    sort: true,
    indentation: 2,
    functions: ['t', '*.t'],
    transComponents: ['Trans'],
  },
});
