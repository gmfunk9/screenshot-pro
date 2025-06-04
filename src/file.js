import fs from 'fs';
import path from 'path';
import config from '../config.js';

// Determine file paths for saving screenshots using URL's domain and filename
function generateFilePaths(url) {
    const host = new URL(url).hostname.replace(/\./g, '_');
    const pathSegments = new URL(url).pathname.replace(/\//g, '_');
    const sanitizedPath = pathSegments.replace(/^_+|_+$/g, '') || 'home';
    const screenshotsDir = path.join(config.paths.screenshots, host);
    const finalFilePath = path.join(screenshotsDir, `${sanitizedPath}.jpg`);

    const relativePath = `/static/screenshots/${host}/${sanitizedPath}.jpg`;

    // Ensure the cache directory exists
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir);
    }
  
    return { screenshotsDir, finalFilePath, relativePath};
  }
  

// Check for the existence of a screenshot at a given file path
function screenshotExists(filepath) {
    return fs.existsSync(filepath);
}
function sitemapCacheDir() {
    const SITEMAP_CACHE_DIR = path.resolve(config.paths.baseDir, 'assets/sitemap-cache');
    if (!fs.existsSync(SITEMAP_CACHE_DIR)) {
        fs.mkdirSync(SITEMAP_CACHE_DIR);
    }
    return SITEMAP_CACHE_DIR;
}




export { generateFilePaths, screenshotExists, sitemapCacheDir };
