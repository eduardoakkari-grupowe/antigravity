import puppeteer from 'puppeteer';
import { PDFDocument } from 'pdf-lib';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML = path.join(__dirname, 'proposta.html');
const OUT  = path.join(__dirname, '20260526_milan_leiloes_proposta_comercial.pdf');

const WIDTH  = 1920;
const HEIGHT = 1080;
const JPEG_QUALITY = 88;     // 0-100
const SCALE = 1.5;            // capture at 1.5x for crisper text, jpeg compresses well

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
});
const page = await browser.newPage();
await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: SCALE });
await page.goto(pathToFileURL(HTML).href, { waitUntil: 'networkidle0', timeout: 120000 });
await page.evaluate(async () => {
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  const imgs = Array.from(document.images);
  await Promise.all(imgs.map(img => img.complete ? null : new Promise(res => { img.onload = res; img.onerror = res; })));
});
await new Promise(r => setTimeout(r, 800));

const slides = await page.$$('section.slide');
console.log(`Capturing ${slides.length} slide(s)`);

const jpegs = [];
for (let i = 0; i < slides.length; i++) {
  const buf = await slides[i].screenshot({ type: 'jpeg', quality: JPEG_QUALITY });
  jpegs.push(buf);
  console.log(`  slide ${i+1}: ${(buf.length / 1024).toFixed(0)} KB`);
}

await browser.close();

const pdf = await PDFDocument.create();
for (const buf of jpegs) {
  const img = await pdf.embedJpg(buf);
  const pageDoc = pdf.addPage([WIDTH, HEIGHT]);
  pageDoc.drawImage(img, { x: 0, y: 0, width: WIDTH, height: HEIGHT });
}

const pdfBytes = await pdf.save();
fs.writeFileSync(OUT, pdfBytes);
const sizeMB = (pdfBytes.length / (1024 * 1024)).toFixed(2);
console.log(`OK -> ${OUT} (${sizeMB} MB)`);
