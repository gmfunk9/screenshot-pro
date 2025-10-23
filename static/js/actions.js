import { buildOfflineBundle } from 'app/offline';

function ensureOk(response, errorMessage) {
    if (response.ok) {
        return response;
    }
    throw new Error(errorMessage);
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

function filenameForMime(mime) {
    if (mime === 'image/png') {
        return 'capture.png';
    }
    if (mime === 'image/jpeg') {
        return 'capture.jpg';
    }
    if (mime === 'image/webp') {
        return 'capture.webp';
    }
    return 'capture.webp';
}

function normalizeMode(mode) {
    if (!mode) {
        return 'desktop';
    }
    const value = mode.toLowerCase();
    if (value === 'mobile') {
        return 'mobile';
    }
    if (value === 'tablet') {
        return 'tablet';
    }
    if (value === 'desktop') {
        return 'desktop';
    }
    throw new Error('Unsupported mode; pick mobile, tablet, or desktop.');
}

export async function fetchSitemap(url) {
    if (!url) {
        throw new Error('Missing field url; add to request.');
    }
    const endpoint = `/capture/sitemap?url=${encodeURIComponent(url)}`;
    const response = await fetch(endpoint);
    ensureOk(response, 'Sitemap request failed.');
    const data = await response.json();
    let list = [];
    if (data) {
        if (Array.isArray(data.urls)) {
            list = data.urls;
        }
    }
    if (!list.length) {
        throw new Error('Sitemap returned no URLs.');
    }
    return list;
}

export async function storeCapture(payload) {
    if (!payload) {
        throw new Error('Missing capture payload.');
    }
    const blob = payload.blob;
    if (!blob) {
        throw new Error('Missing capture blob payload.');
    }
    let pageUrl = '';
    if (typeof payload.pageUrl === 'string') {
        pageUrl = payload.pageUrl;
    }
    if (pageUrl === '') {
        throw new Error('Missing field pageUrl; add to body.');
    }
    let pageTitle = 'Captured page';
    if (typeof payload.pageTitle === 'string') {
        if (payload.pageTitle !== '') {
            pageTitle = payload.pageTitle;
        }
    }
    let mode = 'desktop';
    if (typeof payload.mode === 'string') {
        if (payload.mode !== '') {
            mode = payload.mode;
        }
    }
    let host = '';
    if (typeof payload.host === 'string') {
        host = payload.host;
    }
    let width = 0;
    let height = 0;
    const size = payload.dimensions;
    if (size) {
        const rawWidth = Number(size.width);
        if (Number.isFinite(rawWidth)) {
            width = Math.max(0, Math.round(rawWidth));
        }
        const rawHeight = Number(size.height);
        if (Number.isFinite(rawHeight)) {
            height = Math.max(0, Math.round(rawHeight));
        }
    }
    let mime = '';
    if (typeof payload.mime === 'string') {
        mime = payload.mime;
    }
    if (mime === '') {
        if (typeof blob.type === 'string') {
            if (blob.type !== '') {
                mime = blob.type;
            }
        }
    }
    if (mime === '') {
        mime = 'image/webp';
    }
    const form = new FormData();
    form.append('pageUrl', pageUrl);
    form.append('pageTitle', pageTitle);
    form.append('mode', mode);
    form.append('mime', mime);
    form.append('width', String(width));
    form.append('height', String(height));
    if (host !== '') {
        form.append('host', host);
    }
    const filename = filenameForMime(mime);
    form.append('image', blob, filename);
    const response = await fetch('/capture/store', {
        method: 'POST',
        body: form
    });
    ensureOk(response, 'Failed to persist capture.');
    const data = await response.json();
    if (!data) {
        throw new Error('Capture response missing image.');
    }
    if (!data.image) {
        throw new Error('Capture response missing image.');
    }
    return data.image;
}

export async function fetchStatus() {
    const response = await fetch('/capture/status');
    ensureOk(response, 'Status fetch failed.');
    return response.json();
}

export async function startSession() {
    const response = await fetch('/session', { method: 'POST' });
    ensureOk(response, 'Session creation failed.');
    return response.json();
}

export async function clearSession(host) {
    let endpoint = '/session';
    if (host) {
        endpoint += `?host=${encodeURIComponent(host)}`;
    }
    const response = await fetch(endpoint, { method: 'DELETE' });
    ensureOk(response, 'Session cleanup failed.');
}

export async function downloadPdf() {
    const response = await fetch('/export/pdf');
    ensureOk(response, 'PDF export failed.');
    const blob = await response.blob();
    downloadBlob(blob, 'screenshots.pdf');
}

export async function saveOfflineBundle() {
    const bundle = await buildOfflineBundle();
    if (!bundle) {
        throw new Error('Offline bundle builder returned no data.');
    }
    if (!bundle.html) {
        throw new Error('Offline bundle missing HTML content.');
    }
    let filename = 'screenshot-pro.html';
    if (bundle.filename) {
        filename = bundle.filename;
    }
    const blob = new Blob([bundle.html], { type: 'text/html;charset=UTF-8' });
    downloadBlob(blob, filename);
}

export { normalizeMode };
