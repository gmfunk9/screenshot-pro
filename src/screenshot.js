import sharp from 'sharp';
import { withPage } from './browser.js';
import { generateFilePaths, screenshotExists } from './file.js';
import { parseCookies } from './cookies.js';
import { simulateMouseMovement } from './mouse.js';
import { cacheAssets } from './cache.js';
import config from '../config.js';

const VIEWPORTS = {
    mobile: { width: 390, height: 844 },
    tablet: { width: 1024, height: 1366 },
    desktop: { width: config.puppeteer.defaultViewport.width, height: config.puppeteer.defaultViewport.height }
};

function resolveViewport(mode) {
    if (mode && VIEWPORTS[mode]) return VIEWPORTS[mode];
    return VIEWPORTS.desktop;
}

async function storeScreenshot(buffer, finalFilePath) {
    await sharp(buffer).trim().toFile(finalFilePath);
}

async function readDimensions(finalFilePath) {
    const { width, height } = await sharp(finalFilePath).metadata();
    return { width, height };
}

async function preparePage(page, url, cookie, viewport) {
    const cookies = parseCookies(cookie, url);
    if (cookies.length) await page.setCookie(...cookies);
    await page.setViewport({ width: viewport.width, height: viewport.height });
    await cacheAssets(page);
    await page.goto(url, { timeout: 60000, waitUntil: 'networkidle2' });
    await page.waitForTimeout(1000);
    await simulateMouseMovement(page);
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewport({ width: viewport.width, height });
    await page.waitForTimeout(2000);
}

function buildSuccess(paths, dimensions, status, url, mode) {
    return {
        status,
        host: paths.hostname,
        pageUrl: url,
        imageUrl: paths.relativePath,
        relativePath: paths.relativePath,
        dimensions,
        mode
    };
}

export async function captureScreenshot(url, cookie, mode) {
    const viewport = resolveViewport(mode);
    const paths = generateFilePaths(url, mode);
    if (screenshotExists(paths.finalFilePath)) {
        const dimensions = await readDimensions(paths.finalFilePath);
        return buildSuccess(paths, dimensions, 'exists', url, mode);
    }

    try {
        const result = await withPage(async (page) => {
            await preparePage(page, url, cookie, viewport);
            const buffer = await page.screenshot({ fullPage: true });
            await storeScreenshot(buffer, paths.finalFilePath);
            const dimensions = await readDimensions(paths.finalFilePath);
            return { status: 'captured', dimensions };
        });
        return buildSuccess(paths, result.dimensions, result.status, url, mode);
    } catch (error) {
        return {
            status: 'error',
            host: paths.hostname,
            pageUrl: url,
            imageUrl: paths.relativePath,
            relativePath: paths.relativePath,
            mode,
            error: error.message
        };
    }
}
