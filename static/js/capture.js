const VIEWPORTS = { mobile: 390, tablet: 834, desktop: 1920 };
const PROXY_ENDPOINT = '/proxy';

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

async function renderCanvas(doc, width, height) {
    const factory = ensureHtml2Canvas();
    const baseOptions = {
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: false,
        scale: 1,
        windowWidth: width,
        windowHeight: height
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
    const html = await fetchSnapshot(url, options.cookie, onStatus);
    const width = computeViewportWidth(options.mode);
    const frame = createFrame(width);
    try {
        const doc = writeFrameHtml(frame, html);
        await waitForLoad(frame);
        await raf();
        await raf();
        await settleFonts(doc);
        const height = computePageHeight(doc);
        frame.height = height;
        frame.style.height = `${height}px`;
        const canvas = await renderCanvas(doc, width, height);
        const dataUrl = canvas.toDataURL('image/png');
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
                dimensions: { width, height }
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
    }
}

