(function () {
    'use strict';

    if (!window.ScreenshotGallery) {
        throw new Error('Missing ScreenshotGallery; load gallery.js before local-app.js.');
    }
    if (typeof window.ScreenshotGallery.createGallery !== 'function') {
        throw new Error('Missing ScreenshotGallery.createGallery; load gallery.js before local-app.js.');
    }

    const createGallery = window.ScreenshotGallery.createGallery;

    const PROXY_ENDPOINT = 'https://testing2.funkpd.shop/cors.php';
    const SITEMAP_ENDPOINT = './sitemap-proxy.php';
    const SITEMAP_PAGE_LIMIT = 5;
    const FETCH_COOLDOWN_MS = 5000;
    const MAX_CAPTURE_HEIGHT = 6000;
    const PREVIEW_SCALE = 0.25;
    const EXPORT_MIME = 'image/webp';
    const EXPORT_QUALITY = 0.7;

    const VIEWPORTS = { mobile: 390, tablet: 834, desktop: 1920 };
    const blobUrls = new Set();
    let nextFetchReadyAt = 0;

    function selectById(id) {
        const el = document.getElementById(id);
        if (!el) throw new Error(`#${id} missing`);
        return el;
    }

    function writeStatus(target, msg) {
        if (!target) return;
        target.textContent = msg;
        target.scrollTop = target.scrollHeight;
    }

    function appendStatus(target, msg, data) {
        if (!target) return;
        const stamp = new Date().toISOString();
        const line = `[${stamp}] ${msg}`;
        if (data) {
            console.log(line, data);
        } else {
            console.log(line);
        }
        target.textContent += `\n${line}`;
        target.scrollTop = target.scrollHeight;
    }

    function deriveHost(url) {
        if (!url) return '';
        const parsed = new URL(url);
        return parsed.hostname;
    }

    function resolveViewportWidth(mode) {
        const width = VIEWPORTS[mode];
        if (width) return width;
        return VIEWPORTS.desktop;
    }

    function disableForm(form, disabled) {
        const controls = Array.from(form.elements);
        controls.forEach(control => {
            control.disabled = disabled;
        });
    }

    function createProxyUrl(url) {
        const encoded = encodeURIComponent(url);
        return `${PROXY_ENDPOINT}?url=${encoded}`;
    }

    function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function raf() {
        return new Promise(resolve => requestAnimationFrame(resolve));
    }

    async function waitForNextFetchSlot(statusEl) {
        const now = Date.now();
        if (now >= nextFetchReadyAt) return;
        const waitMs = nextFetchReadyAt - now;
        appendStatus(statusEl, `→ Waiting ${waitMs}ms`);
        await wait(waitMs);
    }

    async function fetchSnapshot(url, statusEl) {
        await waitForNextFetchSlot(statusEl);
        const proxyUrl = createProxyUrl(url);
        appendStatus(statusEl, '→ Fetching snapshot', { proxyUrl });
        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error(`Proxy fetch failed (${res.status})`);
        const html = await res.text();
        appendStatus(statusEl, '✓ HTML bytes', { length: html.length });
        return html;
    }

    function buildIframe(width) {
        const frame = document.createElement('iframe');
        Object.assign(frame.style, {
            width: `${width}px`,
            height: '100px',
            visibility: 'hidden',
            display: 'block',
            border: '0',
            position: 'absolute',
            left: '-10000px',
            top: '0',
            pointerEvents: 'none'
        });
        document.body.appendChild(frame);
        return frame;
    }

    function removeIframe(frame) {
        if (!frame) return;
        if (!frame.parentNode) return;
        frame.parentNode.removeChild(frame);
    }

    function writeHtmlIntoFrame(frame, html) {
        const primary = frame.contentDocument;
        if (primary) {
            primary.open();
            primary.write(html);
            primary.close();
            return primary;
        }
        const fallbackWindow = frame.contentWindow;
        if (!fallbackWindow) throw new Error('Missing frame window; cannot write HTML.');
        const fallbackDoc = fallbackWindow.document;
        if (!fallbackDoc) throw new Error('Missing frame document; cannot write HTML.');
        fallbackDoc.open();
        fallbackDoc.write(html);
        fallbackDoc.close();
        return fallbackDoc;
    }

    function freezeAnimations(doc) {
        const style = doc.createElement('style');
        style.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}';
        const head = doc.head || doc.documentElement;
        head.appendChild(style);
    }

    async function settleFonts(doc, statusEl) {
        const fonts = doc.fonts;
        if (!fonts) {
            appendStatus(statusEl, '✓ Fonts skipped');
            return;
        }
        const ready = fonts.ready;
        if (!ready) {
            appendStatus(statusEl, '✓ Fonts skipped');
            return;
        }
        await ready;
        appendStatus(statusEl, '✓ Fonts ready');
    }

    function computePageHeight(doc) {
        const root = doc.documentElement;
        const body = doc.body;
        const heights = [];
        if (root) heights.push(root.scrollHeight, root.offsetHeight);
        if (body) heights.push(body.scrollHeight);
        heights.push(MAX_CAPTURE_HEIGHT);
        return Math.max(...heights);
    }

    function clampHeight(value) {
        if (!value) return MAX_CAPTURE_HEIGHT;
        if (value > MAX_CAPTURE_HEIGHT) return MAX_CAPTURE_HEIGHT;
        return value;
    }

    function ensureHtml2Canvas() {
        if (typeof window.html2canvas !== 'function') {
            throw new Error('Missing html2canvas; include script before local-app.js.');
        }
        return window.html2canvas;
    }

    async function renderPage(doc, width, height, statusEl) {
        const html2canvas = ensureHtml2Canvas();
        const options = {
            backgroundColor: '#fff',
            useCORS: true,
            width,
            height,
            windowWidth: width,
            windowHeight: height,
            scale: 1,
            foreignObjectRendering: true
        };
        appendStatus(statusEl, '→ Rendering', { width, height });
        const canvas = await html2canvas(doc.documentElement, options);
        const scaled = document.createElement('canvas');
        scaled.width = Math.round(canvas.width * PREVIEW_SCALE);
        scaled.height = Math.round(canvas.height * PREVIEW_SCALE);
        const ctx = scaled.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(canvas, 0, 0, scaled.width, scaled.height);
        canvas.width = 0;
        canvas.height = 0;
        return scaled;
    }

    async function exportCanvasBlob(canvas) {
        return new Promise((resolve, reject) => {
            canvas.toBlob(blob => {
                if (!blob) {
                    reject(new Error('Canvas export failed; blob missing.'));
                    return;
                }
                resolve(blob);
            }, EXPORT_MIME, EXPORT_QUALITY);
        });
    }

    function createBlobUrl(blob) {
        return URL.createObjectURL(blob);
    }

    function releaseBlobUrls() {
        blobUrls.forEach(url => {
            URL.revokeObjectURL(url);
        });
        blobUrls.clear();
    }

    function scheduleFetchCooldown(statusEl) {
        nextFetchReadyAt = Date.now() + FETCH_COOLDOWN_MS;
        appendStatus(statusEl, `→ Cooling down ${FETCH_COOLDOWN_MS}ms`);
    }

    async function capturePage(params) {
        appendStatus(params.statusEl, '→ Capture', { url: params.url, mode: params.mode });
        const html = await fetchSnapshot(params.url, params.statusEl);
        const frame = buildIframe(params.width);
        try {
            const doc = writeHtmlIntoFrame(frame, html);
            freezeAnimations(doc);
            await raf();
            await raf();
            await settleFonts(doc, params.statusEl);
            const rawHeight = computePageHeight(doc);
            const captureHeight = clampHeight(rawHeight);
            const canvas = await renderPage(doc, params.width, captureHeight, params.statusEl);
            const blob = await exportCanvasBlob(canvas);
            const blobUrl = createBlobUrl(blob);
            blobUrls.add(blobUrl);
            params.gallery.append({
                host: deriveHost(params.url),
                mode: params.mode,
                pageUrl: params.url,
                imageUrl: blobUrl,
                blob,
                dimensions: { width: canvas.width, height: canvas.height },
                mime: blob.type
            });
            canvas.width = 0;
            canvas.height = 0;
            appendStatus(params.statusEl, '✓ Done', { url: params.url });
            if (params.hasNext) scheduleFetchCooldown(params.statusEl);
        } finally {
            removeIframe(frame);
        }
    }

    async function fetchSitemapUrls(baseUrl, statusEl) {
        const endpoint = `${SITEMAP_ENDPOINT}?url=${encodeURIComponent(baseUrl)}`;
        const res = await fetch(endpoint);
        if (!res.ok) throw new Error(`Sitemap fetch failed (${res.status})`);
        const data = await res.json();
        let list = [];
        if (Array.isArray(data.sitemap)) {
            list = data.sitemap;
        }
        if (!list.length) throw new Error('Empty sitemap');
        if (list.length > SITEMAP_PAGE_LIMIT) {
            list = list.slice(0, SITEMAP_PAGE_LIMIT);
        }
        let upstreamCount = list.length;
        if (typeof data.sourceCount === 'number') {
            upstreamCount = data.sourceCount;
        }
        let enforcedLimit = SITEMAP_PAGE_LIMIT;
        if (typeof data.limit === 'number') {
            enforcedLimit = data.limit;
        }
        appendStatus(statusEl, '✓ Sitemap loaded', { count: list.length, source: upstreamCount, limit: enforcedLimit });
        return list;
    }

    function parseUrlInput(raw) {
        const trimmed = raw.trim();
        if (trimmed === '') return [];
        const parts = trimmed.split(/\s+/);
        const unique = new Set();
        parts.forEach(url => {
            if (/^https?:\/\//i.test(url)) unique.add(url);
        });
        return Array.from(unique);
    }

    async function collectSitemapUrls(raw, statusEl) {
        const bases = parseUrlInput(raw);
        const urls = [];
        for (const base of bases) {
            if (urls.length >= SITEMAP_PAGE_LIMIT) {
                break;
            }
            const entries = await fetchSitemapUrls(base, statusEl);
            for (const entry of entries) {
                if (!/^https?:\/\//i.test(entry)) {
                    continue;
                }
                urls.push(entry);
                if (urls.length >= SITEMAP_PAGE_LIMIT) {
                    break;
                }
            }
        }
        appendStatus(statusEl, '✓ URLs collected', { total: urls.length, max: SITEMAP_PAGE_LIMIT });
        return urls;
    }

    function resolveSelectedMode(modeInputs) {
        const list = Array.from(modeInputs);
        for (const input of list) {
            if (input.checked) return input.value;
        }
        return 'desktop';
    }

    async function handleCapture(form, urlInput, modeInputs, statusEl, gallery) {
        disableForm(form, true);
        writeStatus(statusEl, '');
        const urls = await collectSitemapUrls(urlInput.value, statusEl);
        const mode = resolveSelectedMode(modeInputs);
        const width = resolveViewportWidth(mode);
        for (let i = 0; i < urls.length; i += 1) {
            const hasNext = i < urls.length - 1;
            await capturePage({ url: urls[i], mode, width, statusEl, gallery, hasNext });
        }
        disableForm(form, false);
    }

    function init() {
        const form = selectById('capture-form');
        const urlInput = selectById('urlInput');
        const statusEl = selectById('sessionStatus');
        const galleryContainer = selectById('result');
        const newSessionBtn = selectById('newSessionBtn');
        const clearGalleryBtn = selectById('clearGalleryBtn');
        const modeInputs = document.querySelectorAll('input[name="mode"]');
        const gallery = createGallery(galleryContainer);

        writeStatus(statusEl, 'Idle. Ready. Max 5 pages per session.');

        newSessionBtn.onclick = () => {
            releaseBlobUrls();
            gallery.clear();
            writeStatus(statusEl, 'Session reset.');
        };

        clearGalleryBtn.onclick = () => {
            releaseBlobUrls();
            gallery.clear();
            writeStatus(statusEl, 'Gallery cleared.');
        };

        form.onsubmit = async event => {
            event.preventDefault();
            await handleCapture(form, urlInput, modeInputs, statusEl, gallery);
        };
    }

    window.addEventListener('beforeunload', releaseBlobUrls);

    function boot() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }
        init();
    }

    boot();
})();
