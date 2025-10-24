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
    const iframe = document.createElement('iframe');
    Object.assign(iframe.style, {
        width: `${targetCssWidth}px`,
        height: '100px',
        visibility: 'hidden',
        display: 'block',
        border: '0',
        position: 'absolute',
        left: '0',
        top: '0',
        pointerEvents: 'none'
    });
    iframe.setAttribute('width', String(targetCssWidth));
    iframe.setAttribute('height', '100');
    document.body.appendChild(iframe);
    return iframe;
}

function removeIframe(iframe) {
    if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
}

function writeHtmlIntoFrame(iframe, html) {
    const doc = iframe.contentDocument;
    if (!doc) throw new Error('Missing frame document');
    doc.open();
    doc.write(html);
    doc.close();
    return doc;
}

function freezeAnimations(doc) {
    const style = doc.createElement('style');
    style.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}';
    (doc.head || doc.documentElement).appendChild(style);
}

function forceFixedCssWidth(doc, width) {
    const style = doc.createElement('style');
    style.textContent =
        'html,body{margin:0;padding:0;overflow:visible!important;}' +
        `html{width:${width}px!important;max-width:none!important;min-width:0!important;}`;
    (doc.head || doc.documentElement).appendChild(style);
}
