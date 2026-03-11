import { type Compiler, Compilation } from '@rspack/core';

const PLUGIN_NAME = 'BuildModeRspackPlugin';

export class BuildModeRspackPlugin {
  apply(compiler: Compiler) {
    compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: PLUGIN_NAME,
          stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
        },
        (assets) => {
          const assetName = 'plugin.json';
          const asset = assets[assetName];
          if (!asset) {
            return;
          }

          const { RawSource } = compiler.rspack.sources;
          const pluginJsonContent = JSON.parse(asset.source().toString());
          const pluginJsonWithBuildMode = JSON.stringify(
            {
              ...pluginJsonContent,
              buildMode: compilation.options.mode,
            },
            null,
            4
          );
          const source = new RawSource(pluginJsonWithBuildMode);
          compilation.updateAsset(assetName, source);
        }
      );
    });
  }
}
