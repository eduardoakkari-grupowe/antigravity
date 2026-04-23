const puppeteer = require('puppeteer');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

(async () => {
  const htmlPath = 'C:/Users/User/Desktop/antigravity/area51-apresentacaomodelo/Gaion Apresentacao/area51-conselho-2026/CONSELHO_2026_v3.html';
  const outputPath = 'C:/Users/User/Desktop/CONSELHO_2026_v3.pdf';
  const tempDir = 'C:/Users/User/Desktop/antigravity/pdf-temp-v3';

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

  await page.evaluate(async () => await document.fonts.ready);
  await new Promise(r => setTimeout(r, 3000));

  await page.evaluate(() => {
    const container = document.querySelector('.slides');
    if (container) {
      container.style.scrollSnapType = 'none';
      container.style.scrollBehavior = 'auto';
    }
    document.querySelectorAll('.slide').forEach(s => {
      s.style.scrollSnapAlign = 'none';
    });
  });

  await new Promise(r => setTimeout(r, 500));

  const slideCount = await page.evaluate(() => document.querySelectorAll('.slide').length);
  console.log(`Found ${slideCount} slides`);

  const screenshotPaths = [];
  const overflowReports = [];

  for (let i = 0; i < slideCount; i++) {
    console.log(`Capturing slide ${i + 1}/${slideCount}...`);

    await page.evaluate((index) => {
      const container = document.querySelector('.slides');
      const slide = document.querySelectorAll('.slide')[index];
      if (container) container.scrollTop = slide.offsetTop;
      else slide.scrollIntoView({ behavior: 'auto', block: 'start' });
    }, i);

    await new Promise(r => setTimeout(r, 300));

    // Check for overflow / cut text
    const diag = await page.evaluate((index) => {
      const slide = document.querySelectorAll('.slide')[index];
      const sr = slide.getBoundingClientRect();
      const overflowing = [];
      slide.querySelectorAll('*').forEach(el => {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        // element exceeds slide bounds
        if (r.width > 0 && r.height > 0) {
          if (r.right > sr.right + 2 || r.bottom > sr.bottom + 2 || r.left < sr.left - 2 || r.top < sr.top - 2) {
            // only report direct descendant offenders to reduce noise
            if (el.parentElement === slide || el.parentElement?.parentElement === slide) {
              overflowing.push({
                tag: el.tagName.toLowerCase(),
                cls: (el.className || '').toString().slice(0, 60),
                bounds: {
                  right: Math.round(r.right - sr.right),
                  bottom: Math.round(r.bottom - sr.bottom),
                },
                text: (el.textContent || '').trim().slice(0, 40),
              });
            }
          }
          // check clipped text
          if (el.scrollWidth > el.clientWidth + 2 && (cs.overflow === 'hidden' || cs.overflowX === 'hidden')) {
            overflowing.push({ tag: el.tagName.toLowerCase(), cls: (el.className || '').toString().slice(0, 60), clipped: 'x', text: (el.textContent || '').trim().slice(0, 40) });
          }
          if (el.scrollHeight > el.clientHeight + 2 && (cs.overflow === 'hidden' || cs.overflowY === 'hidden')) {
            overflowing.push({ tag: el.tagName.toLowerCase(), cls: (el.className || '').toString().slice(0, 60), clipped: 'y', text: (el.textContent || '').trim().slice(0, 40) });
          }
        }
      });
      return {
        slideId: slide.id,
        slideBounds: { w: Math.round(sr.width), h: Math.round(sr.height), t: Math.round(sr.top) },
        overflowCount: overflowing.length,
        overflowing: overflowing.slice(0, 8),
      };
    }, i);

    overflowReports.push(diag);
    console.log(`  ${diag.slideId}: bounds ${diag.slideBounds.w}x${diag.slideBounds.h} @y=${diag.slideBounds.t}, overflow=${diag.overflowCount}`);
    if (diag.overflowing.length > 0) {
      diag.overflowing.forEach(o => console.log(`    - ${o.tag}.${o.cls}: ${JSON.stringify(o.bounds || o.clipped)} "${o.text}"`));
    }

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
    pdfPage.drawImage(img, { x: 0, y: 0, width: pageWidth, height: pageHeight });
    console.log(`  Page ${i + 1} added`);
  }

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);

  console.log(`\nPDF saved: ${outputPath}`);
  console.log(`Size: ${(pdfBytes.length / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Pages: ${screenshotPaths.length}`);

  // Keep screenshots for visual inspection, print summary report
  console.log('\n=== OVERFLOW REPORT SUMMARY ===');
  let totalOverflow = 0;
  overflowReports.forEach(r => {
    totalOverflow += r.overflowCount;
    if (r.overflowCount > 0) {
      console.log(`${r.slideId}: ${r.overflowCount} overflow issue(s)`);
    } else {
      console.log(`${r.slideId}: OK`);
    }
  });
  console.log(`Total overflow issues: ${totalOverflow}`);

  fs.writeFileSync(path.join(tempDir, '_report.json'), JSON.stringify(overflowReports, null, 2));

  await browser.close();
  console.log('Done!');
})();
