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

function listImages() {
    if (!current) return [];
    return fs.readdirSync(current)
        .filter(f => f.endsWith('.jpg'))
        .map(f => path.join(current, f));
}

export { sessionPath, newSession, clearSessionDisk, listImages };
