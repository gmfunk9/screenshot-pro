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
function computeCaptureBox(document) {
    const htmlElement = document.documentElement;
    const bodyElement = document.body;
    const computedWidth = Math.max(htmlElement.scrollWidth, bodyElement.scrollWidth);
    const rawComputedHeight = Math.max(htmlElement.scrollHeight, bodyElement.scrollHeight);
    let computedHeight;
    if (rawComputedHeight > MAX_CAPTURE_HEIGHT) {
        computedHeight = MAX_CAPTURE_HEIGHT;
    } else {
        computedHeight = rawComputedHeight;
    }
    return {
        cssWidth: computedWidth,
        cssHeight: computedHeight
    };
}
async function renderPage(document, forcedWidth) {
    const captureBox = computeCaptureBox(document);
    let cssWidthValue;
    if (captureBox.cssWidth) {
        cssWidthValue = captureBox.cssWidth;
    } else {
        cssWidthValue = forcedWidth;
    }
    const cssHeightValue = captureBox.cssHeight;
    const renderingOptions = {
        backgroundColor: '#fff',
        useCORS: true,
        width: cssWidthValue,
        height: cssHeightValue,
        windowWidth: cssWidthValue,
        windowHeight: cssHeightValue,
        scrollX: 0,
        scrollY: 0,
        scale: 1,
        foreignObjectRendering: true
    };
    const fullCanvas = await window.html2canvas(document.documentElement, renderingOptions);
    const previewCanvas = document.createElement('canvas');
    const previewWidth = Math.round(fullCanvas.width * PREVIEW_SCALE);
    previewCanvas.width = previewWidth;
    const previewHeight = Math.round(fullCanvas.height * PREVIEW_SCALE);
    previewCanvas.height = previewHeight;
    const canvasContext = previewCanvas.getContext('2d');
    canvasContext.imageSmoothingEnabled = true;
    canvasContext.imageSmoothingQuality = 'high';
    canvasContext.drawImage(fullCanvas, 0, 0, previewWidth, previewHeight);
    fullCanvas.width = 0;
    fullCanvas.height = 0;
    return previewCanvas;
}
function exportCanvasToBlob(canvasElement) {
    return new Promise((resolve, reject) => {
        canvasElement.toBlob(
            function(blob) {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Canvas export failed'));
                }
            },
            EXPORT_MIME,
            EXPORT_QUALITY
        );
    });
}
async function capturePage(captureParams) {
    const statusElement = captureParams.statusEl;
    const url = captureParams.url;
    const mode = captureParams.mode;
    const gallery = captureParams.gallery;
    appendStatus(statusElement, `→ Capture ${url} (${mode})`);
    const htmlContent = await fetchSnapshot(url);
    const baseViewportWidth = MODE_VIEWPORT_WIDTHS[mode] || 1920;
    const iframeWidth = cssWidthForTrue1920(baseViewportWidth);
    const iframeElement = buildIframe(iframeWidth);
    try {
        const iframeDocument = writeHtmlIntoFrame(iframeElement, htmlContent);
        forceFixedCssWidth(iframeDocument, iframeWidth);
        freezeAnimations(iframeDocument);
        await new Promise(resolveFunction => requestAnimationFrame(resolveFunction));
        const previewCanvas = await renderPage(iframeDocument, iframeWidth);
        const imageBlob = await exportCanvasToBlob(previewCanvas);
        const objectUrl = URL.createObjectURL(imageBlob);
        blobUrls.add(objectUrl);
        const urlObject = new URL(url);
        const hostName = urlObject.hostname;
        gallery.append({
            host: hostName,
            mode: mode,
            pageUrl: url,
            imageUrl: objectUrl,
            blob: imageBlob,
            dimensions: {
                width: previewCanvas.width,
                height: previewCanvas.height
            },
            mime: imageBlob.type
        });
        previewCanvas.width = 0;
        previewCanvas.height = 0;
        appendStatus(statusElement, '✓ Done');
    } finally {
        removeIframe(iframeElement);
    }
}