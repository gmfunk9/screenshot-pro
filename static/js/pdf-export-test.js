(function () {
    'use strict';

    var EVENT_NAME = 'screenshotpro:pdf-ready';
    var LOG_PREFIX = '[pdf-export] ';
    var MAX_SLICE_HEIGHT = 12000;
    var MOBILE_SOURCE_WIDTH = 420;
    var TABLET_SOURCE_WIDTH = 768;
    var DESKTOP_SOURCE_WIDTH = 1920;
    var MOBILE_PAGE_WIDTH = 595;
    var TABLET_PAGE_WIDTH = 816;
    var DESKTOP_PAGE_WIDTH = 1240;

    function logFail(message) {
        console.error(LOG_PREFIX + 'FAIL: ' + message);
    }

    function logOk() {
        console.log(LOG_PREFIX + 'OK');
    }

    function ensurePdfLib() {
        if (!window.PDFLib) throw new Error('pdf-lib unavailable for PDF validation.');
        return window.PDFLib;
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

    function verifyMetricsShape(metrics, count) {
        if (metrics.length !== count) throw new Error('Metrics count mismatch; rebuild export.');
        var index = 0;
        while (index < metrics.length) {
            var metric = metrics[index];
            var pageNumber = index + 1;
            if (!metric) throw new Error('Missing metrics for page ' + pageNumber + '.');
            if (!Number.isFinite(metric.sourceWidth)) throw new Error('Missing source width for page ' + pageNumber + '.');
            if (!Number.isFinite(metric.sliceHeight)) throw new Error('Missing slice height for page ' + pageNumber + '.');
            if (!Number.isFinite(metric.pageWidth)) throw new Error('Missing page width for page ' + pageNumber + '.');
            if (!Number.isFinite(metric.pageHeight)) throw new Error('Missing page height for page ' + pageNumber + '.');
            index += 1;
        }
    }

    function verifyPageContent(pdfLib, pages) {
        var xObjectName = pdfLib.PDFName.of('XObject');
        var index = 0;
        while (index < pages.length) {
            var page = pages[index];
            var pageNumber = index + 1;
            var resources = page.node.Resources();
            if (!resources) throw new Error('Page ' + pageNumber + ' missing resource dictionary.');
            var xObjects = resources.lookup(xObjectName);
            if (!xObjects) throw new Error('Page ' + pageNumber + ' missing image resources.');
            if (!(xObjects instanceof pdfLib.PDFDict)) throw new Error('Page ' + pageNumber + ' has invalid XObject resources.');
            if (xObjects.size === 0) throw new Error('Page ' + pageNumber + ' has no drawn content.');
            index += 1;
        }
    }

    function verifyPageDimensions(pages, metrics) {
        var index = 0;
        while (index < pages.length) {
            var page = pages[index];
            var metric = metrics[index];
            var pageNumber = index + 1;
            var expectedWidth = choosePageWidth(metric.sourceWidth);
            var mappedDiff = Math.abs(metric.pageWidth - expectedWidth);
            if (mappedDiff > 0.5) throw new Error('Page ' + pageNumber + ' width mapping incorrect.');
            var size = page.getSize();
            var widthDiff = Math.abs(size.width - metric.pageWidth);
            if (widthDiff > 0.5) throw new Error('Page ' + pageNumber + ' width mismatch in PDF.');
            if (metric.sliceHeight > MAX_SLICE_HEIGHT) throw new Error('Page ' + pageNumber + ' exceeds max slice height.');
            var expectedHeight = metric.sliceHeight * metric.pageWidth / metric.sourceWidth;
            var pageHeightDiff = Math.abs(size.height - expectedHeight);
            if (pageHeightDiff > 0.5) throw new Error('Page ' + pageNumber + ' height mismatch in PDF.');
            var metricHeightDiff = Math.abs(metric.pageHeight - expectedHeight);
            if (metricHeightDiff > 0.5) throw new Error('Page ' + pageNumber + ' recorded height mismatch.');
            index += 1;
        }
    }

    async function evaluate(bytes, count, metrics) {
        var pdfLib = ensurePdfLib();
        var pdfDoc = await pdfLib.PDFDocument.load(bytes);
        var pageCount = pdfDoc.getPageCount();
        if (pageCount !== count) throw new Error('PDF page count mismatch.');
        verifyMetricsShape(metrics, count);
        var pages = pdfDoc.getPages();
        verifyPageContent(pdfLib, pages);
        verifyPageDimensions(pages, metrics);
        logOk();
    }

    function runEvaluation(bytes, count, metrics) {
        if (!(bytes instanceof Uint8Array)) {
            logFail('PDF bytes must be Uint8Array.');
            return;
        }
        evaluate(bytes, count, metrics).catch(function (error) {
            logFail(error.message);
        });
    }

    function onPdfReady(event) {
        var detail = event.detail;
        if (!detail) {
            logFail('Missing export detail payload.');
            return;
        }
        var bytes = detail.bytes;
        if (!bytes) {
            logFail('Missing PDF bytes from export.');
            return;
        }
        var count = detail.count;
        if (!Number.isInteger(count)) {
            logFail('Missing exported image count.');
            return;
        }
        var metrics = detail.metrics;
        if (!Array.isArray(metrics)) {
            logFail('Missing page metrics.');
            return;
        }
        runEvaluation(bytes, count, metrics);
    }

    document.addEventListener(EVENT_NAME, onPdfReady);
})();
