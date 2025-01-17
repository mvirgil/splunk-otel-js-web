/*
Copyright 2024 Splunk Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { createUnplugin, UnpluginFactory } from 'unplugin';

import { BannerPlugin, Compilation, WebpackPluginInstance } from 'webpack';
import { computeSourceMapId, getCodeSnippet } from './utils';
import { mockUploadFile } from './httpUtils';
import { join } from 'path';

export interface OllyWebPluginOptions {
  // define your plugin options here
}

const unpluginFactory: UnpluginFactory<OllyWebPluginOptions | undefined> = () => ({
  name: 'OllyWebPlugin',
  webpack(compiler) {
    const { webpack } = compiler;
    const { ConcatSource } = webpack.sources;
    console.log('testing logs again');
    compiler.hooks.thisCompilation.tap('OllyWebPlugin', (compilation) => {
      const bannerPlugin = new BannerPlugin({
        banner: ({ chunk }) => {
          if (!chunk.hash) {
            return '';
          }
          const sourceMapId = computeSourceMapId(chunk.hash);
          return getCodeSnippet(sourceMapId);
        },
        entryOnly: false,
        footer: true,
        include: /\.(js|mjs)$/,
        raw: true,
      });
      bannerPlugin.apply(compiler);

      compilation.hooks.processAssets.tap(
        {
          name: 'O11yWebPlugin',
          stage: Compilation.PROCESS_ASSETS_STAGE_ANALYSE
        },
        (assets) => {
          // console.log('my process assets', Object.keys(assets));
          Object.keys(assets)
            .filter(a => a.endsWith('.js.map'))
            .forEach((sourceMap) => {
              const asset = compilation.getAsset(sourceMap);
              const smId = computeSourceMapId(asset.source.source() as string);
              console.log(asset.name);
              console.log(smId);
            });
          Object.keys(assets)
            .filter(a => a.endsWith('.js'))
            .forEach((js) => {
              const asset = compilation.getAsset(js);
              const sm = asset.info.related?.sourceMap;
              if (asset && sm) {
                console.log('pair', asset.name, sm);
                const smAsset = compilation.getAsset(sm as string);
                const smId = computeSourceMapId(smAsset.source.source() as string);
                compilation.updateAsset(js, (old) => {
                  return new ConcatSource(old, '\n', smId);
                });
              }
            });
        }
      );
    });
    compiler.hooks.assetEmitted.tap('OllyWebPlugin', (file, { content, source, outputPath, compilation, targetPath }) => {
      // console.log(content);
      console.log('testAssetEmitted');
      if (targetPath.endsWith('.map')) {
        console.log(targetPath);
      }
      // console.log(content); // <Buffer 66 6f 6f 62 61 72>
    }
    );
    compiler.hooks.afterEmit.tapAsync(
      'OllyWebPlugin',
      async (compilation, callback) => {
        console.log('after emit'); // <Buffer 66 6f 6f 62 61 72>
        // console.log(compilation.assetsInfo); // <Buffer 66 6f 6f 62 61 72>
        // console.log(compilation.assets); // <Buffer 66 6f 6f 62 61 72>

        let i = 0;
        const sourceMaps = [];
        compilation.assetsInfo.forEach((assetInfo, asset) => {
          if (typeof assetInfo?.related?.sourceMap === 'string') {
            console.log(++i);
            console.log('chunkhash', assetInfo.contenthash);
            console.log('smid', computeSourceMapId(assetInfo.contenthash as string));
            console.log(asset);
            console.log(assetInfo.related.sourceMap);
            // TODO does this ^^ include nested path???
            sourceMaps.push(assetInfo.related.sourceMap);
          }
        });

        for (const sourceMap of sourceMaps) {
          console.log('uploading ', join(compiler.outputPath, sourceMap));
          await mockUploadFile({
            file: {
              filePath: join(compiler.outputPath, sourceMap),
              fieldName: 'file',
            },
            url: 'test',
            parameters: {}
          });
        }
        callback();
      }
    );
  }
});

const unplugin = createUnplugin(unpluginFactory);

export const ollyWebWebpackPlugin: (options: OllyWebPluginOptions) => WebpackPluginInstance = unplugin.webpack;
