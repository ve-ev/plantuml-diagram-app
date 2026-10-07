import {resolve} from 'node:path';
import {defineConfig} from 'vite';
import {viteStaticCopy} from 'vite-plugin-static-copy';
import react from '@vitejs/plugin-react';

/*
      See https://vitejs.dev/config/
*/

const dropCrossoriginAttributePlugin = () => {
  return {
    name: 'no-attribute',
    transformIndexHtml(html: string) {
      return html.replaceAll('crossorigin', '');
    }
  };
};

export default defineConfig({
  plugins: [
    react(),
    dropCrossoriginAttributePlugin(),
    viteStaticCopy({
      targets: [
        {
          src: '../manifest.json',
          dest: '.'
        },
        {
          src: '../public/*.*',
          dest: '.'
        },
        // PlantUML engine; loaded at runtime next to the widget page, not bundled.
        {
          src: '../node_modules/@plantuml/core/{plantuml,viz-global,themes}.js',
          dest: 'widgets/plantuml-app'
        },
        // PlantUML stdlib bundles, loaded by the engine for `!include <lib/...>`.
        {
          src: '../vendor/plantuml-stdlib/*.min.js',
          dest: 'widgets/plantuml-app'
        }
      ]
    }),
    viteStaticCopy({
      targets: [
        // Widget icons and configurations
        {
          src: 'widgets/*/*.{svg,png,jpg,json}',
          dest: '.'
        }
      ],
      structured: true
    })
  ],
  root: './src',
  base: '',
  publicDir: 'public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    copyPublicDir: false,
    target: ['es2022'],
    assetsDir: 'widgets/assets',
    rollupOptions: {
      input: {
        // List every widget entry point here
        plantumlApp: resolve(__dirname, 'src/widgets/plantuml-app/index.html'),
        plantumlBlocks: resolve(__dirname, 'src/widgets/plantuml-blocks/index.html')

      }
    }
  }
});
