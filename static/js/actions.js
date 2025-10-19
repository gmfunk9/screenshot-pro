const JSON_HEADERS = { 'Content-Type': 'application/json' };
const MODULES = [
    { specifier: 'app/main', path: '/static/js/main.js' },
    { specifier: 'app/gallery', path: '/static/js/gallery.js' },
    { specifier: 'app/sse', path: '/static/js/sse.js' },
    { specifier: 'app/actions', path: '/static/js/actions.js' },
    { specifier: 'app/events', path: '/static/js/events.js' }
];

function ensureOk(response, errorMessage) {
    if (response.ok) return response;
    throw new Error(errorMessage);
}

function encodeModule(code) {
    const encoded = btoa(unescape(encodeURIComponent(code)));
    return `data:text/javascript;base64,${encoded}`;
}

async function fetchText(url) {
    const response = await fetch(url);
    ensureOk(response, `Failed to load ${url}.`);
    return response.text();
}

async function imageToDataUrl(src) {
    const response = await fetch(src);
    ensureOk(response, `Failed to load ${src}.`);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error(`Failed to inline ${src}.`));
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
    });
}

function buildImportMap(entries) {
    const imports = {};
    for (const entry of entries) {
        imports[entry.specifier] = entry.url;
    }
    return JSON.stringify({ imports });
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

export async function requestCapture(payload) {
    if (!payload) throw new Error('Missing capture payload.');
    const url = payload.url;
    if (!url) throw new Error('Missing field url; add to body.');
    const cookie = payload.cookie || '';
    const response = await fetch('/capture', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ url, cookie })
    });
    ensureOk(response, 'Capture request failed.');
    return response.json().catch(() => null);
}

export async function startSession() {
    const response = await fetch('/session', { method: 'POST' });
    ensureOk(response, 'Session creation failed.');
}

export async function clearSession(host) {
    let endpoint = '/session';
    if (host) endpoint += `?host=${encodeURIComponent(host)}`;
    const response = await fetch(endpoint, { method: 'DELETE' });
    ensureOk(response, 'Session cleanup failed.');
}

export async function downloadPdf() {
    const response = await fetch('/pdf');
    ensureOk(response, 'PDF export failed.');
    const blob = await response.blob();
    downloadBlob(blob, 'screenshots.pdf');
}

export async function saveOfflineBundle() {
    const css = await fetchText('/static/css/style.min.css');
    const moduleEntries = [];
    for (const module of MODULES) {
        const code = await fetchText(module.path);
        const url = encodeModule(code);
        moduleEntries.push({ specifier: module.specifier, url });
    }

    const doc = document.documentElement.cloneNode(true);
    const head = doc.querySelector('head');
    if (!head) throw new Error('Missing head element.');

    doc.querySelectorAll('link[rel="stylesheet"]').forEach((node) => node.remove());
    const style = document.createElement('style');
    style.textContent = css;
    head.appendChild(style);

    doc.querySelectorAll('script').forEach((node) => node.remove());
    doc.querySelectorAll('script[type="importmap"]').forEach((node) => node.remove());

    const map = document.createElement('script');
    map.type = 'importmap';
    map.textContent = buildImportMap(moduleEntries);
    head.appendChild(map);

    const moduleScript = document.createElement('script');
    moduleScript.type = 'module';
    moduleScript.textContent = "import 'app/main';";
    doc.body.appendChild(moduleScript);

    const images = doc.querySelectorAll('img');
    for (const img of images) {
        const dataUrl = await imageToDataUrl(img.src);
        img.src = dataUrl;
    }

    const finalHtml = '<!DOCTYPE html>\n' + doc.outerHTML;
    const blob = new Blob([finalHtml], { type: 'text/html' });
    downloadBlob(blob, 'screenshot-pro.html');
}
