import fs from 'fs';
import path from 'path';
import config from '../config.js';
import { sessionPath } from './session.js';

// Determine file paths for saving screenshots using URL's domain and filename
function generateFilePaths(url) {
    const host = new URL(url).hostname.replace(/\./g, '_');
    const pathSegments = new URL(url).pathname.replace(/\//g, '_');
    const sanitizedPath = pathSegments.replace(/^_+|_+$/g, '') || 'home';
    const screenshotsDir = path.join(sessionPath(), host);
    const finalFilePath = path.join(screenshotsDir, `${sanitizedPath}.jpg`);

    const relativePath = '/' + path.relative(config.paths.baseDir, finalFilePath).replace(/\\/g, '/');

    if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  
    return { screenshotsDir, finalFilePath, relativePath};
  }
  

// Check for the existence of a screenshot at a given file path
function screenshotExists(filepath) {
    return fs.existsSync(filepath);
}




export { generateFilePaths, screenshotExists };
