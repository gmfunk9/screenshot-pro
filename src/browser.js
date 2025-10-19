import puppeteer from 'puppeteer';
import config from '../config.js';

let browser = null;
let pendingLaunch = null;

async function launchBrowser() {
    const options = {
        executablePath: puppeteer.executablePath(),
        headless: config.puppeteer.headless ? 'new' : false,
        defaultViewport: config.puppeteer.defaultViewport
    };
    const instance = await puppeteer.launch(options);
    instance.once('disconnected', () => {
        browser = null;
    });
    return instance;
}

async function getBrowser() {
    if (browser) return browser;
    if (pendingLaunch) return pendingLaunch;
    pendingLaunch = launchBrowser().then((instance) => {
        browser = instance;
        pendingLaunch = null;
        return instance;
    }).catch((error) => {
        pendingLaunch = null;
        throw error;
    });
    return pendingLaunch;
}

export async function withPage(callback) {
    if (!callback) throw new Error('Missing page callback.');
    const instance = await getBrowser();
    const page = await instance.newPage();
    try {
        return await callback(page);
    } finally {
        await page.close();
    }
}
