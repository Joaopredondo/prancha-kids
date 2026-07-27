import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const ID_VIRTUAL = 'virtual:assets';
const ID_RESOLVIDO = '\0' + ID_VIRTUAL;

function listar(pasta: string, extensao: string): string[] {
  const caminho = resolve(process.cwd(), 'public', pasta);
  if (!existsSync(caminho)) return [];
  return readdirSync(caminho)
    .filter((arquivo) => arquivo.endsWith(extensao))
    .map((arquivo) => arquivo.slice(0, -extensao.length));
}

/**
 * Lista o que existe em public/img e public/audio e entrega ao app como
 * `virtual:assets`. Assim cada card sabe se tem foto e se tem gravação, sem
 * sondagem HTTP e sem 404 — os assets podem ser adicionados aos poucos.
 */
function manifestoDeAssets(): Plugin {
  return {
    name: 'manifesto-de-assets',
    resolveId: (id) => (id === ID_VIRTUAL ? ID_RESOLVIDO : null),
    load(id) {
      if (id !== ID_RESOLVIDO) return null;
      return [
        `export const IMAGENS = ${JSON.stringify(listar('img', '.webp'))};`,
        `export const AUDIOS = ${JSON.stringify(listar('audio', '.mp3'))};`,
      ].join('\n');
    },
    configureServer(server: ViteDevServer) {
      // Arquivo novo largado na pasta durante o dev: refaz o manifesto.
      server.watcher.on('all', (_evento, caminho) => {
        if (!/public[/\\](img|audio)[/\\]/.test(caminho)) return;
        const modulo = server.moduleGraph.getModuleById(ID_RESOLVIDO);
        if (!modulo) return;
        server.moduleGraph.invalidateModule(modulo);
        server.hot.send({ type: 'full-reload' });
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    manifestoDeAssets(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'img/*.webp', 'audio/*.mp3'],
      workbox: {
        // Imagens e áudios entram no precache: a prancha funciona offline.
        globPatterns: ['**/*.{js,css,html,svg,png,webp,mp3,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
      manifest: {
        name: 'Prancha Kids',
        short_name: 'Prancha',
        description:
          'Prancha de comunicação com figuras e som para crianças, com vocabulário do dia a dia e da igreja.',
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#fbf7f0',
        theme_color: '#fbf7f0',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
});
