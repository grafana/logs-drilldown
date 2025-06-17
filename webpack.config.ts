import type { Configuration } from 'webpack';
import LiveReloadPlugin from 'webpack-livereload-plugin';
import { merge } from 'webpack-merge';

import grafanaConfig from './.config/webpack/webpack.config';
// const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

const config = async (env: any): Promise<Configuration> => {
  const baseConfig = await grafanaConfig(env);
  return merge(baseConfig, {
    experiments: {
      // Required to load WASM modules.
      asyncWebAssembly: true,
    },
    output: {
      chunkFilename: 'ld.[chunkhash].js',
    },
    plugins: [
      new LiveReloadPlugin({
        appendScriptTag: true,
        delay: 1000,
        hostname: 'localhost',
        port: 35828,
        protocol: 'http',
      }),
      // new BundleAnalyzerPlugin(),
    ],
  });
};

export default config;
