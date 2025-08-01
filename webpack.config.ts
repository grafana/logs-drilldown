import type { Configuration } from 'webpack';
import LiveReloadPlugin from 'webpack-livereload-plugin';
import { merge } from 'webpack-merge';

// const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

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
    ],
  });
};

export default config;
