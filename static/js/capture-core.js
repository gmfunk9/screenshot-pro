const MAX_CAPTURE_HEIGHT = 6000;
const PREVIEW_SCALE = 0.25;
const EXPORT_MIME = 'image/webp';
const EXPORT_QUALITY = 0.7;
const blobUrls = new Set();

function computeCaptureBox(doc) {
    const html = doc.documentElement;
    const body = doc.body;
    const cssWidth = Math.max(html.scrollWidth, body.scrollWidth);
    const rawHeight = Math.max(html.scrollHeight, body.scrollHeight);
    const cssHeight = rawHeight > MAX_CAPTURE_HEIGHT ? MAX_CAPTURE_HEIGHT : rawHeight;
    return { cssWidth, cssHeight };
}

async function renderPage(doc, forcedWidth) {
    const box = computeCaptureBox(doc);
    const cssWidth = box.cssWidth || forcedWidth;
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

    const canvas = await window.html2canvas(doc.documentElement, options);
    const preview = document.createElement('canvas');
    preview.width = Math.round(canvas.width * PREVIEW_SCALE);
    preview.height = Math.round(canvas.height * PREVIEW_SCALE);
    const ctx = preview.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, preview.width, preview.height);
    canvas.width = 0;
    canvas.height = 0;
    return preview;
}

function exportCanvasBlob(canvas) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('Canvas export failed')), EXPORT_MIME, EXPORT_QUALITY);
    });
}

function releaseBlobUrls() {
    for (const u of blobUrls) URL.revokeObjectURL(u);
    blobUrls.clear();
}

async function capturePage(params) {
    appendStatus(params.statusEl, `→ Capture ${params.url} (${params.mode})`);
    const html = await fetchSnapshot(params.url);
    const width = cssWidthForTrue1920();
    const iframe = buildIframe(width);

    try {
        const doc = writeHtmlIntoFrame(iframe, html);
        forceFixedCssWidth(doc, width);
        freezeAnimations(doc);
        await new Promise(r => requestAnimationFrame(r));
        const preview = await renderPage(doc, width);
        const blob = await exportCanvasBlob(preview);
        const blobUrl = URL.createObjectURL(blob);
        blobUrls.add(blobUrl);
        params.gallery.append({
            host: new URL(params.url).hostname,
            mode: params.mode,
            pageUrl: params.url,
            imageUrl: blobUrl,
            blob,
            dimensions: { width: preview.width, height: preview.height },
            mime: blob.type
        });
        preview.width = 0;
        preview.height = 0;
        appendStatus(params.statusEl, '✓ Done');
    } finally {
        removeIframe(iframe);
    }
}
