import { createGallery } from 'app/gallery';

const PROXY_ENDPOINT = 'https://testing2.funkpd.shop/cors.php';
const FETCH_COOLDOWN_MS = 5000;
const VIEWPORTS = {
    mobile: 390,
    tablet: 834,
    desktop: 1920
};
const IMAGE_TIMEOUT_MS = 5000;

let nextFetchReadyAt = 0;

function selectById(id) {
    const element = document.getElementById(id);
    if (element) return element;
    throw new Error(`Missing element #${id}; fix template.`);
}

function writeStatus(target, message) {
    if (!target) return;
    target.textContent = message;
    target.scrollTop = target.scrollHeight;
}

function appendStatus(target, message, detail) {
    if (!target) return;
    const stamp = new Date().toISOString();
    let line = `[${stamp}] ${message}`;
    const hasDetail = typeof detail !== 'undefined';
    if (hasDetail) {
        let payload;
        try {
            payload = JSON.stringify(detail);
        } catch (error) {
            payload = '"[unserializable]"';
        }
        line = `${line} ${payload}`;
        console.log(line, detail);
    } else {
        console.log(line);
    }
    const existing = target.textContent;
    if (!existing) {
        target.textContent = line;
        target.scrollTop = target.scrollHeight;
        return;
    }
    target.textContent = `${existing}\n${line}`;
    target.scrollTop = target.scrollHeight;
}

function deriveHost(url) {
    if (!url) return '';
    try {
        const parsed = new URL(url);
        return parsed.hostname;
    } catch (error) {
        return '';
    }
}

function resolveViewportWidth(mode) {
    if (!mode) return VIEWPORTS.desktop;
    const lower = mode.toLowerCase();
    if (lower === 'mobile') return VIEWPORTS.mobile;
    if (lower === 'tablet') return VIEWPORTS.tablet;
    if (lower === 'desktop') return VIEWPORTS.desktop;
    return VIEWPORTS.desktop;
}

function readMode(radios) {
    if (!radios) return 'desktop';
    const list = Array.from(radios);
    for (const item of list) {
        if (!item) continue;
        if (!item.checked) continue;
        if (!item.value) return 'desktop';
        return item.value;
    }
    return 'desktop';
}

function disableForm(form, disabled) {
    if (!form) return;
    let controls = [];
    if (form.elements) controls = Array.from(form.elements);
    for (const control of controls) {
        if (!control) continue;
        control.disabled = disabled;
    }
}

function createProxyUrl(url) {
    const encoded = encodeURIComponent(url);
    return `${PROXY_ENDPOINT}?url=${encoded}`;
}

async function waitForNextFetchSlot(statusEl) {
    const now = Date.now();
    if (now >= nextFetchReadyAt) return;
    const waitMs = nextFetchReadyAt - now;
    appendStatus(statusEl, `→ Waiting ${waitMs}ms before proxy fetch`);
    await new Promise((resolve) => {
        window.setTimeout(resolve, waitMs);
    });
}

async function fetchSnapshot(url, statusEl) {
    await waitForNextFetchSlot(statusEl);
    const proxyUrl = createProxyUrl(url);
    appendStatus(statusEl, '→ Fetching snapshot', { proxyUrl });
    const startedAt = performance.now();
    const response = await fetch(proxyUrl);
    const elapsedMs = (performance.now() - startedAt).toFixed(1);
    appendStatus(statusEl, `✓ Fetch ${response.status} in ${elapsedMs} ms`);
    if (!response.ok) {
        appendStatus(statusEl, '❌ Proxy fetch failed', { status: response.status });
        throw new Error(`Proxy fetch failed; status ${response.status}.`);
    }
    const html = await response.text();
    appendStatus(statusEl, '✓ HTML bytes', { length: html.length });
    return html;
}

function buildIframe(width) {
    const frame = document.createElement('iframe');
    frame.width = width;
    frame.height = 100;
    frame.style.width = `${width}px`;
    frame.style.height = '100px';
    frame.style.visibility = 'hidden';
    frame.style.display = 'block';
    frame.style.border = '0';
    frame.style.position = 'absolute';
    frame.style.left = '-10000px';
    frame.style.top = '0';
    frame.style.pointerEvents = 'none';
    document.body.appendChild(frame);
    return frame;
}

function removeIframe(frame) {
    if (!frame) return;
    const parent = frame.parentNode;
    if (!parent) return;
    parent.removeChild(frame);
}

function writeHtmlIntoFrame(frame, html) {
    let doc = frame.contentDocument;
    if (!doc) {
        const win = frame.contentWindow;
        if (win) doc = win.document;
    }
    if (!doc) throw new Error('Iframe document missing; browser blocked frame.');
    doc.open();
    doc.write(html);
    doc.close();
    return doc;
}

function raf() {
    return new Promise((resolve) => {
        window.requestAnimationFrame(resolve);
    });
}

function freezeAnimations(doc) {
    const style = doc.createElement('style');
    style.textContent = `*,*::before,*::after{animation:none!important;transition:none!important}`;
    let target = doc.head;
    if (!target) target = doc.documentElement;
    if (!target) return;
    target.appendChild(style);
}

async function settleFonts(doc, statusEl) {
    const fonts = doc.fonts;
    if (!fonts) return;
    const ready = fonts.ready;
    if (!ready) return;
    try {
        await ready;
        appendStatus(statusEl, '✓ Fonts ready');
    } catch (error) {
        appendStatus(statusEl, '⚠ fonts.ready error');
    }
}

function settleSingleImage(image, index, statusEl) {
    return new Promise((resolve) => {
        if (!image) {
            resolve();
            return;
        }
        let src = image.currentSrc;
        if (!src) src = image.src;
        if (!src) src = '(no src)';
        const startedAt = performance.now();
        let settled = false;
        let timer = null;
        function finishSuccess(tag) {
            if (settled) return;
            settled = true;
            if (timer) window.clearTimeout(timer);
            const elapsed = performance.now() - startedAt;
            appendStatus(statusEl, `✓ img#${index} ${tag}`, { src, ms: elapsed.toFixed(1) });
            resolve();
        }
        function finishFailure(tag) {
            if (settled) return;
            settled = true;
            if (timer) window.clearTimeout(timer);
            appendStatus(statusEl, `⚠ img#${index} ${tag}`, { src });
            resolve();
        }
        if (image.complete) {
            const hasSize = image.naturalWidth > 0;
            if (hasSize) {
                finishSuccess('complete');
                return;
            }
        }
        timer = window.setTimeout(() => {
            finishFailure('timeout');
        }, IMAGE_TIMEOUT_MS);
        const canDecode = typeof image.decode === 'function';
        if (canDecode) {
            image.decode().then(() => {
                finishSuccess('decoded');
            }).catch(() => {
                finishFailure('decode error');
            });
            return;
        }
        image.addEventListener('load', () => {
            finishSuccess('load');
        }, { once: true });
        image.addEventListener('error', () => {
            finishFailure('error');
        }, { once: true });
    });
}

async function settleImages(doc, statusEl) {
    let images = [];
    if (doc.images) images = Array.from(doc.images);
    appendStatus(statusEl, `→ Decoding ${images.length} images (5s timeout each)`);
    const tasks = images.map((image, index) => settleSingleImage(image, index, statusEl));
    await Promise.all(tasks);
    appendStatus(statusEl, '✓ Image settle complete');
}

async function settleFrame(doc, statusEl) {
    freezeAnimations(doc);
    await raf();
    await raf();
    await settleFonts(doc, statusEl);
    await settleImages(doc, statusEl);
}

function auditGradients(doc, statusEl) {
    const nodes = doc.querySelectorAll('*');
    appendStatus(statusEl, '→ Auditing gradients');
    let seen = 0;
    for (const node of nodes) {
        if (!node) continue;
        const view = doc.defaultView;
        if (!view) return;
        const computed = view.getComputedStyle(node);
        if (!computed) continue;
        const background = computed.backgroundImage;
        if (!background) continue;
        const hasGradient = background.includes('gradient(');
        if (!hasGradient) continue;
        const preview = background.slice(0, 180);
        appendStatus(statusEl, 'gradient bg', {
            tag: node.tagName,
            className: node.className,
            background: `${preview}...`
        });
        seen += 1;
        if (seen >= 30) return;
    }
}

function measureViewport(frame, doc, statusEl) {
    const win = frame.contentWindow;
    const metrics = {
        innerWidth: null,
        clientWidth: null,
        bodyClient: null
    };
    if (win) metrics.innerWidth = win.innerWidth;
    const root = doc.documentElement;
    if (root) metrics.clientWidth = root.clientWidth;
    const body = doc.body;
    if (body) metrics.bodyClient = body.clientWidth;
    appendStatus(statusEl, 'Viewport metrics', metrics);
    return metrics;
}

function computePageHeight(doc, statusEl) {
    const root = doc.documentElement;
    if (!root) throw new Error('Snapshot missing documentElement; aborting.');
    const body = doc.body;
    const scrollHeight = root.scrollHeight;
    const offsetHeight = root.offsetHeight;
    let bodyScroll = 0;
    if (body) bodyScroll = body.scrollHeight;
    const height = Math.max(scrollHeight, offsetHeight, bodyScroll);
    appendStatus(statusEl, 'Computed doc height', { height });
    return height;
}

function ensureHtml2Canvas() {
    if (typeof window.html2canvas === 'function') return window.html2canvas;
    throw new Error('Missing html2canvas global; check script tag.');
}

async function renderWithFallback(doc, width, height, statusEl) {
    const html2canvas = ensureHtml2Canvas();
    const baseOptions = {
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: false,
        scale: 1,
        windowWidth: width,
        windowHeight: height,
        logging: true
    };
    appendStatus(statusEl, '→ html2canvas (canvas renderer) start');
    try {
        const canvas = await html2canvas(doc.documentElement, {
            ...baseOptions,
            foreignObjectRendering: false
        });
        appendStatus(statusEl, '✓ html2canvas (canvas) complete');
        return canvas;
    } catch (error) {
        let message = 'Unknown error';
        if (error) {
            if (error.message) message = error.message;
        }
        appendStatus(statusEl, '⚠ html2canvas (canvas) failed', { message });
        appendStatus(statusEl, '→ html2canvas (foreignObject) fallback start');
        const fallback = await html2canvas(doc.documentElement, {
            ...baseOptions,
            foreignObjectRendering: true
        });
        appendStatus(statusEl, '✓ html2canvas (foreignObject) complete');
        return fallback;
    }
}

function scheduleFetchCooldown(statusEl) {
    nextFetchReadyAt = Date.now() + FETCH_COOLDOWN_MS;
    appendStatus(statusEl, `→ Cooling down for ${FETCH_COOLDOWN_MS}ms before next fetch`);
}

function waitForIframeLoad(frame, statusEl) {
    return new Promise((resolve) => {
        let settled = false;
        const timer = window.setTimeout(() => {
            if (settled) return;
            settled = true;
            appendStatus(statusEl, '⚠ iframe load timeout (continuing)');
            resolve();
        }, 8000);
        frame.onload = () => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timer);
            appendStatus(statusEl, '✓ iframe onload');
            resolve();
        };
    });
}

async function capturePage(params) {
    const { url, mode, width, statusEl, gallery } = params;
    writeStatus(statusEl, '');
    appendStatus(statusEl, '→ Capture requested', { url, mode, width });
    const html = await fetchSnapshot(url, statusEl);
    appendStatus(statusEl, '→ Building iframe', { width });
    const frame = buildIframe(width);
    try {
        const doc = writeHtmlIntoFrame(frame, html);
        appendStatus(statusEl, '✓ HTML written to iframe');
        await waitForIframeLoad(frame, statusEl);
        await settleFrame(doc, statusEl);
        appendStatus(statusEl, '✓ Frame content settled');
        auditGradients(doc, statusEl);
        const metrics = measureViewport(frame, doc, statusEl);
        let mismatch = false;
        if (metrics.innerWidth !== width) mismatch = true;
        if (metrics.clientWidth !== width) mismatch = true;
        if (mismatch) {
            appendStatus(statusEl, '⚠ Viewport mismatch; reassert width', metrics);
            frame.width = width;
            frame.style.width = `${width}px`;
            await raf();
            await raf();
            measureViewport(frame, doc, statusEl);
        }
        const height = computePageHeight(doc, statusEl);
        frame.height = height;
        frame.style.height = `${height}px`;
        const canvas = await renderWithFallback(doc, width, height, statusEl);
        const dataUrl = canvas.toDataURL('image/png');
        let title = doc.title;
        if (!title) title = 'Captured page';
        const image = {
            host: deriveHost(url),
            mode,
            pageUrl: url,
            pageTitle: title,
            imageUrl: dataUrl,
            dimensions: { width, height }
        };
        gallery.append(image);
        appendStatus(statusEl, `✓ Done (${width} × ${height})`);
        scheduleFetchCooldown(statusEl);
    } finally {
        removeIframe(frame);
    }
}

function initSidebar(appShell, sidebar, toggleBtn, labelEl, iconEl) {
    function applyState(state) {
        appShell.dataset.sidebar = state;
        const expanded = state === 'expanded';
        toggleBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        sidebar.setAttribute('aria-hidden', expanded ? 'false' : 'true');
        if (labelEl) labelEl.textContent = expanded ? 'Hide controls' : 'Show controls';
        if (iconEl) iconEl.textContent = expanded ? '⟨' : '⟩';
    }

    let initial = appShell.dataset.sidebar;
    if (!initial) initial = 'expanded';
    let prefersCollapsed = false;
    if (window.matchMedia) {
        const query = window.matchMedia('(max-width: 960px)');
        if (query) {
            if (query.matches) prefersCollapsed = true;
        }
    }
    if (prefersCollapsed) initial = 'collapsed';
    applyState(initial);

    toggleBtn.addEventListener('click', () => {
        const current = appShell.dataset.sidebar;
        if (current === 'collapsed') {
            applyState('expanded');
            return;
        }
        applyState('collapsed');
    });
}

function validateUrl(value) {
    if (!value) throw new Error('Missing field url; add to form.');
    const trimmed = value.trim();
    const pattern = /^https?:\/\//i;
    if (!pattern.test(trimmed)) throw new Error('Invalid URL; include http or https prefix.');
    return trimmed;
}

async function handleCapture(form, urlInput, modeInputs, statusEl, gallery) {
    try {
        disableForm(form, true);
        const url = validateUrl(urlInput.value);
        const mode = readMode(modeInputs);
        const width = resolveViewportWidth(mode);
        await capturePage({ url, mode, width, statusEl, gallery });
    } catch (error) {
        console.error(error);
        let message = 'Capture failed; check console.';
        if (error) {
            if (error.message) message = error.message;
        }
        appendStatus(statusEl, `Error: ${message}`);
    } finally {
        disableForm(form, false);
    }
}

function init() {
    const form = selectById('capture-form');
    const urlInput = selectById('urlInput');
    const statusEl = selectById('sessionStatus');
    const galleryContainer = selectById('result');
    const newSessionBtn = selectById('newSessionBtn');
    const clearGalleryBtn = selectById('clearGalleryBtn');
    const appShell = document.querySelector('.app-shell');
    if (!appShell) throw new Error('Missing app shell; check layout.');
    const sidebar = selectById('sidebar');
    const sidebarToggleBtn = selectById('sidebarToggle');
    const sidebarToggleLabel = document.getElementById('sidebarToggleLabel');
    const sidebarToggleIcon = document.getElementById('sidebarToggleIcon');
    const modeInputs = document.querySelectorAll('input[name="mode"]');

    if (statusEl) {
        if (!statusEl.style.whiteSpace) statusEl.style.whiteSpace = 'pre-line';
        if (!statusEl.style.maxHeight) statusEl.style.maxHeight = '200px';
        if (!statusEl.style.overflowY) statusEl.style.overflowY = 'auto';
        if (!statusEl.style.paddingRight) statusEl.style.paddingRight = '8px';
    }

    const gallery = createGallery(galleryContainer);
    writeStatus(statusEl, 'Idle. Ready for local capture.');

    initSidebar(appShell, sidebar, sidebarToggleBtn, sidebarToggleLabel, sidebarToggleIcon);

    newSessionBtn.addEventListener('click', () => {
        gallery.clear();
        writeStatus(statusEl, 'Session reset.');
    });

    clearGalleryBtn.addEventListener('click', () => {
        gallery.clear();
        writeStatus(statusEl, 'Gallery cleared.');
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        await handleCapture(form, urlInput, modeInputs, statusEl, gallery);
    });
}

function patchAddColorStop() {
    try {
        const ctor = window.CanvasGradient;
        if (!ctor) return;
        const proto = ctor.prototype;
        if (!proto) return;
        if (proto.__patched__) return;
        const original = proto.addColorStop;
        if (!original) return;
        proto.addColorStop = function addColorStop(offset, color) {
            let value = Number(offset);
            if (!Number.isFinite(value)) value = 0;
            if (value < 0) value = 0;
            if (value > 1) value = 1;
            let finalColor = color;
            const isString = typeof finalColor === 'string';
            if (!isString) finalColor = 'rgba(0,0,0,0)';
            if (!finalColor) finalColor = 'rgba(0,0,0,0)';
            return original.call(this, value, finalColor);
        };
        proto.__patched__ = true;
        console.info('[local] Patched CanvasGradient.addColorStop guard.');
    } catch (error) {
        console.warn('[local] Failed to patch addColorStop (non-fatal).', error);
    }
}

patchAddColorStop();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
