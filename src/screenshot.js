import puppeteer from 'puppeteer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { generateFilePaths, screenshotExists } from './file.js';

const cache = {};

function parseCookies(str, url) {
    if (!str) return [];
    const { hostname, pathname } = new URL(url);
    const cookiePath = pathname || '/';
    const cookies = [];
    for (const part of str.split(';')) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const idx = trimmed.indexOf('=');
        if (idx === -1) continue;
        const name = trimmed.slice(0, idx).trim();
        const value = trimmed.slice(idx + 1).trim();
        if (!name) continue;
        cookies.push({ name, value, domain: hostname, path: cookiePath });
    }
    return cookies;
}

async function simulateMouseMovement(page) {
    const mouse = page.mouse;
    await mouse.move(0, 0);
    await mouse.move(50, 50);
    await mouse.move(100, 100);
}

async function handleRequestInterception(interceptedRequest) {
    const url = interceptedRequest.url();
    const resourceType = interceptedRequest.resourceType();
    
    if ((resourceType === 'stylesheet' || resourceType === 'script') && cache[url]) {
        console.log(`Serving ${resourceType} from cache: ${url}`);
        interceptedRequest.respond({
            status: 200,
            body: cache[url],
        });
    } else {
        interceptedRequest.continue();
    }
}

async function cacheAssets(page) {
    await page.setRequestInterception(true);

    page.on('request', handleRequestInterception);
    
    page.on('response', async (response) => {
        const url = response.url();
        const resourceType = response.request().resourceType();

        if (resourceType === 'stylesheet' || resourceType === 'script') {
            try {
                const buffer = await response.buffer();
                cache[url] = buffer;
                console.log(`Cached ${resourceType}: ${url}`);
            } catch (error) {
                console.error(`Failed to cache ${resourceType} ${url}:`, error);
            }
        }
    });
}

// Capture and save a screenshot using Puppeteer
async function _takeScreenshot(url, cookie) {
    console.log("START: takeScreenshot");
    const { screenshotsDir, finalFilePath, relativePath } = generateFilePaths(url);
    console.log("FILE:" + finalFilePath);
    console.log("URL :" + url);
    
    if (screenshotExists(finalFilePath)) {
        console.log("exists:" + finalFilePath);
        return { status: 'exists', filepath: finalFilePath, relativePath: relativePath };
    }
    console.log("!exists:" + finalFilePath);

   // const browser = await puppeteer.launch({ headless: true }); // Run in headless mode
	const browser = await puppeteer.launch({
	  executablePath: puppeteer.executablePath(), // ← correct way to reference bundled binary
	  headless: 'new' // optional, silences warning
	});
    console.log("launch:");
    const page = await browser.newPage();
    console.log("newPage:");
    const cookies = parseCookies(cookie, url);
    if (cookies.length) {
        await page.setCookie(...cookies);
    }

    await cacheAssets(page);

    try {
        await page.goto(url, { timeout: 60000 }); // Increase navigation timeout to 60 seconds
        console.log("goto:");
        await page.waitForTimeout(1000);
        await simulateMouseMovement(page);

        await page.setViewport({ width: 1920, height: 1080 });

        const bodyHeight = await page.evaluate(() => document.documentElement.scrollHeight);
        await page.setViewport({ width: 1920, height: bodyHeight });
        await page.waitForTimeout(2000);
        const screenshotBuffer = await page.screenshot({ path: finalFilePath, fullPage: true });
        await browser.close();

        console.log("captured:" + finalFilePath);
        return { status: 'captured', filepath: finalFilePath, relativePath: relativePath };
    } catch (error) {
        console.error("Error capturing screenshot:", error);
        await browser.close();
        return { status: 'error', error: error.message };
    }
}

// Retrieve the dimensions of an image
async function _getImageDimensions(imagePath) {
    const { width, height } = await sharp(imagePath).metadata();
    return { width, height };
}

// A higher-level function that captures, processes, and returns screenshot details
async function captureDesktopScreenshot(url, cookie) {
    console.log("START: captureDesktopScreenshot");
    const { status, filepath, relativePath } = await _takeScreenshot(url, cookie);
    console.log("GGG " );
    console.log("status " + status);
    console.log("filepath " + filepath);
    if (status === 'exists' || status === 'captured') {
        const { width, height } = await _getImageDimensions(filepath);
        console.log("return CDS ");
        return {
            status,
            relativePath,
            dimensions: { width, height }
        };
    }
    return { status: 'error' };
}

export { captureDesktopScreenshot };
