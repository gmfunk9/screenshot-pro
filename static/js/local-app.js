import { createGallery } from 'app/gallery';

const PROXY_ENDPOINT = 'https://testing2.funkpd.shop/cors.php';
const FETCH_COOLDOWN_MS = 300000;
const VIEWPORTS = {
    mobile: 390,
    tablet: 834,
    desktop: 1920
};

let nextFetchReadyAt = 0;

function selectById(id) {
    const element = document.getElementById(id);
    if (element) return element;
    throw new Error(`Missing element #${id}; fix template.`);
}

function setStatus(target, message) {
    if (!target) return;
    target.textContent = message;
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

function buildIframe(width) {
    const frame = document.createElement('iframe');
    frame.style.position = 'absolute';
    frame.style.left = '-10000px';
    frame.style.top = '0';
    frame.style.border = 'none';
    frame.style.width = `${width}px`;
    frame.style.opacity = '0';
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
    const doc = frame.contentDocument;
    if (!doc) throw new Error('Iframe document missing; browser blocked frame.');
    doc.open();
    doc.write(html);
    doc.close();
    return doc;
}

function appendViewportStyle(doc, width) {
    const style = doc.createElement('style');
    style.textContent = `html, body { margin:0 !important; padding:0 !important; width:${width}px !important; min-width:${width}px !important; }
*, *::before, *::after { animation:none !important; transition:none !important; }`;
    let target = doc.head;
    if (!target) target = doc.documentElement;
    if (!target) throw new Error('Unable to apply viewport style; missing head and root.');
    target.appendChild(style);
}

function waitNextFrame() {
    return new Promise((resolve) => {
        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(resolve);
        });
    });
}

async function settleFrameContent(doc, width) {
    appendViewportStyle(doc, width);
    await waitNextFrame();
    if (doc.fonts) {
        const ready = doc.fonts.ready;
        if (ready) {
            try {
                await ready;
            } catch (error) {
                // ignore font settle errors
            }
        }
    }
    let imageList = [];
    if (doc.images) imageList = Array.from(doc.images);
    const promises = imageList.map((image) => {
        if (!image) return Promise.resolve();
        if (!image.decode) return Promise.resolve();
        return image.decode().catch(() => {});
    });
    await Promise.all(promises);
}

function computePageHeight(doc) {
    const root = doc.documentElement;
    if (!root) throw new Error('Snapshot missing documentElement; aborting.');
    const heights = [];
    heights.push(root.scrollHeight);
    heights.push(root.offsetHeight);
    const body = doc.body;
    if (body) heights.push(body.scrollHeight);
    return Math.max(...heights);
}

function ensureHtml2Canvas() {
    if (typeof window.html2canvas === 'function') return window.html2canvas;
    throw new Error('Missing html2canvas global; check script tag.');
}

async function renderCanvas(doc, width, height) {
    const html2canvas = ensureHtml2Canvas();
    return html2canvas(doc.documentElement, {
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: false,
        scale: 1,
        windowWidth: width,
        windowHeight: height,
        foreignObjectRendering: true
    });
}

function scheduleFetchCooldown() {
    nextFetchReadyAt = Date.now() + FETCH_COOLDOWN_MS;
    console.info(`[local] Cooling down for ${FETCH_COOLDOWN_MS}ms before next fetch.`);
}

async function waitForNextFetchSlot() {
    const now = Date.now();
    if (now >= nextFetchReadyAt) return;
    const waitMs = nextFetchReadyAt - now;
    console.info(`[local] Waiting ${waitMs}ms before proxy fetch.`);
    await new Promise((resolve) => {
        window.setTimeout(resolve, waitMs);
    });
}

async function fetchSnapshot(url) {
    await waitForNextFetchSlot();
    const proxyUrl = createProxyUrl(url);
    console.info('[local] Fetching snapshot via proxy.', { url, proxyUrl });
    const response = await fetch(proxyUrl);
    if (!response.ok) {
        console.error('[local] Proxy fetch failed.', { status: response.status, url });
        throw new Error(`Proxy fetch failed; status ${response.status}.`);
    }
    const text = await response.text();
    console.info('[local] Snapshot fetched.', { url, bytes: text.length });
    return text;
}

function validateUrl(value) {
    if (!value) throw new Error('Missing field url; add to form.');
    const trimmed = value.trim();
    if (!/^https?:\/\//i.test(trimmed)) throw new Error('Invalid URL; include http or https prefix.');
    return trimmed;
}

async function capturePage(params) {
    const { url, mode, width, statusEl, gallery } = params;
    console.info('[local] Capture requested.', { url, mode, width });
    setStatus(statusEl, 'Fetching pre-inlined snapshot via proxy…');
    const html = await fetchSnapshot(url);
    setStatus(statusEl, 'Rendering snapshot in hidden iframe…');
    const frame = buildIframe(width);
    try {
        const doc = writeHtmlIntoFrame(frame, html);
        console.info('[local] Snapshot written to iframe.', { url, mode });
        await settleFrameContent(doc, width);
        console.info('[local] Frame content settled.', { url });
        const height = computePageHeight(doc);
        frame.style.height = `${height}px`;
        setStatus(statusEl, 'Capturing screenshot via html2canvas…');
        const canvas = await renderCanvas(doc, width, height);
        console.info('[local] Canvas rendered.', { url, width, height });
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
        console.info('[local] Capture stored in gallery.', { url, mode });
        setStatus(statusEl, `Screenshot complete (${width} × ${height}).`);
        scheduleFetchCooldown();
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
        if (query && query.matches) prefersCollapsed = true;
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

    const gallery = createGallery(galleryContainer);
    setStatus(statusEl, 'Idle. Ready for local capture.');

    initSidebar(appShell, sidebar, sidebarToggleBtn, sidebarToggleLabel, sidebarToggleIcon);

    newSessionBtn.addEventListener('click', () => {
        gallery.clear();
        setStatus(statusEl, 'Session reset.');
    });

    clearGalleryBtn.addEventListener('click', () => {
        gallery.clear();
        setStatus(statusEl, 'Gallery cleared.');
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
            disableForm(form, true);
            const url = validateUrl(urlInput.value);
            const mode = readMode(modeInputs);
            const width = resolveViewportWidth(mode);
            await capturePage({ url, mode, width, statusEl, gallery });
        } catch (error) {
            console.error(error);
            const message = error && error.message ? error.message : 'Capture failed; check console.';
            setStatus(statusEl, `Error: ${message}`);
        } finally {
            disableForm(form, false);
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
