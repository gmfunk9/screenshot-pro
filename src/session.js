import fs from 'fs';
import path from 'path';
import config from '../config.js';

let current = '';

function timestamp() {
    return Date.now().toString();
}

function ensureDir(dir) {
    if (fs.existsSync(dir)) return;
    fs.mkdirSync(dir, { recursive: true });
}

function sanitizeHost(host) {
    if (!host) return '';
    return host.replace(/\./g, '_');
}

function unslugHost(slug) {
    return slug.replace(/_/g, '.');
}

function createSessionDir() {
    ensureDir(config.paths.screenshots);
    const dir = path.join(config.paths.screenshots, timestamp());
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

export function sessionPath() {
    if (current) return current;
    current = createSessionDir();
    return current;
}

export function newSession() {
    current = createSessionDir();
    return current;
}

export function clearSessionDisk() {
    if (!current) return;
    fs.rmSync(current, { recursive: true, force: true });
    current = '';
}

export function clearSiteDisk(host) {
    if (!host) return;
    const base = sessionPath();
    const dir = path.join(base, sanitizeHost(host));
    if (!fs.existsSync(dir)) return;
    fs.rmSync(dir, { recursive: true, force: true });
}

export function listImages() {
    const base = sessionPath();
    if (!fs.existsSync(base)) return [];
    const hosts = fs.readdirSync(base);
    const files = [];
    for (const hostSlug of hosts) {
        const dir = path.join(base, hostSlug);
        if (!fs.statSync(dir).isDirectory()) continue;
        const entries = fs.readdirSync(dir);
        for (const entry of entries) {
            if (!entry.endsWith('.png')) continue;
            files.push({ host: unslugHost(hostSlug), filepath: path.join(dir, entry) });
        }
    }
    return files;
}

export function sessionSummary() {
    const base = sessionPath();
    const id = path.basename(base);
    const hosts = [];
    if (fs.existsSync(base)) {
        for (const entry of fs.readdirSync(base)) {
            const dir = path.join(base, entry);
            if (!fs.statSync(dir).isDirectory()) continue;
            hosts.push(unslugHost(entry));
        }
    }
    return { id, path: base, hosts };
}
