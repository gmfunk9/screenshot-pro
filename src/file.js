import fs from 'fs';
import path from 'path';
import config from '../config.js';

function ensureDir(dir) {
    if (fs.existsSync(dir)) return;
    fs.mkdirSync(dir);
}

export function generateFilePaths(url) {
    const { hostname, pathname } = new URL(url);
    const host = hostname.replace(/\./g, '_');
    const sanitized = pathname.replace(/\//g, '_').replace(/^_+|_+$/g, '') || 'home';
    const screenshotsDir = path.join(config.paths.screenshots, host);
    ensureDir(screenshotsDir);
    const finalFilePath = path.join(screenshotsDir, `${sanitized}.jpg`);
    const relativePath = `/static/screenshots/${host}/${sanitized}.jpg`;
    return { screenshotsDir, finalFilePath, relativePath };
}

export function screenshotExists(filepath) {
    return fs.existsSync(filepath);
}

export function sitemapCacheDir() {
    const dir = path.resolve(config.paths.baseDir, 'assets/sitemap-cache');
    ensureDir(dir);
    return dir;
}
