import sharp from 'sharp';
import { withPage } from './browser.js';
import { generateFilePaths, screenshotExists } from './file.js';
import { parseCookies } from './cookies.js';
import { simulateMouseMovement } from './mouse.js';
import { cacheAssets } from './cache.js';
import config from '../config.js';
import { logger } from './logger.js';

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
    await sharp(buffer).toFile(finalFilePath);
}

async function readDimensions(finalFilePath) {
    const { width, height } = await sharp(finalFilePath).metadata();
    return { width, height };
}

async function waitForImages(page, timeoutMs = 20000) {
    const start = Date.now();
    try {
        await page.waitForFunction(() => {
            const imgs = Array.from(document.images || []);
            return imgs.every((img) => img.complete && img.naturalWidth > 0);
        }, { timeout: timeoutMs, polling: 250 });
        return { status: 'ready', elapsedMs: Date.now() - start };
    } catch (error) {
        return { status: 'timeout', elapsedMs: Date.now() - start, error: error.message };
    }
}

async function disableAnimations(page) {
    const css = `
        *,
        *::before,
        *::after {
            animation-delay: 0s !important;
            animation-duration: 0s !important;
            animation-iteration-count: 1 !important;
            transition-delay: 0s !important;
            transition-duration: 0s !important;
            scroll-behavior: auto !important;
            caret-color: transparent !important;
        }
    `;
    await page.addStyleTag({ content: css });
}

async function autoScroll(page, step = 800, maxScrolls = 20, delayMs = 150) {
    const metrics = await page.evaluate(() => ({
        scrollHeight: document.body?.scrollHeight || 0,
        innerHeight: window.innerHeight || 0
    }));
    if (!metrics.scrollHeight || !metrics.innerHeight) return;
    const maxY = Math.max(0, metrics.scrollHeight - metrics.innerHeight);
    let current = 0;
    for (let i = 0; i < maxScrolls && current < maxY; i += 1) {
        current = Math.min(maxY, current + step);
        await page.evaluate((y) => window.scrollTo(0, y), current);
        await page.waitForTimeout(delayMs);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
}

async function preparePage(page, url, cookie, viewport) {
    logger.info('capture', 'Preparing page', { url, viewport });
    const cookies = parseCookies(cookie, url);
    if (cookies.length) {
        logger.debug('capture', 'Setting cookies', { count: cookies.length });
        await page.setCookie(...cookies);
    }
    await page.setViewport({ width: viewport.width, height: viewport.height });
    logger.debug('capture', 'Viewport set', { width: viewport.width, height: viewport.height });
    await page.emulateMediaType('screen');
    page.setDefaultTimeout(600000);
    page.setDefaultNavigationTimeout(600000);
    logger.debug('capture', 'Request interception enabled');
    await cacheAssets(page);
    try {
        logger.info('capture', 'Navigating (networkidle0)', { url });
        await page.goto(url, { timeout: 90000, waitUntil: 'networkidle0' });
    } catch (error) {
        logger.warn('capture', 'networkidle0 timed out; falling back to domcontentloaded', { url });
        // Fallback to a less strict readiness if network never goes idle.
        await page.goto(url, { timeout: 60000, waitUntil: 'domcontentloaded' });
    }
    logger.debug('capture', 'Navigation complete');
    try {
        await disableAnimations(page);
        logger.debug('capture', 'Animations disabled');
    } catch (error) {
        logger.warn('capture', 'Failed to disable animations', { error: error.message });
    }
    try {
        logger.debug('capture', 'Auto-scrolling to trigger lazy loads');
        await autoScroll(page);
        logger.debug('capture', 'Auto-scroll complete');
    } catch (error) {
        logger.warn('capture', 'Auto-scroll failed; continuing', { error: error.message });
    }
    await page.waitForTimeout(1500);
    logger.debug('capture', 'Waiting for images to load');
    const imageWait = await waitForImages(page, 20000);
    if (imageWait.status === 'ready') {
        logger.debug('capture', 'Images ready', { elapsedMs: imageWait.elapsedMs });
    } else {
        logger.warn('capture', 'Image wait timed out; continuing', { elapsedMs: imageWait.elapsedMs, error: imageWait.error });
    }
    logger.debug('capture', 'Settling before interactions');
    await simulateMouseMovement(page);
    logger.debug('capture', 'Simulated mouse movement');
    await page.waitForTimeout(2000);
    logger.debug('capture', 'Settled before screenshot');
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
        logger.info('capture', 'Screenshot exists', { url, path: paths.finalFilePath });
        const dimensions = await readDimensions(paths.finalFilePath);
        return buildSuccess(paths, dimensions, 'exists', url, mode);
    }

    try {
        logger.info('capture', 'Starting capture', { url, mode });
        const result = await withPage(async (page) => {
            await preparePage(page, url, cookie, viewport);
            logger.info('capture', 'Taking screenshot', { url });
            const buffer = await page.screenshot({ fullPage: true });
            logger.info('capture', 'Screenshot captured', { bytes: buffer.length });
            logger.info('capture', 'Writing screenshot', { path: paths.finalFilePath });
            await storeScreenshot(buffer, paths.finalFilePath);
            const dimensions = await readDimensions(paths.finalFilePath);
            logger.info('capture', 'Screenshot saved', { width: dimensions.width, height: dimensions.height });
            return { status: 'captured', dimensions };
        });
        logger.info('capture', 'Capture complete', { url, mode, status: result.status });
        return buildSuccess(paths, result.dimensions, result.status, url, mode);
    } catch (error) {
        logger.error('capture', 'Capture failed', { url, mode, error: error.message });
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
