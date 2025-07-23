import puppeteer from 'puppeteer';
import sharp from 'sharp';
import { generateFilePaths, screenshotExists } from './file.js';
import { parseCookies } from './cookies.js';
import { simulateMouseMovement } from './mouse.js';
import { cacheAssets } from './cache.js';
import config from '../config.js';
async function takeScreenshot(url, cookie) {
const { finalFilePath, relativePath } = generateFilePaths(url);
if (screenshotExists(finalFilePath)) {
    return { status: 'exists', filepath: finalFilePath, relativePath, pageUrl: url };
}
const browser = await puppeteer.launch({
    executablePath: puppeteer.executablePath(),
    headless: 'new',
    defaultViewport: config.puppeteer.defaultViewport
});
const page = await browser.newPage();
const cookies = parseCookies(cookie, url);
if (cookies.length) await page.setCookie(...cookies);
await cacheAssets(page);
try {
    await page.goto(url, { timeout: 60000 });
    await page.waitForTimeout(1000);
    await simulateMouseMovement(page);
    
    // --- Restored original logic to load all images ---
    const bodyHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewport({ width: config.puppeteer.defaultViewport.width, height: bodyHeight });
    await page.waitForTimeout(2000); // Crucial wait after resizing

    // Take screenshot to an in-memory buffer
    const screenshotBuffer = await page.screenshot({ fullPage: true });
    await browser.close();

    // --- New logic to trim whitespace ---
    await sharp(screenshotBuffer).trim().toFile(finalFilePath);

    return { status: 'captured', filepath: finalFilePath, relativePath, pageUrl: url };
} catch (error) {
    await browser.close();
    return { status: 'error', error: error.message };
}
}
async function getImageDimensions(imagePath) {
const { width, height } = await sharp(imagePath).metadata();
return { width, height };
}
export async function captureDesktopScreenshot(url, cookie) {
const { status, filepath, relativePath, pageUrl } = await takeScreenshot(url, cookie);
if (status === 'exists' || status === 'captured') {
    const { width, height } = await getImageDimensions(filepath);
    return { status, relativePath, dimensions: { width, height }, pageUrl };
}
return { status: 'error' };
}
