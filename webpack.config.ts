import path from 'path';
import type { Configuration } from 'webpack';
import webpack from 'webpack';
//import LiveReloadPlugin from 'webpack-livereload-plugin';
import { merge } from 'webpack-merge';

import FaroSourceMapUploaderPlugin from '@grafana/faro-webpack-plugin';

// const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
import grafanaConfig from './.config/webpack/webpack.config';

const faroEnvDefine = new webpack.DefinePlugin({
  'process.env.FARO_URL_LOCAL': JSON.stringify(process.env.FARO_URL_LOCAL ?? ''),
  'process.env.FARO_URL_DEV': JSON.stringify(process.env.FARO_URL_DEV ?? ''),
  'process.env.FARO_URL_OPS': JSON.stringify(process.env.FARO_URL_OPS ?? ''),
  'process.env.FARO_URL_PROD': JSON.stringify(process.env.FARO_URL_PROD ?? ''),
  'process.env.FARO_APP_NAME_LOCAL': JSON.stringify(process.env.FARO_APP_NAME_LOCAL ?? ''),
  'process.env.FARO_APP_NAME_DEV': JSON.stringify(process.env.FARO_APP_NAME_DEV ?? ''),
  'process.env.FARO_APP_NAME_OPS': JSON.stringify(process.env.FARO_APP_NAME_OPS ?? ''),
  'process.env.FARO_APP_NAME_PROD': JSON.stringify(process.env.FARO_APP_NAME_PROD ?? ''),
});

const config = async (env: any): Promise<Configuration> => {
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
    resolve: {
      ...baseConfig.resolve,
      alias: {
        ...baseConfig.resolve?.alias,
        // hack to keep scenes from crashing when running in dev mode, can remove when https://github.com/grafana/scenes/issues/1322 is resolved.
        '@grafana/i18n': path.resolve(__dirname, 'node_modules/@grafana/i18n'),
      },
    },
    experiments: {
      // Required to load WASM modules.
      asyncWebAssembly: true,
    },
    plugins: [
      faroEnvDefine,
      ...sourceMapPlugins,
      // new BundleAnalyzerPlugin(),
      /*new LiveReloadPlugin({
        appendScriptTag: true,
        delay: 1000,
        hostname: 'localhost',
        port: 35828,
        protocol: 'http',
      }),*/
    ],
  });
};

export default config;
