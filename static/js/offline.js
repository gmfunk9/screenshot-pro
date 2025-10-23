import { describeImage } from 'app/gallery';

const MANIFEST_ENDPOINT = '/export/offline';
const STYLE_PATH = '/static/css/style.css';
const DOWNLOAD_NAME = 'screenshot-pro.html';

function ensureOk(response, message) {
    if (response.ok) return response;
    throw new Error(message);
}

async function fetchManifest() {
    const response = await fetch(MANIFEST_ENDPOINT);
    ensureOk(response, 'Offline manifest request failed.');
    return response.json();
}

async function fetchStyleSheet() {
    const response = await fetch(STYLE_PATH);
    ensureOk(response, 'Failed to load offline stylesheet.');
    return response.text();
}

function readBlobAsDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const value = reader.result;
            if (typeof value !== 'string') {
                reject(new Error('Failed to encode screenshot as data URL.'));
                return;
            }
            resolve(value);
        };
        reader.onerror = () => {
            reject(new Error('Failed to read screenshot blob.'));
        };
        reader.readAsDataURL(blob);
    });
}

async function loadScreenshot(url) {
    const response = await fetch(url);
    ensureOk(response, `Failed to fetch screenshot; url=${url}.`);
    const blob = await response.blob();
    return readBlobAsDataUrl(blob);
}

function escapeHtml(value) {
    if (value === undefined) return '';
    if (value === null) return '';
    const text = String(value);
    if (text === '') return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    let escaped = '';
    for (const char of text) {
        const replacement = map[char];
        if (replacement) {
            escaped += replacement;
            continue;
        }
        escaped += char;
    }
    return escaped;
}

function buildImageCardHtml(meta, dataUrl) {
    const lines = [];
    lines.push('<article class="card">');
    let hasHeader = false;
    if (meta.host !== '') {
        hasHeader = true;
    }
    if (!hasHeader) {
        if (meta.modeLabel !== '') {
            hasHeader = true;
        }
    }
    if (hasHeader) {
        lines.push('  <header class="card__meta">');
        if (meta.host !== '') {
            lines.push(`    <p class="card__title">${escapeHtml(meta.host)}</p>`);
        }
        if (meta.modeLabel !== '') {
            lines.push(`    <span class="card__badge">${escapeHtml(meta.modeLabel)}</span>`);
        }
        lines.push('  </header>');
    }
    const attrs = [];
    attrs.push('class="card__media"');
    attrs.push(`src="${escapeHtml(dataUrl)}"`);
    attrs.push(`alt="${escapeHtml(meta.pageTitle)}"`);
    const width = meta.dimensions.width;
    if (Number.isFinite(width)) {
        attrs.push(`width="${width}"`);
    }
    const height = meta.dimensions.height;
    if (Number.isFinite(height)) {
        attrs.push(`height="${height}"`);
    }
    lines.push(`  <img ${attrs.join(' ')} />`);
    lines.push('  <div class="card__actions">');
    if (meta.pageUrl !== '') {
        lines.push(`    <a href="${escapeHtml(meta.pageUrl)}" target="_blank" rel="noopener">View page</a>`);
    }
    lines.push(`    <a href="${escapeHtml(dataUrl)}" download>Download image</a>`);
    lines.push('  </div>');
    lines.push('</article>');
    return lines.join('\n');
}

function resolveSessionId(session) {
    if (!session) return '';
    if (typeof session.id !== 'string') return '';
    return session.id;
}

function buildDocumentHtml(style, session, cards) {
    const id = resolveSessionId(session);
    const lines = [];
    lines.push('<!DOCTYPE html>');
    lines.push('<html lang="en">');
    lines.push('<head>');
    lines.push('  <meta charset="UTF-8">');
    lines.push('  <meta name="viewport" content="width=device-width, initial-scale=1.0">');
    lines.push('  <title>Screenshot Pro Offline Bundle</title>');
    if (style !== '') {
        lines.push(`  <style>${style}</style>`);
    }
    lines.push('</head>');
    lines.push('<body>');
    lines.push('  <main class="stack stack--lg" style="padding:24px;max-width:1200px;margin:0 auto;">');
    lines.push('    <header class="stack stack--sm">');
    lines.push('      <h1>Screenshot Pro Offline Bundle</h1>');
    lines.push(`      <p>Session ${escapeHtml(id)}</p>`);
    lines.push('    </header>');
    lines.push('    <section class="gallery__grid">');
    for (const card of cards) {
        lines.push(card);
    }
    lines.push('    </section>');
    lines.push('  </main>');
    lines.push('</body>');
    lines.push('</html>');
    return lines.join('\n');
}

function normalizeImages(list) {
    if (!Array.isArray(list)) return [];
    const normalized = [];
    for (const image of list) {
        try {
            const meta = describeImage(image);
            normalized.push(meta);
        } catch (error) {
            console.error(error);
        }
    }
    return normalized;
}

export async function buildOfflineBundle() {
    const manifest = await fetchManifest();
    if (!manifest) throw new Error('Offline manifest payload empty.');
    const css = await fetchStyleSheet();
    const images = normalizeImages(manifest.images);
    if (!images.length) throw new Error('No screenshots captured; run a capture first.');
    const cards = [];
    for (const image of images) {
        const dataUrl = await loadScreenshot(image.imageUrl);
        const card = buildImageCardHtml(image, dataUrl);
        cards.push(card);
    }
    const html = buildDocumentHtml(css, manifest.session, cards);
    return { html, filename: DOWNLOAD_NAME };
}
