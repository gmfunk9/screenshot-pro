import fs from 'fs';
import path from 'path';
import config from '../config.js';

let current = '';

function timestamp() {
    return Date.now().toString();
}

function sessionPath() {
    if (current) return current;
    return newSession();
}

function newSession() {
    current = path.join(config.paths.screenshots, timestamp());
    fs.mkdirSync(current, { recursive: true });
    return current;
}

function clearSessionDisk() {
    if (!current) return;
    fs.rmSync(current, { recursive: true, force: true });
    current = '';
}

function clearSiteDisk(host) {
    if (!current) return;
    const dir = path.join(current, host);
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

function listImages() {
    if (!current) return [];
    return fs.readdirSync(current)
        .filter(f => f.endsWith('.jpg'))
        .map(f => path.join(current, f));
}

export { sessionPath, newSession, clearSessionDisk, clearSiteDisk, listImages };
