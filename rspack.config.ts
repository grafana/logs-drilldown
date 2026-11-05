import path from 'node:path';

import type { Configuration } from '@rspack/core';
import { merge } from 'rspack-merge';

import FaroSourceMapUploaderPlugin from '@grafana/faro-webpack-plugin';
// Bundle analyzer: uncomment and run a dev build (production chunk names break it)
// import { RsdoctorRspackPlugin } from '@rsdoctor/rspack-plugin';

import grafanaConfig, { type Env } from './.config/rspack/rspack.config.ts';

const config = async (env: Env): Promise<Configuration> => {
  const baseConfig = await grafanaConfig(env);
  const sourceMapPlugins =
    process.env.FARO_SOURCEMAP_TOKEN &&
    process.env.FARO_SOURCEMAP_APP_NAME &&
    process.env.FARO_SOURCEMAP_APP_ID &&
    process.env.FARO_SOURCEMAP_STACK_ID &&
    process.env.FARO_SOURCEMAP_ENDPOINT
      ? [
          new FaroSourceMapUploaderPlugin({
            apiKey: process.env.FARO_SOURCEMAP_TOKEN,
            appName: process.env.FARO_SOURCEMAP_APP_NAME,
            endpoint: process.env.FARO_SOURCEMAP_ENDPOINT,
            appId: process.env.FARO_SOURCEMAP_APP_ID,
            stackId: process.env.FARO_SOURCEMAP_STACK_ID,
            gzipContents: true,
          }),
        ]
      : [];

  return merge(baseConfig, {
    output: {
      // Cleaning dist in watch mode briefly removes plugin.json, which crashes a booting Grafana (pnpm start)
      clean: env.production ? baseConfig.output?.clean : false,
    },
    resolve: {
      alias: {
        // hack to keep scenes from crashing when running in dev mode, can remove when https://github.com/grafana/scenes/issues/1322 is resolved.
        '@grafana/i18n': path.resolve(import.meta.dirname, 'node_modules/@grafana/i18n'),
      },
    },
    plugins: [
      ...sourceMapPlugins,
      // new RsdoctorRspackPlugin(),
    ],
  });
};

export default config;
