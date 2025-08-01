/*
 * ⚠️⚠️⚠️ THIS FILE WAS SCAFFOLDED BY `@grafana/create-plugin`. DO NOT EDIT THIS FILE DIRECTLY. ⚠️⚠️⚠️
 *
 * In order to extend the configuration follow the steps in
 * https://grafana.com/developers/plugin-tools/get-started/set-up-development-environment#extend-the-webpack-config
 */

import CopyWebpackPlugin from 'copy-webpack-plugin';
import ESLintPlugin from 'eslint-webpack-plugin';
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import path from 'path';
import ReplaceInFileWebpackPlugin from 'replace-in-file-webpack-plugin';
import TerserPlugin from 'terser-webpack-plugin';
import { SubresourceIntegrityPlugin } from "webpack-subresource-integrity";
import webpack, { type Configuration } from 'webpack';
import LiveReloadPlugin from 'webpack-livereload-plugin';
import VirtualModulesPlugin from 'webpack-virtual-modules';

import { BuildModeWebpackPlugin } from './BuildModeWebpackPlugin.ts';
import { DIST_DIR, SOURCE_DIR } from './constants.ts';
import { getCPConfigVersion, getEntries, getPackageJson, getPluginJson, hasReadme, isWSL } from './utils.ts';

const pluginJson = getPluginJson();
const cpVersion = getCPConfigVersion();

const virtualPublicPath = new VirtualModulesPlugin({
  'node_modules/grafana-public-path.js': `
import amdMetaModule from 'amd-module';

__webpack_public_path__ =
  amdMetaModule && amdMetaModule.uri
    ? amdMetaModule.uri.slice(0, amdMetaModule.uri.lastIndexOf('/') + 1)
    : 'public/plugins/${pluginJson.id}/';
`,
});

export type Env = {
  [key: string]: true | string | Env;
};

const config = async (env: Env): Promise<Configuration> => {
  const baseConfig: Configuration = {
    cache: {
      type: 'filesystem',
      buildDependencies: {
        // __filename doesn't work in Node 24
        config: [path.resolve(process.cwd(), '.config', 'webpack', 'webpack.config.ts')],
      },
    },

    context: path.join(process.cwd(), SOURCE_DIR),

    devtool: env.production ? 'source-map' : 'eval-source-map',

    entry: await getEntries(),

    externals: [
      // Required for dynamic publicPath resolution
      { 'amd-module': 'module' },
      'lodash',
      'jquery',
      'moment',
      'slate',
      'emotion',
      '@emotion/react',
      '@emotion/css',
      'prismjs',
      'slate-plain-serializer',
      '@grafana/slate-react',
      'react',
      'react-dom',
      'react-redux',
      'redux',
      'rxjs',
      'react-router',
      'd3',
      'angular',
      /^@grafana\/ui/i,
      /^@grafana\/runtime/i,
      /^@grafana\/data/i,

      // Mark legacy SDK imports as external if their name starts with the "grafana/" prefix
      ({ request }, callback) => {
        const prefix = 'grafana/';
        const hasPrefix = (request: string) => request.indexOf(prefix) === 0;
        const stripPrefix = (request: string) => request.substr(prefix.length);

        if (request && hasPrefix(request)) {
          return callback(undefined, stripPrefix(request));
        }

        callback();
      },
    ],

    // Support WebAssembly according to latest spec - makes WebAssembly module async
    experiments: {
      asyncWebAssembly: true,
    },

    mode: env.production ? 'production' : 'development',

    module: {
      rules: [
        // This must come first in the rules array otherwise it breaks sourcemaps.
        {
          test: /src\/(?:.*\/)?module\.tsx?$/,
          use: [
            {
              loader: 'imports-loader',
              options: {
                imports: `side-effects grafana-public-path`,
              },
            },
          ],
        },
        {
          exclude: /(node_modules)/,
          test: /\.[tj]sx?$/,
          use: {
            loader: 'swc-loader',
            options: {
              jsc: {
                baseUrl: path.resolve(process.cwd(), SOURCE_DIR),
                target: 'es2015',
                loose: false,
                parser: {
                  syntax: 'typescript',
                  tsx: true,
                  decorators: false,
                  dynamicImport: true,
                },
              },
            },
          },
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
        {
          test: /\.s[ac]ss$/,
          use: ['style-loader', 'css-loader', 'sass-loader'],
        },
        {
          test: /\.(png|jpe?g|gif|svg)$/,
          type: 'asset/resource',
          generator: {
            filename: Boolean(env.production) ? '[hash][ext]' : '[file]',
          },
        },
        {
          test: /\.(woff|woff2|eot|ttf|otf)(\?v=\d+\.\d+\.\d+)?$/,
          type: 'asset/resource',
          generator: {
            filename: Boolean(env.production) ? '[hash][ext]' : '[file]',
          },
        },
      ],
    },

    optimization: {
      minimize: Boolean(env.production),
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            format: {
              comments: (_, { type, value }) => type === 'comment2' && value.trim().startsWith('[create-plugin]'),
            },
            compress: {
              drop_console: ['log', 'info']
            }
          },
        }),
      ],
    },

    output: {
      clean: {
        keep: new RegExp(`(.*?_(amd64|arm(64)?)(.exe)?|go_plugin_build_manifest)`),
      },
      filename: '[name].js',
      chunkFilename: env.production ? '[name].js?_cache=[contenthash]' : '[name].js',
      library: {
        type: 'amd',
      },
      path: path.resolve(process.cwd(), DIST_DIR),
      publicPath: `public/plugins/${pluginJson.id}/`,
      uniqueName: pluginJson.id,
      crossOriginLoading: 'anonymous',
    },

    plugins: [
      new BuildModeWebpackPlugin(),
      virtualPublicPath,
      // Insert create plugin version information into the bundle
      new webpack.BannerPlugin({
        banner: "/* [create-plugin] version: " + cpVersion + " */",
        raw: true,
        entryOnly: true,
      }),
      new CopyWebpackPlugin({
        patterns: [
          // If src/README.md exists use it; otherwise the root README
          // To `compiler.options.output`
          { from: hasReadme() ? 'README.md' : '../README.md', to: '.', force: true },
          { from: 'plugin.json', to: '.' },
          { from: '../LICENSE', to: '.' },
          { from: '../CHANGELOG.md', to: '.', force: true },
          { from: '**/*.json', to: '.' },
          { from: '**/*.svg', to: '.', noErrorOnMissing: true },
          { from: '**/*.png', to: '.', noErrorOnMissing: true },
          { from: '**/*.html', to: '.', noErrorOnMissing: true },
          { from: 'img/**/*', to: '.', noErrorOnMissing: true },
          { from: 'libs/**/*', to: '.', noErrorOnMissing: true },
          { from: 'static/**/*', to: '.', noErrorOnMissing: true },
          { from: '**/query_help.md', to: '.', noErrorOnMissing: true },
        ],
      }),
      // Replace certain template-variables in the README and plugin.json
      new ReplaceInFileWebpackPlugin([
        {
          dir: DIST_DIR,
          files: ['plugin.json', 'README.md'],
          rules: [
            {
              search: /\%VERSION\%/g,
              replace: getPackageJson().version,
            },
            {
              search: /\%TODAY\%/g,
              replace: new Date().toISOString().substring(0, 10),
            },
            {
              search: /\%PLUGIN_ID\%/g,
              replace: pluginJson.id,
            },
          ],
        },
      ]),
      new SubresourceIntegrityPlugin({
        hashFuncNames: ["sha256"],
      }),
      ...(env.development ? [
        new LiveReloadPlugin(),
        new ForkTsCheckerWebpackPlugin({
          async: Boolean(env.development),
          issue: {
            include: [{ file: '**/*.{ts,tsx}' }],
          },
          typescript: { configFile: path.join(process.cwd(), 'tsconfig.json') },
        }),
        new ESLintPlugin({
          extensions: ['.ts', '.tsx'],
          lintDirtyModulesOnly: Boolean(env.development), // don't lint on start, only lint changed files
          failOnError: Boolean(env.production),
        }),
      ] : []),
    ],

    resolve: {
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
      // handle resolving "rootDir" paths
      modules: [path.resolve(process.cwd(), 'src'), 'node_modules'],
      unsafeCache: true,
    },
  };

  if (isWSL()) {
    baseConfig.watchOptions = {
      poll: 3000,
      ignored: /node_modules/,
    };
  }

  return baseConfig;
};

export default config;
