import fs from 'fs';
import path from 'path';
import config from '../config.js';
import { sessionPath } from './session.js';

function ensureDir(dir) {
    if (fs.existsSync(dir)) return;
    fs.mkdirSync(dir, { recursive: true });
}

function sanitizeHost(hostname) {
    return hostname.replace(/\./g, '_');
}

function sanitizePath(pathname) {
    const cleaned = pathname.replace(/\//g, '_').replace(/^_+|_+$/g, '');
    if (cleaned) return cleaned;
    return 'home';
}

export function generateFilePaths(url) {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    const hostSlug = sanitizeHost(hostname);
    const fileSlug = sanitizePath(parsed.pathname);
    const sessionDir = sessionPath();
    const sessionId = path.basename(sessionDir);
    const hostDir = path.join(sessionDir, hostSlug);
    ensureDir(hostDir);
    const finalFilePath = path.join(hostDir, `${fileSlug}.jpg`);
    const relativePath = `/static/screenshots/${sessionId}/${hostSlug}/${fileSlug}.jpg`;
    return { sessionId, hostDir, finalFilePath, relativePath, hostname, hostSlug, fileSlug };
}

export function screenshotExists(filepath) {
    return fs.existsSync(filepath);
}

export function sitemapCacheDir() {
    const dir = path.resolve(config.paths.baseDir, 'assets/sitemap-cache');
    ensureDir(dir);
    return dir;
}
