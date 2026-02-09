import path from 'path';
import type { Configuration } from 'webpack';
//import LiveReloadPlugin from 'webpack-livereload-plugin';
import { merge } from 'webpack-merge';

// const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
import grafanaConfig from './.config/webpack/webpack.config';

const config = async (env: any): Promise<Configuration> => {
  const baseConfig = await grafanaConfig(env);
  // React 19: externalize jsx-runtime so plugin uses Grafana's React (required for Grafana >= 12.3.0)
  const existingExternals = Array.isArray(baseConfig.externals)
    ? baseConfig.externals
    : baseConfig.externals
    ? [baseConfig.externals]
    : [];
  return merge(baseConfig, {
    externals: [...existingExternals, 'react/jsx-runtime', 'react/jsx-dev-runtime'],
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
