import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// BASE_PATH z. B. "/duo-fredo-learning/" für GitHub Pages; lokal "/".
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // "prompt": eine laufende Lektion wird nie überraschend neu geladen.
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Yol – Türkisch lernen',
        short_name: 'Yol',
        description: 'Türkisch lernen für Deutschsprachige, mit Fokus auf Grammatik.',
        lang: 'de',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#fafaf9',
        theme_color: '#0f766e',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Inhalte (JSON) gehören zum Precache: die Lektionen laufen komplett offline.
        globPatterns: ['**/*.{js,css,html,svg,png,json,webmanifest}'],
        navigateFallback: `${base}index.html`,
      },
    }),
  ],
});
