const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const VIEWPORTS = {
  d: { width: 1920, height: 1080 },
  t: { width: 768, height: 1024 },
  m: { width: 420, height: 800 },
};

async function capture(url, filePath, viewport) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport(viewport);
  await page.goto(url, { waitUntil: 'networkidle2' });
  await page.screenshot({ path: filePath, fullPage: true });
  await browser.close();
}

function buildFileName(base, type) {
  return `${base}--${type}.png`;
}

async function captureAllViewports(url, baseFile) {
  if (!url) {
    throw new Error('Missing field url; add to body.');
  }

  const promises = [];
  for (const [key, viewport] of Object.entries(VIEWPORTS)) {
    const name = buildFileName(baseFile, key);
    promises.push(capture(url, name, viewport));
  }
  await Promise.all(promises);

  const result = {};
  for (const key of Object.keys(VIEWPORTS)) {
    result[key] = buildFileName(path.basename(baseFile), key);
  }
  return result;
}

module.exports = { captureAllViewports };
