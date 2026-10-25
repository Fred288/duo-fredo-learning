// Rendert public/icon.svg mit dem Playwright-Chromium zu PNGs (kein zusätzlicher Bild-Dependency).
// Aufruf: npx tsx tools/make-icons.ts  (PNGs werden eingecheckt)
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const svg = readFileSync('public/icon.svg', 'utf8');
// Das Icon ist vollflächig und hält die Glyphe in der Safe-Zone, taugt also auch als "maskable".
const targets = [
  { file: 'public/pwa-192.png', size: 192 },
  { file: 'public/pwa-512.png', size: 512 },
  { file: 'public/apple-touch-icon.png', size: 180 },
];

const browser = await chromium.launch();
try {
  for (const { file, size } of targets) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(
      `<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
    );
    await page.screenshot({ path: file, clip: { x: 0, y: 0, width: size, height: size } });
    await page.close();
    console.log(`✔ ${file}`);
  }
} finally {
  await browser.close();
}
