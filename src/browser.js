import fs from 'fs';
import puppeteer from 'puppeteer';
import config from '../config.js';
import { logger } from './logger.js';

let browser = null;
let pendingLaunch = null;

async function launchBrowser() {
    const envPath = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH || '';
    const systemChromium = '/usr/bin/chromium';
    const executablePath = envPath || (fs.existsSync(systemChromium) ? systemChromium : '');
    const options = {
        headless: config.puppeteer.headless ? 'new' : false,
        defaultViewport: config.puppeteer.defaultViewport,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        protocolTimeout: 600000
    };
    logger.info('browser', 'Launching Chrome', {
        headless: options.headless,
        viewport: options.defaultViewport,
        executablePath: executablePath || 'bundled'
    });
    if (executablePath) {
        options.executablePath = executablePath;
    } else {
        options.executablePath = puppeteer.executablePath();
    }
    const instance = await puppeteer.launch(options);
    instance.once('disconnected', () => {
        logger.warn('browser', 'Chrome disconnected');
        browser = null;
    });
    logger.info('browser', 'Chrome launched');
    return instance;
}

async function getBrowser() {
    if (browser) return browser;
    if (pendingLaunch) return pendingLaunch;
    logger.info('browser', 'No active Chrome instance; launching');
    pendingLaunch = launchBrowser().then((instance) => {
        browser = instance;
        pendingLaunch = null;
        return instance;
    }).catch((error) => {
        logger.error('browser', 'Chrome launch failed', { error: error.message });
        pendingLaunch = null;
        throw error;
    });
    return pendingLaunch;
}

export async function withPage(callback) {
    if (!callback) throw new Error('Missing page callback.');
    const instance = await getBrowser();
    logger.info('browser', 'Opening new page');
    const page = await instance.newPage();
    try {
        return await callback(page);
    } finally {
        logger.info('browser', 'Closing page');
        await page.close();
    }
}
