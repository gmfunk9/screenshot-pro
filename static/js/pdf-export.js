var MAX_SLICE_HEIGHT = 12000;
var FILE_NAME = 'screenshotpro.pdf';
var MOBILE_SOURCE_WIDTH = 420;
var TABLET_SOURCE_WIDTH = 768;
var DESKTOP_SOURCE_WIDTH = 1920;
var MOBILE_PAGE_WIDTH = 595;
var TABLET_PAGE_WIDTH = 816;
var DESKTOP_PAGE_WIDTH = 1240;
function getButton() {
    return document.getElementById('downloadPdfBtn');
}
function getGrid() {
    return document.querySelector('.gallery__grid');
}
function collectImages() {
    var grid = getGrid();
    if (!grid) return [];
    var nodes = grid.querySelectorAll('img');
    var list = [];
    var index = 0;
    while (index < nodes.length) {
        list.push(nodes[index]);
        index += 1;
    }
    return list;
}
function readDatasetNumber(image, key) {
    if (!image) return 0;
    var dataset = image.dataset;
    if (!dataset) return 0;
    if (dataset[key] === undefined) return 0;
    var parsed = Number(dataset[key]);
    if (!Number.isFinite(parsed)) return 0;
    return parsed;
}
function readNaturalNumber(value) {
    if (!Number.isFinite(value)) return 0;
    return value;
}
function resolveSourceWidth(image) {
    var width = readDatasetNumber(image, 'sourceWidth');
    if (width > 0) return width;
    width = readNaturalNumber(image.naturalWidth);
    if (width > 0) return width;
    throw new Error('Image width unavailable; reload gallery.');
}
function resolveSourceHeight(image) {
    var height = readDatasetNumber(image, 'sourceHeight');
    if (height > 0) return height;
    height = readNaturalNumber(image.naturalHeight);
    if (height > 0) return height;
    throw new Error('Image height unavailable; reload gallery.');
}
function clampHeight(height) {
    if (!Number.isFinite(height)) return 0;
    if (height > MAX_SLICE_HEIGHT) return MAX_SLICE_HEIGHT;
    if (height < 0) return 0;
    return height;
}
function choosePageWidth(width) {
    if (!Number.isFinite(width)) return DESKTOP_PAGE_WIDTH;
    var bestWidth = DESKTOP_PAGE_WIDTH;
    var bestDiff = Math.abs(width - DESKTOP_SOURCE_WIDTH);
    var mobileDiff = Math.abs(width - MOBILE_SOURCE_WIDTH);
    if (mobileDiff < bestDiff) {
        bestWidth = MOBILE_PAGE_WIDTH;
        bestDiff = mobileDiff;
    }
    var tabletDiff = Math.abs(width - TABLET_SOURCE_WIDTH);
    if (tabletDiff < bestDiff) {
        bestWidth = TABLET_PAGE_WIDTH;
        bestDiff = tabletDiff;
    }
    return bestWidth;
}
function ensureImageReady(image) {
    if (!image) return Promise.resolve();
    if (image.complete) {
        if (image.naturalWidth > 0) return Promise.resolve();
        if (image.naturalHeight > 0) return Promise.resolve();
    }
    return new Promise(function (resolve) {
        function cleanup() {
            image.removeEventListener('load', onComplete);
            image.removeEventListener('error', onComplete);
        }
        function onComplete() {
            cleanup();
            resolve();
        }
        image.addEventListener('load', onComplete, { once: true });
        image.addEventListener('error', onComplete, { once: true });
    });
}
function waitForDecode(image) {
    if (!image) return Promise.resolve();
    var decode = image.decode;
    if (typeof decode !== 'function') return Promise.resolve();
    return decode.call(image).catch(function () {
        return undefined;
    });
}
function drawSlice(image, width, height) {
    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    var context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas context missing for PDF export.');
    context.drawImage(image, 0, 0, width, height, 0, 0, width, height);
    var dataUrl = canvas.toDataURL('image/png');
    if (typeof dataUrl !== 'string') throw new Error('Failed to encode canvas for PDF export.');
    return dataUrl;
}
function dataUrlToUint8(dataUrl) {
    if (!dataUrl) throw new Error('Missing image data for PDF export.');
    var commaIndex = dataUrl.indexOf(',');
    if (commaIndex < 0) throw new Error('Invalid data URL for PDF export.');
    var base64 = dataUrl.slice(commaIndex + 1);
    var binary = window.atob(base64);
    var length = binary.length;
    var bytes = new Uint8Array(length);
    var index = 0;
    while (index < length) {
        bytes[index] = binary.charCodeAt(index);
        index += 1;
    }
    return bytes;
}
function buildDownloadLink(bytes) {
    var blob = new Blob([bytes], { type: 'application/pdf' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = FILE_NAME;
    return link;
}
function triggerDownload(bytes) {
    var link = buildDownloadLink(bytes);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(function () {
        URL.revokeObjectURL(link.href);
    }, 5000);
}
function computeMetrics(image) {
    var sourceWidth = resolveSourceWidth(image);
    var sourceHeight = resolveSourceHeight(image);
    var sliceHeight = clampHeight(sourceHeight);
    if (sliceHeight === 0) throw new Error('Image height invalid; reload gallery.');
    var pageWidth = choosePageWidth(sourceWidth);
    return {
        sourceWidth: sourceWidth,
        sliceHeight: sliceHeight,
        pageWidth: pageWidth
    };
}
async function addImagePage(pdfDoc, image) {
    var metrics = computeMetrics(image);
    var dataUrl = drawSlice(image, metrics.sourceWidth, metrics.sliceHeight);
    var bytes = dataUrlToUint8(dataUrl);
    var embedded = await pdfDoc.embedPng(bytes);
    var scale = metrics.pageWidth / metrics.sourceWidth;
    var pageHeight = metrics.sliceHeight * scale;
    var page = pdfDoc.addPage([metrics.pageWidth, pageHeight]);
    page.drawImage(embedded, {
        x: 0,
        y: 0,
        width: metrics.pageWidth,
        height: pageHeight
    });
    return {
        sourceWidth: metrics.sourceWidth,
        sliceHeight: metrics.sliceHeight,
        pageWidth: metrics.pageWidth,
        pageHeight: pageHeight
    };
}
async function buildPdf(images) {
    var pdfDoc = await window.PDFLib.PDFDocument.create();
    var metricsList = [];
    var index = 0;
    while (index < images.length) {
        var image = images[index];
        await ensureImageReady(image);
        await waitForDecode(image);
        var metrics = await addImagePage(pdfDoc, image);
        metricsList.push(metrics);
        index += 1;
    }
    var bytes = await pdfDoc.save();
    return {
        bytes: bytes,
        metrics: metricsList
    };
}
function emitExport(bytes, metrics, count) {
    if (typeof window.CustomEvent !== 'function') return;
    var detail = {
        bytes: bytes,
        metrics: metrics,
        count: count
    };
    var event = new CustomEvent('screenshotpro:pdf-ready', { detail: detail });
    document.dispatchEvent(event);
}
async function handleClick() {
    var images = collectImages();
    if (images.length === 0) {
        console.info('[pdf-export] No gallery images to export.');
        return;
    }
    if (!window.PDFLib) {
        console.error('[pdf-export] pdf-lib missing; check CDN.');
        return;
    }
    try {
        var result = await buildPdf(images);
        triggerDownload(result.bytes);
        emitExport(result.bytes, result.metrics, images.length);
    } catch (error) {
        console.error('[pdf-export] Export failed: ' + error.message);
    }
}
function init() {
    var button = getButton();
    if (!button) return;
    button.addEventListener('click', handleClick);
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
}
init();
