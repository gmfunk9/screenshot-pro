const VIEWPORTS = { mobile: 390, tablet: 834, desktop: 1280 };
const PROXY_ENDPOINT = '/proxy';
const MAX_CAPTURE_HEIGHT = 1280;
const CAPTURE_SCALE = 0.25;
const DOWNSCALE_MAX_EDGE = 512;
const PRELOAD_REL_BLOCKLIST = new Set(['preload', 'modulepreload', 'prefetch', 'prerender']);
const EXPORT_MIME = 'image/png';
const EXPORT_QUALITY = 0.92;

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
        return html;
    }
    if (!parsed) {
        return html;
    }
    removeNodes(parsed, 'script');
    stripPreloadLinks(parsed);
    stripInlineEventHandlers(parsed);
    const root = parsed.documentElement;
    if (!root) {
        return html;
    }
    return `<!DOCTYPE html>${root.outerHTML}`;
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
    document.body.appendChild(frame);
    return frame;
}

function removeFrame(frame) {
    if (!frame) {
        return;
    }
    frame.src = 'about:blank';
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
    removeNodes(doc, 'video');
    removeNodes(doc, 'audio');
    removeNodes(doc, 'iframe');
    removeNodes(doc, 'object');
    removeNodes(doc, 'embed');
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
        *, *::before, *::after { animation: none !important; transition: none !important; }
        * { background-attachment: scroll !important; background-image: none !important; box-shadow: none !important; filter: none !important; }
        @font-face { font-display: swap !important; }
        html, body { overscroll-behavior: contain !important; }
        img { image-rendering: crisp-edges !important; max-width: 100% !important; max-height: ${height}px !important; height: auto !important; }
    `;
    head.appendChild(style);
}

async function renderCanvas(doc, width, height) {
    const factory = ensureHtml2Canvas();
    const baseOptions = {
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: false,
        scale: CAPTURE_SCALE,
        width,
        height,
        windowWidth: width,
        windowHeight: height,
        imageTimeout: 1500,
        logging: false,
        removeContainer: true
    };
    try {
        return await factory(doc.documentElement, {
            ...baseOptions,
            foreignObjectRendering: false
        });
    } catch (error) {
        return factory(doc.documentElement, {
            ...baseOptions,
            foreignObjectRendering: true
        });
    }
}

function downscaleCanvas(source, maxEdge) {
    if (!source) {
        return source;
    }
    if (!Number.isFinite(maxEdge)) {
        return source;
    }
    if (maxEdge <= 0) {
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
    let scale = 1;
    if (width > height) {
        if (width > maxEdge) {
            scale = maxEdge / width;
        }
    }
    if (width <= height) {
        if (height > maxEdge) {
            scale = maxEdge / height;
        }
    }
    if (scale === 1) {
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
    context.imageSmoothingQuality = 'medium';
    context.drawImage(source, 0, 0, targetWidth, targetHeight);
    source.width = 0;
    source.height = 0;
    return output;
}

function canvasToBlob(canvas) {
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

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result;
            if (typeof result !== 'string') {
                reject(new Error('Blob conversion returned non-string result.'));
                return;
            }
            resolve(result);
        };
        reader.onerror = () => {
            reject(new Error('Failed to convert blob to data URL.'));
        };
        reader.readAsDataURL(blob);
    });
}

async function canvasToDataUrl(canvas) {
    const blob = await canvasToBlob(canvas);
    canvas.width = 0;
    canvas.height = 0;
    return blobToDataUrl(blob);
}

function yieldToBrowser() {
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
    await yieldToBrowser();
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
        await yieldToBrowser();
        injectPerformanceStyles(doc, MAX_CAPTURE_HEIGHT);
        stripHeavyAssets(doc);
        await yieldToBrowser();
        const fullHeight = computePageHeight(doc);
        const height = clampCaptureHeight(fullHeight);
        limitDocumentHeight(doc, height);
        frame.height = height;
        frame.style.height = `${height}px`;
        frame.style.maxHeight = `${height}px`;
        frame.style.overflow = 'hidden';
        await yieldToBrowser();
        const rawCanvas = await renderCanvas(doc, width, height);
        await yieldToBrowser();
        let workingCanvas = downscaleCanvas(rawCanvas, DOWNSCALE_MAX_EDGE);
        if (!workingCanvas) {
            workingCanvas = rawCanvas;
        }
        const outputWidth = workingCanvas.width;
        const outputHeight = workingCanvas.height;
        await yieldToBrowser();
        const dataUrl = await canvasToDataUrl(workingCanvas);
        await yieldToBrowser();
        let title = 'Captured page';
        if (doc.title) {
            title = doc.title;
        }
        let mode = 'desktop';
        if (options.mode) {
            mode = options.mode;
        }
        return {
            imageData: dataUrl,
            meta: {
                host: deriveHost(url),
                pageUrl: url,
                pageTitle: title,
                mode,
                dimensions: { width: outputWidth, height: outputHeight }
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
    for (let index = 0; index < urls.length; index += 1) {
        const url = urls[index];
        notify(onStatus, `Starting ${index + 1} of ${urls.length}`);
        const result = await captureSingle(url, { mode, cookie: options.cookie, onStatus });
        if (onCapture) {
            await onCapture(result);
        }
        await yieldToBrowser();
    }
}

