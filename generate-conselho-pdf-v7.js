const puppeteer = require('puppeteer');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

(async () => {
  const htmlPath = 'C:/Users/User/Desktop/CONSELHO_2026.html';
  const outputPath = 'C:/Users/User/Desktop/CONSELHO_2026.pdf';
  const tempDir = 'C:/Users/User/Desktop/antigravity/pdf-temp';

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--font-render-hinting=none',
      '--allow-file-access-from-files',
    ],
  });

  const page = await browser.newPage();

  const slideWidth = 1920;
  const slideHeight = Math.round(slideWidth / (297 / 210)); // 1358

  await page.setViewport({
    width: slideWidth,
    height: slideHeight,
    deviceScaleFactor: 2,
  });

  console.log(`Viewport: ${slideWidth}x${slideHeight} @2x`);
  console.log('Loading HTML...');

  await page.goto(`file:///${htmlPath.replace(/\\/g, '/')}`, {
    waitUntil: 'networkidle0',
    timeout: 60000,
  });

  // Wait for fonts
  await page.evaluate(async () => await document.fonts.ready);
  await new Promise(r => setTimeout(r, 3000));

  // Step 1: Disable ONLY scroll-snap (nothing else) so scrollTop sticks
  await page.evaluate(() => {
    const container = document.querySelector('.slides');
    container.style.scrollSnapType = 'none';
    container.style.scrollBehavior = 'auto';
    // Also disable snap-align on individual slides
    document.querySelectorAll('.slide').forEach(s => {
      s.style.scrollSnapAlign = 'none';
    });
  });

  await new Promise(r => setTimeout(r, 500));

  const slideCount = await page.evaluate(() => document.querySelectorAll('.slide').length);
  console.log(`Found ${slideCount} slides`);

  // Capture each slide
  const screenshotPaths = [];
  for (let i = 0; i < slideCount; i++) {
    console.log(`Capturing slide ${i + 1}/${slideCount}...`);

    // Set exact scroll position
    await page.evaluate((index) => {
      const container = document.querySelector('.slides');
      const slide = document.querySelectorAll('.slide')[index];
      container.scrollTop = slide.offsetTop;
    }, i);

    await new Promise(r => setTimeout(r, 300));

    // Verify alignment
    const pos = await page.evaluate((index) => {
      const container = document.querySelector('.slides');
      const slide = document.querySelectorAll('.slide')[index];
      const rect = slide.getBoundingClientRect();
      return {
        slideId: slide.id,
        scrollTop: container.scrollTop,
        offsetTop: slide.offsetTop,
        visibleTop: rect.top,
      };
    }, i);
    console.log(`  ${pos.slideId}: scroll=${pos.scrollTop}, offset=${pos.offsetTop}, top=${pos.visibleTop.toFixed(1)}`);

    const screenshotPath = path.join(tempDir, `slide_${String(i + 1).padStart(2, '0')}.png`);
    await page.screenshot({ path: screenshotPath });
    screenshotPaths.push(screenshotPath);
  }

  console.log('\nBuilding PDF...');

  const pdfDoc = await PDFDocument.create();
  const pageWidth = 841.89;
  const pageHeight = 595.28;

  for (let i = 0; i < screenshotPaths.length; i++) {
    const imgBytes = fs.readFileSync(screenshotPaths[i]);
    const img = await pdfDoc.embedPng(imgBytes);
    const pdfPage = pdfDoc.addPage([pageWidth, pageHeight]);
    pdfPage.drawImage(img, {
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
    });
    console.log(`  Page ${i + 1} added`);
  }

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);

  console.log(`\nPDF saved: ${outputPath}`);
  console.log(`Size: ${(pdfBytes.length / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Pages: ${screenshotPaths.length}`);

  screenshotPaths.forEach(p => fs.unlinkSync(p));
  fs.rmdirSync(tempDir);

  await browser.close();
  console.log('Done!');
})();
