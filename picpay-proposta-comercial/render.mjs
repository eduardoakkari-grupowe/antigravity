import puppeteer from 'puppeteer';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML = path.join(__dirname, 'proposta.html');
const OUT  = path.join(__dirname, '20260525_picpay_proposta_comercial.pdf');

const WIDTH = 1920;
const HEIGHT = 1080;

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
});

const page = await browser.newPage();
await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });

const url = pathToFileURL(HTML).href;
console.log('Loading:', url);

await page.goto(url, { waitUntil: ['load', 'networkidle0'], timeout: 120000 });

// wait for fonts
await page.evaluate(async () => {
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }
});

// wait for images
await page.evaluate(async () => {
  const imgs = Array.from(document.images);
  await Promise.all(imgs.map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise(res => { img.onload = res; img.onerror = res; });
  }));
});

// tiny settle
await new Promise(r => setTimeout(r, 600));

await page.pdf({
  path: OUT,
  width: `${WIDTH}px`,
  height: `${HEIGHT}px`,
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
});

await browser.close();

const sizeMB = (fs.statSync(OUT).size / (1024 * 1024)).toFixed(2);
console.log(`OK -> ${OUT} (${sizeMB} MB)`);
