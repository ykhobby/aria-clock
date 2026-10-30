/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// base './' so the build works under https://ykhobby.github.io/aria-clock/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'watch.png'],
      manifest: {
        name: "Aria's Clock",
        short_name: "Aria's Clock",
        description: 'Learn to read a clock on your own watch.',
        lang: 'en-AU',
        display: 'standalone',
        orientation: 'any',
        background_color: '#fff6fb',
        theme_color: '#f7c5d3',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Everything, including every voice clip, so it all works offline.
        globPatterns: ['**/*.{js,css,html,png,svg,json,m4a}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: { environment: 'node' },
});
