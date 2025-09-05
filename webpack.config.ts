import type { Configuration } from 'webpack';
// import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import LiveReloadPlugin from 'webpack-livereload-plugin';
import { merge } from 'webpack-merge';

import FaroSourceMapUploaderPlugin from '@grafana/faro-webpack-plugin';

import grafanaConfig from './.config/webpack/webpack.config';

const config = async (env: any): Promise<Configuration> => {
  const baseConfig = await grafanaConfig(env);
  return merge(baseConfig, {
    experiments: {
      // Required to load WASM modules.
      asyncWebAssembly: true,
    },
    plugins: [
      // new BundleAnalyzerPlugin(),
      new LiveReloadPlugin({
        appendScriptTag: true,
        delay: 1000,
        hostname: 'localhost',
        port: 35828,
        protocol: 'http',
      }),
      ...(!!process.env.FARO_SOURCEMAP_TOKEN
        ? [
            new FaroSourceMapUploaderPlugin({
              apiKey: process.env.FARO_SOURCEMAP_TOKEN,
              appName: 'grafana-logsdrilldown-app-dev',
              endpoint: 'https://faro-api-ops-eu-south-0.grafana-ops.net/faro/api/v1',
              appId: '57',
              stackId: '27821',
              gzipContents: true,
            }),
            new FaroSourceMapUploaderPlugin({
              apiKey: process.env.FARO_SOURCEMAP_TOKEN,
              appName: 'grafana-logsdrilldown-app-ops',
              endpoint: 'https://faro-api-ops-eu-south-0.grafana-ops.net/faro/api/v1',
              appId: '59',
              stackId: '27821',
              gzipContents: true,
            }),
            new FaroSourceMapUploaderPlugin({
              apiKey: process.env.FARO_SOURCEMAP_TOKEN,
              appName: 'grafana-logsdrilldown-app-prod',
              endpoint: 'https://faro-api-ops-eu-south-0.grafana-ops.net/faro/api/v1',
              appId: '60',
              stackId: '27821',
              gzipContents: true,
            }),
          ]
        : []),
    ],
  });
};

export default config;
