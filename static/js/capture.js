const VIEWPORTS = { mobile: 390, tablet: 834, desktop: 1280 };
const PROXY_ENDPOINT = '/proxy';
const MAX_CAPTURE_HEIGHT = 6000;
const CAPTURE_SCALE = 1;
const OUTPUT_SCALE = 0.75;
const TILE_HEIGHT = 512;
const PRELOAD_REL_BLOCKLIST = new Set(['preload', 'modulepreload', 'prefetch', 'prerender']);
const EXPORT_MIME = 'image/webp';
const EXPORT_QUALITY = 0.7;
const HEAVY_STYLE_KEYWORDS = [
    'animation',
    'transition',
    'filter',
    'backdrop-filter',
    'box-shadow',
    'background-attachment',
    'background-image',
    'transform',
    'perspective'
];

function notify(statusFn, message) {
    if (!statusFn) {
        return;
    }
    statusFn(message);
}

function ensureHtml2Canvas() {
    const factory = window.html2canvas;
    if (typeof factory === 'function') {
        return factory;
    }
    throw new Error('Missing html2canvas global; include the script tag.');
}

function computeViewportWidth(mode) {
    if (!mode) {
        return VIEWPORTS.desktop;
    }
    const lower = mode.toLowerCase();
    if (lower === 'mobile') {
        return VIEWPORTS.mobile;
    }
    if (lower === 'tablet') {
        return VIEWPORTS.tablet;
    }
    return VIEWPORTS.desktop;
}

async function fetchSnapshot(url, cookie, onStatus) {
    notify(onStatus, `Fetching HTML for ${url}`);
    let endpoint = `${PROXY_ENDPOINT}?url=${encodeURIComponent(url)}`;
    if (cookie) {
        endpoint += `&cookie=${encodeURIComponent(cookie)}`;
    }
    let response;
    try {
        response = await fetch(endpoint);
    } catch (error) {
        throw new Error(`Proxy request failed for ${url}.`);
    }
    if (!response.ok) {
        throw new Error(`Proxy returned ${response.status} for ${url}.`);
    }
    return response.text();
}

function stripPreloadLinks(doc) {
    const links = doc.querySelectorAll('link');
    for (const link of links) {
        const rel = link.getAttribute('rel');
        if (!rel) {
            continue;
        }
        const tokens = rel.split(/\s+/);
        let shouldRemove = false;
        for (const token of tokens) {
            if (!token) {
                continue;
            }
            const lower = token.toLowerCase();
            if (!PRELOAD_REL_BLOCKLIST.has(lower)) {
                continue;
            }
            shouldRemove = true;
            break;
        }
        if (!shouldRemove) {
            continue;
        }
        const parent = link.parentNode;
        if (!parent) {
            continue;
        }
        parent.removeChild(link);
    }
}

function stripInlineEventHandlers(doc) {
    const elements = doc.querySelectorAll('*');
    for (const element of elements) {
        const attributes = element.attributes;
        if (!attributes) {
            continue;
        }
        const items = Array.from(attributes);
        const removals = [];
        for (const attribute of items) {
            if (!attribute) {
                continue;
            }
            const name = attribute.name;
            if (!name) {
                continue;
            }
            const lower = name.toLowerCase();
            if (!lower.startsWith('on')) {
                continue;
            }
            removals.push(name);
        }
        for (const name of removals) {
            element.removeAttribute(name);
        }
    }
}

function stripInlineDangerousStyles(doc) {
    const elements = doc.querySelectorAll('[style]');
    for (const element of elements) {
        const value = element.getAttribute('style');
        if (!value) {
            continue;
        }
        const lower = value.toLowerCase();
        let shouldRemove = false;
        for (const keyword of HEAVY_STYLE_KEYWORDS) {
            if (!lower.includes(keyword)) {
                continue;
            }
            shouldRemove = true;
            break;
        }
        if (!shouldRemove) {
            continue;
        }
        element.removeAttribute('style');
    }
}

function sanitizeHtmlPayload(html) {
    if (typeof html !== 'string') {
        return '';
    }
    if (html === '') {
        return '';
    }
    let parsed;
    try {
        parsed = new DOMParser().parseFromString(html, 'text/html');
    } catch (error) {
        return fallbackSanitizeHtml(html);
    }
    if (!parsed) {
        return fallbackSanitizeHtml(html);
    }
    removeNodes(parsed, 'script');
    removeNodes(parsed, 'style');
    stripPreloadLinks(parsed);
    stripInlineEventHandlers(parsed);
    stripInlineDangerousStyles(parsed);
    const root = parsed.documentElement;
    if (!root) {
        return fallbackSanitizeHtml(html);
    }
    return `<!DOCTYPE html>${root.outerHTML}`;
}

function fallbackSanitizeHtml(html) {
    let sanitized = html;
    sanitized = sanitized.replace(/<script[\s\S]*?<\/script>/gi, '');
    sanitized = sanitized.replace(/<style[\s\S]*?<\/style>/gi, '');
    sanitized = sanitized.replace(/\son[a-z]+\s*=\s*(["'])[\s\S]*?\1/gi, ' ');
    sanitized = sanitized.replace(/<link[^>]+rel=["']?(?:preload|modulepreload|prefetch|prerender)["']?[^>]*>/gi, '');
    sanitized = sanitized.replace(/\sstyle\s*=\s*(["'])[\s\S]*?\1/gi, ' ');
    return sanitized;
}

function createFrame(width) {
    const frame = document.createElement('iframe');
    frame.width = width;
    frame.height = 100;
    frame.style.width = `${width}px`;
    frame.style.height = '100px';
    frame.style.visibility = 'hidden';
    frame.style.position = 'absolute';
    frame.style.left = '-9999px';
    frame.style.top = '0';
    frame.style.pointerEvents = 'none';
    frame.setAttribute('sandbox', 'allow-same-origin');
    document.body.appendChild(frame);
    return frame;
}

function removeFrame(frame) {
    if (!frame) {
        return;
    }
    frame.src = 'about:blank';
    frame.removeAttribute('srcdoc');
    const parent = frame.parentNode;
    if (!parent) {
        return;
    }
    parent.removeChild(frame);
}

function writeFrameHtml(frame, html) {
    let doc = frame.contentDocument;
    if (!doc) {
        const win = frame.contentWindow;
        if (win) {
            doc = win.document;
        }
    }
    if (!doc) {
        throw new Error('Iframe document unavailable; browser blocked frame.');
    }
    frame.srcdoc = html;
    if (frame.contentDocument) {
        return frame.contentDocument;
    }
    if (frame.contentWindow) {
        return frame.contentWindow.document;
    }
    doc.open();
    doc.write(html);
    doc.close();
    return doc;
}

function waitForLoad(frame) {
    return new Promise((resolve) => {
        let settled = false;
        const timer = window.setTimeout(() => {
            if (settled) {
                return;
            }
            settled = true;
            resolve();
        }, 8000);
        frame.onload = () => {
            if (settled) {
                return;
            }
            settled = true;
            window.clearTimeout(timer);
            resolve();
        };
    });
}

function raf() {
    return new Promise((resolve) => {
        window.requestAnimationFrame(resolve);
    });
}

async function settleFonts(doc) {
    const fonts = doc.fonts;
    if (!fonts) {
        return;
    }
    const ready = fonts.ready;
    if (!ready) {
        return;
    }
    try {
        await ready;
    } catch (error) {
        // Ignore font readiness errors
    }
}

function haltPendingLoads(doc) {
    if (!doc) {
        return;
    }
    const root = doc.documentElement;
    if (!root) {
        return;
    }
    const snapshot = root.innerHTML;
    if (snapshot === '') {
        return;
    }
    root.innerHTML = snapshot;
}

function computePageHeight(doc) {
    const metrics = [];
    const root = doc.documentElement;
    if (root) {
        metrics.push(root.scrollHeight);
        metrics.push(root.offsetHeight);
        metrics.push(root.clientHeight);
    }
    const body = doc.body;
    if (body) {
        metrics.push(body.scrollHeight);
        metrics.push(body.offsetHeight);
        metrics.push(body.clientHeight);
    }
    let max = 0;
    for (const value of metrics) {
        if (!Number.isFinite(value)) {
            continue;
        }
        if (value > max) {
            max = value;
        }
    }
    if (max <= 0) {
        return 1000;
    }
    return max;
}

function clampCaptureHeight(height) {
    if (height > MAX_CAPTURE_HEIGHT) {
        return MAX_CAPTURE_HEIGHT;
    }
    return height;
}

function limitDocumentHeight(doc, height) {
    const root = doc.documentElement;
    if (root) {
        root.style.overflow = 'hidden';
        root.style.maxHeight = `${height}px`;
        root.style.contain = 'layout paint style';
    }
    const body = doc.body;
    if (!body) {
        return;
    }
    body.style.overflow = 'hidden';
    body.style.maxHeight = `${height}px`;
}

function removeNodes(doc, selector) {
    const nodes = doc.querySelectorAll(selector);
    for (const node of nodes) {
        const parent = node.parentNode;
        if (!parent) {
            continue;
        }
        parent.removeChild(node);
    }
}

function softenImages(doc) {
    const images = doc.querySelectorAll('img');
    for (const image of images) {
        image.loading = 'lazy';
        image.decoding = 'async';
        image.fetchPriority = 'low';
        image.referrerPolicy = 'no-referrer';
        if (image.hasAttribute('srcset')) {
            image.removeAttribute('srcset');
        }
        if (image.sizes) {
            image.sizes = '';
        }
        if (!image.style) {
            continue;
        }
        image.style.maxHeight = `${MAX_CAPTURE_HEIGHT}px`;
        image.style.height = 'auto';
        image.style.maxWidth = '100%';
        image.style.objectFit = 'contain';
    }
}

function stripHeavyAssets(doc) {
    softenImages(doc);
}

function injectPerformanceStyles(doc, height) {
    const head = doc.head;
    if (!head) {
        return;
    }
    const style = doc.createElement('style');
    style.type = 'text/css';
    style.textContent = `
        :root, body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
            background-color: #ffffff !important;
            color: #111111 !important;
        }
        *, *::before, *::after {
            animation: none !important;
            transition: none !important;
            filter: none !important;
            box-shadow: none !important;
            background-image: none !important;
            background-attachment: scroll !important;
        }
        @font-face { font-display: swap !important; }
        html, body {
            overscroll-behavior: contain !important;
            margin: 0 auto !important;
            max-width: 100% !important;
        }
        img, video, canvas, iframe {
            max-width: 100% !important;
            max-height: ${height}px !important;
            width: auto !important;
            height: auto !important;
            object-fit: contain !important;
            background-color: #ffffff !important;
        }
        video, canvas, iframe {
            display: none !important;
        }
        img {
            image-rendering: crisp-edges !important;
        }
    `;
    head.appendChild(style);
}

async function renderCanvas(doc, width, height) {
    const factory = ensureHtml2Canvas();
    let safeWidth = Math.round(width);
    if (!Number.isFinite(safeWidth)) {
        safeWidth = 1;
    }
    if (safeWidth <= 0) {
        safeWidth = 1;
    }
    let safeHeight = Math.round(height);
    if (!Number.isFinite(safeHeight)) {
        safeHeight = 1;
    }
    if (safeHeight <= 0) {
        safeHeight = 1;
    }
    const output = document.createElement('canvas');
    output.width = safeWidth;
    output.height = safeHeight;
    const context = output.getContext('2d', { alpha: false });
    if (!context) {
        output.width = 0;
        output.height = 0;
        return renderCanvasFallback(factory, doc, safeWidth, safeHeight);
    }
    const step = Math.min(TILE_HEIGHT, safeHeight);
    for (let offset = 0; offset < safeHeight; offset += step) {
        let sliceHeight = step;
        const remaining = safeHeight - offset;
        if (remaining < step) {
            sliceHeight = remaining;
        }
        const tile = await renderCanvasTile(factory, doc, safeWidth, sliceHeight, offset);
        if (!tile) {
            output.width = 0;
            output.height = 0;
            return renderCanvasFallback(factory, doc, safeWidth, safeHeight);
        }
        context.drawImage(tile, 0, 0, safeWidth, sliceHeight, 0, offset, safeWidth, sliceHeight);
        tile.width = 0;
        tile.height = 0;
        await idle();
    }
    return output;
}

async function renderCanvasFallback(factory, doc, width, height) {
    const options = buildCanvasOptions(width, height, 0);
    try {
        return await factory(doc.documentElement, {
            ...options,
            foreignObjectRendering: false
        });
    } catch (error) {
        return factory(doc.documentElement, {
            ...options,
            foreignObjectRendering: true
        });
    }
}

async function renderCanvasTile(factory, doc, width, height, offset) {
    const options = buildCanvasOptions(width, height, offset);
    try {
        return await factory(doc.documentElement, {
            ...options,
            foreignObjectRendering: false
        });
    } catch (error) {
        return factory(doc.documentElement, {
            ...options,
            foreignObjectRendering: true
        });
    }
}

function buildCanvasOptions(width, height, offset) {
    return {
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: false,
        scale: CAPTURE_SCALE,
        width,
        height,
        y: offset,
        scrollY: offset,
        windowWidth: width,
        windowHeight: height,
        imageTimeout: 1500,
        logging: false,
        removeContainer: true
    };
}

function downscaleCanvas(source, scale) {
    if (!source) {
        return source;
    }
    if (!Number.isFinite(scale)) {
        return source;
    }
    if (scale <= 0) {
        return source;
    }
    if (scale >= 1) {
        return source;
    }
    const width = source.width;
    if (!Number.isFinite(width)) {
        return source;
    }
    if (width <= 0) {
        return source;
    }
    const height = source.height;
    if (!Number.isFinite(height)) {
        return source;
    }
    if (height <= 0) {
        return source;
    }
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));
    const output = document.createElement('canvas');
    output.width = targetWidth;
    output.height = targetHeight;
    const context = output.getContext('2d', { alpha: false });
    if (!context) {
        return source;
    }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(source, 0, 0, targetWidth, targetHeight);
    source.width = 0;
    source.height = 0;
    return output;
}

async function exportCanvasBlob(canvas) {
    if (!canvas) {
        throw new Error('Missing canvas for export.');
    }
    if (typeof canvas.convertToBlob === 'function') {
        try {
            const blob = await canvas.convertToBlob({ type: EXPORT_MIME, quality: EXPORT_QUALITY });
            if (blob) {
                return blob;
            }
        } catch (error) {
            // Fallback handled below.
        }
    }
    if (typeof canvas.toBlob !== 'function') {
        throw new Error('Canvas toBlob unavailable; cannot export.');
    }
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error('Canvas blob conversion failed.'));
                return;
            }
            resolve(blob);
        }, EXPORT_MIME, EXPORT_QUALITY);
    });
}

function idle() {
    return new Promise((resolve) => {
        if (typeof window.requestIdleCallback === 'function') {
            window.requestIdleCallback(() => {
                resolve();
            });
            return;
        }
        window.setTimeout(resolve, 16);
    });
}

function deriveHost(url) {
    try {
        const parsed = new URL(url);
        return parsed.hostname;
    } catch (error) {
        return '';
    }
}

async function captureSingle(url, options) {
    const onStatus = options.onStatus;
    notify(onStatus, `Capturing ${url}`);
    const rawHtml = await fetchSnapshot(url, options.cookie, onStatus);
    await idle();
    const width = computeViewportWidth(options.mode);
    const frame = createFrame(width);
    try {
        let frameHtml = sanitizeHtmlPayload(rawHtml);
        if (frameHtml === '') {
            frameHtml = rawHtml;
        }
        const doc = writeFrameHtml(frame, frameHtml);
        await waitForLoad(frame);
        await raf();
        await raf();
        await settleFonts(doc);
        haltPendingLoads(doc);
        await idle();
        injectPerformanceStyles(doc, MAX_CAPTURE_HEIGHT);
        stripHeavyAssets(doc);
        await idle();
        const fullHeight = computePageHeight(doc);
        const height = clampCaptureHeight(fullHeight);
        limitDocumentHeight(doc, height);
        frame.height = height;
        frame.style.height = `${height}px`;
        frame.style.maxHeight = `${height}px`;
        frame.style.overflow = 'hidden';
        await idle();
        const rawCanvas = await renderCanvas(doc, width, height);
        await idle();
        let capturedWidth = rawCanvas.width;
        if (!Number.isFinite(capturedWidth)) {
            capturedWidth = width;
        }
        let capturedHeight = rawCanvas.height;
        if (!Number.isFinite(capturedHeight)) {
            capturedHeight = height;
        }
        let workingCanvas = downscaleCanvas(rawCanvas, OUTPUT_SCALE);
        if (!workingCanvas) {
            workingCanvas = rawCanvas;
        }
        const outputWidth = workingCanvas.width;
        const outputHeight = workingCanvas.height;
        await idle();
        const blob = await exportCanvasBlob(workingCanvas);
        const mime = blob.type !== '' ? blob.type : EXPORT_MIME;
        workingCanvas.width = 0;
        workingCanvas.height = 0;
        if (workingCanvas !== rawCanvas) {
            rawCanvas.width = 0;
            rawCanvas.height = 0;
        }
        await idle();
        let title = 'Captured page';
        if (doc.title) {
            title = doc.title;
        }
        let mode = 'desktop';
        if (options.mode) {
            mode = options.mode;
        }
        return {
            blob,
            meta: {
                host: deriveHost(url),
                pageUrl: url,
                pageTitle: title,
                mode,
                mime,
                dimensions: { width: outputWidth, height: outputHeight },
                sourceDimensions: { width: capturedWidth, height: capturedHeight }
            }
        };
    } finally {
        removeFrame(frame);
    }
}

export async function capturePages(options) {
    if (!options) {
        throw new Error('Missing capture options.');
    }
    let urls = [];
    if (Array.isArray(options.urls)) {
        urls = options.urls;
    }
    if (!urls.length) {
        throw new Error('No URLs provided for capture.');
    }
    let mode = 'desktop';
    if (options.mode) {
        mode = options.mode;
    }
    const onStatus = options.onStatus;
    const onCapture = options.onCapture;
    const queue = [];
    for (const entry of urls) {
        if (typeof entry !== 'string') {
            continue;
        }
        const trimmed = entry.trim();
        if (trimmed === '') {
            continue;
        }
        queue.push(trimmed);
    }
    const total = queue.length;
    if (!total) {
        throw new Error('No valid URLs provided for capture.');
    }
    let index = 0;
    while (queue.length) {
        const nextUrl = queue.shift();
        if (!nextUrl) {
            continue;
        }
        index += 1;
        notify(onStatus, `Starting ${index} of ${total}`);
        const result = await captureSingle(nextUrl, { mode, cookie: options.cookie, onStatus });
        if (onCapture) {
            await onCapture(result);
        }
        notify(onStatus, `Finished ${index} of ${total}`);
        await idle();
    }
}

