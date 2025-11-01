// capture-page.js — stable version using parent html2canvas instance.
// Works with CORS proxy, lazy loaders, and human-gated pages.

const MAX_CAPTURE_HEIGHT = 6000;
const PREVIEW_SCALE = 0.25;
const EXPORT_MIME = 'image/webp';
const EXPORT_QUALITY = 0.7;
const blobUrls = new Set();

const MODE_VIEWPORT_WIDTHS = {
    desktop: 1920,
    tablet: 768,
    mobile: 420
};

function getUsage() {
    return window.ScreenshotGallery?.usage || null;
}

function waitForDelay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function appendStatus(target, message) {
    if (!target) return;
    const line = document.createElement('div');
    line.textContent = message;
    target.appendChild(line);
    target.scrollTop = target.scrollHeight;
}

function cssWidthForTrue1920(baseWidth = 1920) {
    if (!baseWidth) return 1920;
    return baseWidth;
}

function buildIframe(targetCssWidth) {
    const iframe = document.createElement('iframe');
    iframe.style.width = `${targetCssWidth}px`;
    iframe.style.height = `${MAX_CAPTURE_HEIGHT}px`;
    iframe.style.visibility = 'hidden';
    iframe.style.display = 'block';
    iframe.style.border = '0';
    iframe.style.position = 'absolute';
    iframe.style.left = '0';
    iframe.style.top = '0';
    iframe.style.pointerEvents = 'none';
    iframe.setAttribute('width', String(targetCssWidth));
    iframe.setAttribute('height', String(MAX_CAPTURE_HEIGHT));
    iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts');
    document.body.appendChild(iframe);
    return iframe;
}

function removeIframe(iframe) {
    if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
}

function writeHtmlIntoFrame(iframe, htmlContent) {
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    iframe.src = blobUrl;
    return new Promise(resolve => {
        iframe.onload = () => {
            const doc = iframe.contentDocument;
            resolve(doc);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
        };
    });
}

function freezeAnimations(doc) {
    const style = doc.createElement('style');
    style.textContent = '*,*::before,*::after{animation:none!important;transition:none!important;}';
    (doc.head || doc.documentElement).appendChild(style);
}

function forceFixedCssWidth(doc, targetWidth) {
    const style = doc.createElement('style');
    style.textContent = `
        html,body{margin:0;padding:0;overflow:visible!important;}
        html{width:${targetWidth}px!important;max-width:none!important;min-width:0!important;}
    `;
    (doc.head || doc.documentElement).appendChild(style);
}

function hideEmbeds(doc) {
    const style = doc.createElement('style');
    style.textContent = 'iframe, video {display:none!important;visibility:hidden!important;}';
    (doc.head || doc.documentElement).appendChild(style);
}

function simulateHumanInteraction(doc) {
    if (!doc || !doc.body) return;
    const target = doc.body;
    const fire = (type, init) => target.dispatchEvent(new Event(type, init));
    target.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 5, clientY: 5 }));
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 5, clientY: 5 }));
    target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 5, clientY: 5 }));
    target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' }));
    target.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Tab' }));
}

async function waitForPageReady(iframeWindow, timeoutMs = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            if (iframeWindow.__FUNKPD_CAPTURE_READY) return true;
        } catch (_) {}
        await waitForDelay(1000);
    }
    return false;
}

async function waitForImagesComplete(doc, timeoutMs = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        let allLoaded = true;
        for (const img of doc.images) {
            if (!img.complete || img.naturalWidth === 0) { allLoaded = false; break; }
        }
        if (allLoaded) break;
        await waitForDelay(150);
    }
}

function computeCaptureBox(doc) {
    const html = doc.documentElement;
    const body = doc.body;
    const width = Math.max(html.scrollWidth, body.scrollWidth, html.clientWidth);
    const rawHeight = Math.max(html.scrollHeight, body.scrollHeight, html.clientHeight);
    const height = Math.min(rawHeight, MAX_CAPTURE_HEIGHT);
    return { cssWidth: width, cssHeight: height };
}

async function renderPageFromParent(doc, forcedWidth) {
    const box = computeCaptureBox(doc);
    const cssWidth = box.cssWidth || forcedWidth;
    const cssHeight = box.cssHeight;

    const opts = {
        backgroundColor: '#fff',
        useCORS: true,
        allowTaint: true,
        foreignObjectRendering: true,
        width: cssWidth,
        height: cssHeight,
        windowWidth: cssWidth,
        windowHeight: cssHeight,
        scrollX: 0,
        scrollY: 0,
        scale: 1
    };

    // call parent's html2canvas, not iframe's
    const fullCanvas = await window.html2canvas(doc.documentElement, opts);

    const previewCanvas = document.createElement('canvas');
    const previewWidth = Math.round(fullCanvas.width * PREVIEW_SCALE);
    const previewHeight = Math.round(fullCanvas.height * PREVIEW_SCALE);
    previewCanvas.width = previewWidth;
    previewCanvas.height = previewHeight;

    const ctx = previewCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(fullCanvas, 0, 0, previewWidth, previewHeight);

    fullCanvas.width = 0;
    fullCanvas.height = 0;

    return previewCanvas;
}

function exportCanvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            blob => blob ? resolve(blob) : reject(new Error('Canvas export failed')),
            EXPORT_MIME,
            EXPORT_QUALITY
        );
    });
}

async function capturePage(captureParams) {
    const { statusEl, url, mode, gallery } = captureParams;
    const usage = getUsage();

    const baseViewportWidth = MODE_VIEWPORT_WIDTHS[mode] || 1920;
    const iframeWidth = cssWidthForTrue1920(baseViewportWidth);

    let iframeElement = null;
    let captureError = null;
    let captureSucceeded = false;

    appendStatus(statusEl, `→ Capture ${url} (${mode})`);

    try {
        const htmlContent = await fetchSnapshot(url);
        iframeElement = buildIframe(iframeWidth);

        const iframeDocument = await writeHtmlIntoFrame(iframeElement, htmlContent);
        const iframeWindow = iframeElement.contentWindow;

        await waitForPageReady(iframeWindow, 10000);

        forceFixedCssWidth(iframeDocument, iframeWidth);
        // freezeAnimations(iframeDocument);
        // hideEmbeds(iframeDocument);

        await waitForDelay(5000);
        if (iframeDocument.fonts?.ready) {
            try { await iframeDocument.fonts.ready; } catch (_) {}
        }
        // await waitForImagesComplete(iframeDocument, 4000);

        await waitForDelay(5000);
        simulateHumanInteraction(iframeDocument);
        await waitForDelay(5000);
        
        const previewCanvas = await renderPageFromParent(iframeDocument, iframeWidth);
        await waitForDelay(5000);
        const imageBlob = await exportCanvasToBlob(previewCanvas);
        const objectUrl = URL.createObjectURL(imageBlob);
        blobUrls.add(objectUrl);

        const hostName = new URL(url).hostname;
        const captureDimensions = { width: previewCanvas.width, height: previewCanvas.height };

        gallery.append({
            host: hostName,
            mode,
            pageUrl: url,
            imageUrl: objectUrl,
            blob: imageBlob,
            dimensions: captureDimensions,
            mime: imageBlob.type
        });

        previewCanvas.width = 0;
        previewCanvas.height = 0;
        appendStatus(statusEl, '✓ Done');
        captureSucceeded = true;
    } catch (error) {
        captureError = error;
        appendStatus(statusEl, `✗ Error: ${error.message || error}`);
        throw error;
    } finally {
        if (iframeElement) removeIframe(iframeElement);
        if (!usage) return;
        if (captureSucceeded) {
            usage.recordUsage('capture-page', { pageUrl: url, mode });
        } else {
            usage.recordUsage('capture-page-error', {
                pageUrl: url,
                mode,
                message: captureError ? captureError.message : 'Unknown error'
            });
        }
    }
}
