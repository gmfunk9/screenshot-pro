import { createGallery } from 'app/gallery';
import { createSseClient } from 'app/sse';
import { requestCapture, startSession, clearSession, downloadPdf, saveOfflineBundle } from 'app/actions';
import { bindUi } from 'app/events';

const state = { currentHost: '' };

export function deriveHost(url) {
    if (!url) return '';
    try {
        return new URL(url).hostname;
    } catch (error) {
        return '';
    }
}

function init() {
    const form = document.getElementById('capture-form');
    const urlInput = document.getElementById('urlInput');
    const cookieInput = document.getElementById('cookieInput');
    const newSessionBtn = document.getElementById('newSessionBtn');
    const clearGalleryBtn = document.getElementById('clearGalleryBtn');
    const clearDiskBtn = document.getElementById('clearDiskBtn');
    const exportPdfBtn = document.getElementById('exportPdfBtn');
    const savePageBtn = document.getElementById('savePageBtn');
    const galleryContainer = document.getElementById('result');
    const statusEl = document.getElementById('sessionStatus');

    const gallery = createGallery(galleryContainer);

    function setStatus(message) {
        statusEl.textContent = message;
    }

    function handleStreamStatus(message) {
        setStatus(message);
    }

    function handleStreamError(error) {
        console.error(error);
        setStatus('Stream error; retry.');
    }

    function handleScreenshot(image) {
        if (!image) return;
        const host = image.host;
        if (host) state.currentHost = host;
        if (state.currentHost) {
            gallery.append(image);
            return;
        }
        const fallback = deriveHost(image.pageUrl);
        if (fallback) state.currentHost = fallback;
        gallery.append(image);
    }

    const stream = createSseClient({
        endpoint: '/stream',
        onScreenshot: handleScreenshot,
        onStatus: handleStreamStatus,
        onError: handleStreamError
    });

    function reportError(error) {
        console.error(error);
        const message = error && error.message ? error.message : 'Action failed.';
        setStatus(message);
        window.alert(message);
    }

    bindUi({
        form,
        urlInput,
        cookieInput,
        newSessionBtn,
        clearGalleryBtn,
        clearDiskBtn,
        exportPdfBtn,
        savePageBtn,
        onValidationError: setStatus,
        onError: reportError,
        onCapture: async (payload) => {
            const host = deriveHost(payload.url);
            if (!host) throw new Error('Invalid URL; check input.');
            state.currentHost = host;
            setStatus(`Capturing ${host}…`);
            stream.open();
            await requestCapture(payload);
            setStatus('Capture started.');
        },
        onNewSession: async () => {
            await startSession();
            state.currentHost = '';
            gallery.clear();
            setStatus('Session reset.');
        },
        onClearGallery: () => {
            gallery.clear();
            setStatus('Gallery cleared.');
        },
        onClearDisk: async () => {
            const confirmed = window.confirm('Delete stored screenshots?');
            if (!confirmed) return;
            await clearSession(state.currentHost);
            gallery.clear();
            setStatus('Disk cleared.');
        },
        onExportPdf: async () => {
            setStatus('Building PDF…');
            await downloadPdf();
            setStatus('PDF downloaded.');
        },
        onSavePage: async () => {
            setStatus('Packaging offline bundle…');
            await saveOfflineBundle();
            setStatus('Offline bundle saved.');
        }
    });
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}
