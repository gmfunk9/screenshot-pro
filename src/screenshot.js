import puppeteer from 'puppeteer';
import sharp from 'sharp';
import { generateFilePaths, screenshotExists } from './file.js';
import { parseCookies } from './cookies.js';
import { simulateMouseMovement } from './mouse.js';
import { cacheAssets } from './cache.js';

async function takeScreenshot(url, cookie) {
    const { finalFilePath, relativePath } = generateFilePaths(url);

    if (screenshotExists(finalFilePath)) {
        return { status: 'exists', filepath: finalFilePath, relativePath };
    }

    const browser = await puppeteer.launch({
        executablePath: puppeteer.executablePath(),
        headless: 'new'
    });
    const page = await browser.newPage();

    const cookies = parseCookies(cookie, url);
    if (cookies.length) await page.setCookie(...cookies);

    await cacheAssets(page);

    try {
        await page.goto(url, { timeout: 60000 });
        await page.waitForTimeout(1000);
        await simulateMouseMovement(page);
        const bodyHeight = await page.evaluate(() => document.documentElement.scrollHeight);
        await page.setViewport({ width: 1920, height: bodyHeight });
        await page.waitForTimeout(2000);
        await page.screenshot({ path: finalFilePath, fullPage: true });
        await browser.close();
        return { status: 'captured', filepath: finalFilePath, relativePath };
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
    const { status, filepath, relativePath } = await takeScreenshot(url, cookie);
    if (status === 'exists' || status === 'captured') {
        const { width, height } = await getImageDimensions(filepath);
        return { status, relativePath, dimensions: { width, height } };
    }
    return { status: 'error' };
}
