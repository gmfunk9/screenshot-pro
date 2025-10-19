import sharp from 'sharp';
import { withPage } from './browser.js';
import { generateFilePaths, screenshotExists } from './file.js';
import { parseCookies } from './cookies.js';
import { simulateMouseMovement } from './mouse.js';
import { cacheAssets } from './cache.js';
import config from '../config.js';

async function storeScreenshot(buffer, finalFilePath) {
    await sharp(buffer).trim().toFile(finalFilePath);
}

async function readDimensions(finalFilePath) {
    const { width, height } = await sharp(finalFilePath).metadata();
    return { width, height };
}

async function preparePage(page, url, cookie) {
    const cookies = parseCookies(cookie, url);
    if (cookies.length) await page.setCookie(...cookies);
    await cacheAssets(page);
    await page.goto(url, { timeout: 60000, waitUntil: 'networkidle2' });
    await page.waitForTimeout(1000);
    await simulateMouseMovement(page);
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewport({ width: config.puppeteer.defaultViewport.width, height });
    await page.waitForTimeout(2000);
}

function buildSuccess(paths, dimensions, status, url) {
    return {
        status,
        host: paths.hostname,
        pageUrl: url,
        imageUrl: paths.relativePath,
        relativePath: paths.relativePath,
        dimensions
    };
}

export async function captureDesktopScreenshot(url, cookie) {
    const paths = generateFilePaths(url);
    if (screenshotExists(paths.finalFilePath)) {
        const dimensions = await readDimensions(paths.finalFilePath);
        return buildSuccess(paths, dimensions, 'exists', url);
    }

    try {
        const result = await withPage(async (page) => {
            await preparePage(page, url, cookie);
            const buffer = await page.screenshot({ fullPage: true });
            await storeScreenshot(buffer, paths.finalFilePath);
            const dimensions = await readDimensions(paths.finalFilePath);
            return { status: 'captured', dimensions };
        });
        return buildSuccess(paths, result.dimensions, result.status, url);
    } catch (error) {
        return {
            status: 'error',
            host: paths.hostname,
            pageUrl: url,
            imageUrl: paths.relativePath,
            relativePath: paths.relativePath,
            error: error.message
        };
    }
}
