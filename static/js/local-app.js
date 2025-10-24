'use strict';

// assumes window.ScreenshotGallery.createGallery and window.html2canvas are loaded
const createGallery = window.ScreenshotGallery.createGallery;

const PROXY_ENDPOINT = 'https://testing2.funkpd.shop/cors.php';
const SITEMAP_ENDPOINT = './sitemap-proxy.php';
const SITEMAP_PAGE_LIMIT = 10;
const MAX_CAPTURE_HEIGHT = 6000;
const PREVIEW_SCALE = 0.25;
const EXPORT_MIME = 'image/webp';
const EXPORT_QUALITY = 0.7;

const VIEWPORTS = { mobile: 390, tablet: 834, desktop: 1920 };
const blobUrls = new Set();

function selectById(elementId) {
    const element = document.getElementById(elementId);
    if (!element) throw new Error(`#${elementId} missing`);
    return element;
}

function writeStatus(statusElement, message) {
    if (!statusElement) return;
    statusElement.textContent = message;
    statusElement.scrollTop = statusElement.scrollHeight;
}

function appendStatus(statusElement, message) {
    if (!statusElement) return;
    statusElement.textContent += `\n${message}`;
    statusElement.scrollTop = statusElement.scrollHeight;
}

function deriveHost(urlString) {
    if (!urlString) return '';
    const parsedUrl = new URL(urlString);
    return parsedUrl.hostname;
}

function resolveViewportWidth(mode) {
    const width = VIEWPORTS[mode];
    if (width) return width;
    return VIEWPORTS.desktop;
}

function disableForm(formElement, isDisabled) {
    const controls = Array.from(formElement.elements);
    for (const controlElement of controls) {
        controlElement.disabled = isDisabled;
    }
}

function createProxyUrl(targetUrl) {
    const encoded = encodeURIComponent(targetUrl);
    return `${PROXY_ENDPOINT}?url=${encoded}`;
}

async function fetchSnapshot(targetUrl) {
    const proxyUrl = createProxyUrl(targetUrl);
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error(`Proxy fetch failed (${response.status})`);
    const htmlText = await response.text();
    return htmlText;
}

function getVisualZoom() {
    const hasViewport = !!(window.visualViewport && typeof window.visualViewport.scale === 'number');
    if (!hasViewport) return 1;
    return window.visualViewport.scale || 1;
}

function cssWidthForTrue1920() {
    const zoomScale = getVisualZoom();
    if (zoomScale === 0) return 1920;
    const cssWidth = Math.round(1920 / zoomScale);
    return cssWidth;
}

function buildIframe(targetCssWidth) {
    const iframeElement = document.createElement('iframe');
    iframeElement.style.width = `${targetCssWidth}px`;
    iframeElement.style.height = '100px';
    iframeElement.style.visibility = 'hidden';
    iframeElement.style.display = 'block';
    iframeElement.style.border = '0';
    iframeElement.style.position = 'absolute';
    iframeElement.style.left = '0';
    iframeElement.style.top = '0';
    iframeElement.style.pointerEvents = 'none';
    iframeElement.setAttribute('width', String(targetCssWidth));
    iframeElement.setAttribute('height', '100');
    document.body.appendChild(iframeElement);
    return iframeElement;
}

function removeIframe(iframeElement) {
    if (!iframeElement) return;
    if (!iframeElement.parentNode) return;
    iframeElement.parentNode.removeChild(iframeElement);
}

function writeHtmlIntoFrame(iframeElement, htmlText) {
    const frameDocument = iframeElement.contentDocument;
    if (!frameDocument) throw new Error('Missing frame document');
    frameDocument.open();
    frameDocument.write(htmlText);
    frameDocument.close();
    return frameDocument;
}

function freezeAnimations(frameDocument) {
    const styleElement = frameDocument.createElement('style');
    styleElement.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}';
    const headElement = frameDocument.head || frameDocument.documentElement;
    headElement.appendChild(styleElement);
}

function forceFixedCssWidth(frameDocument, targetCssWidth) {
    const headElement = frameDocument.head || frameDocument.documentElement;
    const normalizeStyle = frameDocument.createElement('style');
    normalizeStyle.textContent =
        'html,body{margin:0;padding:0;overflow:visible!important;}' +
        `html{width:${targetCssWidth}px!important;max-width:none!important;min-width:0!important;}`;
    headElement.appendChild(normalizeStyle);
}

function computeCaptureBox(frameDocument) {
    const htmlElement = frameDocument.documentElement;
    const bodyElement = frameDocument.body;

    let widthHtml = 0;
    let widthBody = 0;
    let heightHtml = 0;
    let heightBody = 0;

    if (htmlElement) widthHtml = htmlElement.scrollWidth;
    if (bodyElement) widthBody = bodyElement.scrollWidth;
    if (htmlElement) heightHtml = htmlElement.scrollHeight;
    if (bodyElement) heightBody = bodyElement.scrollHeight;

    const cssWidth = Math.max(widthHtml, widthBody);
    const rawHeight = Math.max(heightHtml, heightBody);
    const cssHeight = rawHeight > MAX_CAPTURE_HEIGHT ? MAX_CAPTURE_HEIGHT : rawHeight;

    return { cssWidth, cssHeight };
}

async function renderPage(frameDocument, forcedCssWidth) {
    const html2canvasFactory = window.html2canvas;

    const box = computeCaptureBox(frameDocument);
    const cssWidth = box.cssWidth || forcedCssWidth;
    const cssHeight = box.cssHeight;

    const options = {
        backgroundColor: '#fff',
        useCORS: true,
        width: cssWidth,
        height: cssHeight,
        windowWidth: cssWidth,
        windowHeight: cssHeight,
        scrollX: 0,
        scrollY: 0,
        scale: 1,
        foreignObjectRendering: true
    };

    const baseCanvas = await html2canvasFactory(frameDocument.documentElement, options);

    const previewCanvas = document.createElement('canvas');
    previewCanvas.width = Math.round(baseCanvas.width * PREVIEW_SCALE);
    previewCanvas.height = Math.round(baseCanvas.height * PREVIEW_SCALE);

    const drawingContext = previewCanvas.getContext('2d');
    drawingContext.imageSmoothingEnabled = true;
    drawingContext.imageSmoothingQuality = 'high';
    drawingContext.drawImage(baseCanvas, 0, 0, previewCanvas.width, previewCanvas.height);

    baseCanvas.width = 0;
    baseCanvas.height = 0;
    return previewCanvas;
}

function exportCanvasBlob(canvasElement) {
    return new Promise((resolve, reject) => {
        canvasElement.toBlob(blobObject => {
            if (!blobObject) reject(new Error('Canvas export failed'));
            if (blobObject) resolve(blobObject);
        }, EXPORT_MIME, EXPORT_QUALITY);
    });
}

function releaseBlobUrls() {
    for (const blobUrl of blobUrls) {
        URL.revokeObjectURL(blobUrl);
    }
    blobUrls.clear();
}

async function capturePage(params) {
    appendStatus(params.statusElement, `→ Capture ${params.url} (${params.mode})`);
    const htmlText = await fetchSnapshot(params.url);

    const targetCssWidth = cssWidthForTrue1920();
    const iframeElement = buildIframe(targetCssWidth);

    try {
        const frameDocument = writeHtmlIntoFrame(iframeElement, htmlText);

        // hard-lock layout width irrespective of outer-page zoom
        forceFixedCssWidth(frameDocument, targetCssWidth);
        freezeAnimations(frameDocument);

        // allow layout to settle at the forced width
        await new Promise(resolve => requestAnimationFrame(resolve));

        const previewCanvas = await renderPage(frameDocument, targetCssWidth);
        const blobObject = await exportCanvasBlob(previewCanvas);
        const blobUrl = URL.createObjectURL(blobObject);
        blobUrls.add(blobUrl);

        params.gallery.append({
            host: deriveHost(params.url),
            mode: params.mode,
            pageUrl: params.url,
            imageUrl: blobUrl,
            blob: blobObject,
            dimensions: { width: previewCanvas.width, height: previewCanvas.height },
            mime: blobObject.type
        });

        previewCanvas.width = 0;
        previewCanvas.height = 0;
        appendStatus(params.statusElement, '✓ Done');
    } finally {
        removeIframe(iframeElement);
    }
}

async function fetchSitemapUrls(baseUrl, statusElement) {
    const endpointUrl = `${SITEMAP_ENDPOINT}?url=${encodeURIComponent(baseUrl)}`;
    const response = await fetch(endpointUrl);
    if (!response.ok) throw new Error(`Sitemap fetch failed (${response.status})`);
    const payload = await response.json();
    let list = [];
    if (Array.isArray(payload.sitemap)) list = payload.sitemap;
    if (list.length === 0) throw new Error('Empty sitemap');
    if (list.length > SITEMAP_PAGE_LIMIT) list = list.slice(0, SITEMAP_PAGE_LIMIT);
    appendStatus(statusElement, `✓ Sitemap ${list.length} url(s)`);
    return list;
}

function parseUrlInput(rawInput) {
    const trimmed = rawInput.trim();
    if (trimmed === '') return [];
    const parts = trimmed.split(/\s+/);
    const unique = new Set();
    for (const part of parts) {
        const isHttp = /^https?:\/\//i.test(part);
        if (isHttp) unique.add(part);
    }
    return Array.from(unique);
}

async function collectSitemapUrls(rawInput, statusElement) {
    const baseUrls = parseUrlInput(rawInput);
    const collected = [];
    for (const baseUrl of baseUrls) {
        if (collected.length >= SITEMAP_PAGE_LIMIT) break;
        const entries = await fetchSitemapUrls(baseUrl, statusElement);
        for (const entryUrl of entries) {
            const isHttp = /^https?:\/\//i.test(entryUrl);
            if (!isHttp) continue;
            collected.push(entryUrl);
            if (collected.length >= SITEMAP_PAGE_LIMIT) break;
        }
    }
    appendStatus(statusElement, `✓ Collected ${collected.length} url(s)`);
    return collected;
}

function resolveSelectedMode(modeNodeList) {
    const inputs = Array.from(modeNodeList);
    for (const inputElement of inputs) {
        if (inputElement.checked) return inputElement.value;
    }
    return 'desktop';
}

async function handleCapture(formElement, urlInputElement, modeNodeList, statusElement, galleryApi) {
    disableForm(formElement, true);
    writeStatus(statusElement, '');
    const urls = await collectSitemapUrls(urlInputElement.value, statusElement);
    const mode = resolveSelectedMode(modeNodeList);
    const width = resolveViewportWidth(mode);
    for (let index = 0; index < urls.length; index += 1) {
        await capturePage({ url: urls[index], mode, width, statusElement, gallery: galleryApi });
    }
    disableForm(formElement, false);
}

function init() {
    const formElement = selectById('capture-form');
    const urlInputElement = selectById('urlInput');
    const statusElement = selectById('sessionStatus');
    const galleryContainer = selectById('result');
    const clearGalleryButton = selectById('clearGalleryBtn');
    const modeNodeList = document.querySelectorAll('input[name="mode"]');
    const galleryApi = createGallery(galleryContainer);

    writeStatus(statusElement, `Idle. Ready. Max ${SITEMAP_PAGE_LIMIT} pages per session.`);

    clearGalleryButton.onclick = () => {
        releaseBlobUrls();
        galleryApi.clear();
        writeStatus(statusElement, 'Gallery cleared.');
    };

    formElement.onsubmit = async eventObject => {
        eventObject.preventDefault();
        await handleCapture(formElement, urlInputElement, modeNodeList, statusElement, galleryApi);
    };
}

window.addEventListener('beforeunload', releaseBlobUrls);

function boot() {
    const isLoading = document.readyState === 'loading';
    if (isLoading) {
        document.addEventListener('DOMContentLoaded', init);
        return;
    }
    init();
}

boot();
