function getVisualZoom() {
    const hasVisualViewport = !!(window.visualViewport && typeof window.visualViewport.scale === 'number');
    if (!hasVisualViewport) {
        return 1;
    }
    const viewportScale = window.visualViewport.scale;
    if (viewportScale) {
        return viewportScale;
    }
    return 1;
}
function cssWidthForTrue1920(baseWidth = 1920) {
    const zoomFactor = getVisualZoom();
    if (zoomFactor === 0) {
        return baseWidth;
    }
    const calculatedCssWidth = Math.round(baseWidth / zoomFactor);
    return calculatedCssWidth;
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

    // *** CRITICAL ***
    // allow same-origin and script execution inside Blob frame
    iframeElement.setAttribute('sandbox', 'allow-same-origin allow-scripts');

    document.body.appendChild(iframeElement);
    return iframeElement;
}

function removeIframe(iframeElement) {
    if (!iframeElement) {
        return;
    }
    const parentNode = iframeElement.parentNode;
    if (parentNode) {
        parentNode.removeChild(iframeElement);
    }
}
function writeHtmlIntoFrame(iframe, htmlContent) {
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    iframe.src = blobUrl;
    return new Promise(resolve => {
        iframe.onload = () => {
            const doc = iframe.contentDocument;
            resolve(doc);
            // optional: revoke later to free memory
            setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
        };
    });
}

function freezeAnimations(document) {
    const styleElement = document.createElement('style');
    styleElement.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}';
    const headElement = document.head;
    let appendTarget;
    if (headElement) {
        appendTarget = headElement;
    } else {
        appendTarget = document.documentElement;
    }
    appendTarget.appendChild(styleElement);
}
function forceFixedCssWidth(document, targetWidth) {
    const styleElement = document.createElement('style');
    const baseStyles = 'html,body{margin:0;padding:0;overflow:visible!important;}';
    const widthStyles = `html{width:${targetWidth}px!important;max-width:none!important;min-width:0!important;}`;
    styleElement.textContent = baseStyles + widthStyles;
    const headElement = document.head;
    let appendTarget;
    if (headElement) {
        appendTarget = headElement;
    } else {
        appendTarget = document.documentElement;
    }
    appendTarget.appendChild(styleElement);
}