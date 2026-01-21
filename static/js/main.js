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
    const urlListInput = document.getElementById('urlListInput');
    const inputModeInputs = document.querySelectorAll('input[name="inputMode"]');
    const cookieInput = document.getElementById('cookieInput');
    const modeInputs = document.querySelectorAll('input[name="mode"]');
    const newSessionBtn = document.getElementById('newSessionBtn');
    const clearGalleryBtn = document.getElementById('clearGalleryBtn');
    const clearDiskBtn = document.getElementById('clearDiskBtn');
    const exportPdfBtn = document.getElementById('exportPdfBtn');
    const savePageBtn = document.getElementById('savePageBtn');
    const restartServerBtn = document.getElementById('restartServerBtn');
    const galleryContainer = document.getElementById('result');
    const statusEl = document.getElementById('sessionStatus');
    const appShell = document.querySelector('.app-shell');
    const sidebar = document.getElementById('sidebar');
    const sidebarToggleBtn = document.getElementById('sidebarToggle');
    const sidebarToggleLabel = document.getElementById('sidebarToggleLabel');
    const sidebarToggleIcon = document.getElementById('sidebarToggleIcon');
    const logOutput = document.getElementById('logOutput');

    if (!appShell) throw new Error('Missing app shell.');
    if (!sidebar) throw new Error('Missing sidebar.');
    if (!sidebarToggleBtn) throw new Error('Missing sidebar toggle.');
    if (!modeInputs.length) throw new Error('Missing viewport controls.');
    if (!inputModeInputs.length) throw new Error('Missing input mode controls.');

    const gallery = createGallery(galleryContainer);

    function appendLog(message, level = 'info') {
        if (!logOutput) return;
        const line = document.createElement('div');
        line.className = `log__line log__line--${level}`;
        const time = new Date().toLocaleTimeString();
        line.textContent = `${time} ${message}`;
        logOutput.appendChild(line);
        const maxLines = 200;
        if (logOutput.children.length > maxLines) {
            logOutput.removeChild(logOutput.firstElementChild);
        }
        logOutput.scrollTop = logOutput.scrollHeight;
    }

    function setStatus(message) {
        statusEl.textContent = message;
    }

    function handleStreamStatus(payload) {
        if (!payload) return;
        if (typeof payload === 'string') {
            setStatus(payload);
            appendLog(payload);
            return;
        }
        if (payload.message) {
            setStatus(payload.message);
            appendLog(payload.message);
        }
        if (payload.pageUrl) {
            gallery.updateStatus({
                pageUrl: payload.pageUrl,
                host: payload.pageUrl ? deriveHost(payload.pageUrl) : '',
                mode: payload.mode,
                message: payload.message || payload.step || 'Queued…'
            });
        }
    }

    function handleStreamError(error) {
        console.error(error);
        setStatus('Stream error; retry.');
        appendLog('Stream error; retry.', 'error');
    }

    function handleScreenshot(image) {
        if (!image) return;
        if (image.status === 'error') {
            appendLog(`Capture error for ${image.pageUrl || 'unknown URL'}: ${image.error}`, 'error');
        } else {
            appendLog(`Image ready: ${image.pageUrl || 'unknown URL'}`, 'success');
        }
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

    function handleServerLog(entry) {
        if (!entry) return;
        const scope = entry.scope ? `[${entry.scope}] ` : '';
        const message = entry.message || 'Log';
        const level = entry.level || 'info';
        const meta = entry.meta ? ` ${JSON.stringify(entry.meta)}` : '';
        appendLog(`${scope}${message}${meta}`, level === 'error' ? 'error' : level === 'warn' ? 'warning' : 'info');
        if (typeof console !== 'undefined' && console.log) {
            const logger = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
            logger(`[server] ${scope}${message}`, entry.meta || '');
        }
    }

    const stream = createSseClient({
        endpoint: '/stream',
        onScreenshot: handleScreenshot,
        onStatus: handleStreamStatus,
        onLog: handleServerLog,
        onError: handleStreamError
    });

    function reportError(error) {
        console.error(error);
        const message = error && error.message ? error.message : 'Action failed.';
        setStatus(message);
        appendLog(message, 'error');
        window.alert(message);
    }

    function setSidebarState(nextState) {
        appShell.dataset.sidebar = nextState;
        const expanded = nextState === 'expanded';
        sidebarToggleBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        sidebar.setAttribute('aria-hidden', expanded ? 'false' : 'true');
        if (sidebarToggleLabel) {
            sidebarToggleLabel.textContent = expanded ? 'Hide controls' : 'Show controls';
        }
        if (sidebarToggleIcon) {
            sidebarToggleIcon.textContent = expanded ? '⟨' : '⟩';
        }
    }

    function toggleSidebar() {
        const currentState = appShell.dataset.sidebar;
        if (currentState === 'collapsed') {
            setSidebarState('expanded');
            return;
        }
        setSidebarState('collapsed');
    }

    let initialSidebarState = appShell.dataset.sidebar || 'expanded';
    let prefersCollapsed = false;
    if (typeof window.matchMedia === 'function') {
        const mediaQuery = window.matchMedia('(max-width: 960px)');
        if (mediaQuery.matches) {
            prefersCollapsed = true;
        }
    }
    if (prefersCollapsed) {
        initialSidebarState = 'collapsed';
    }
    setSidebarState(initialSidebarState);

    function updateInputMode() {
        const selected = Array.from(inputModeInputs).find((input) => input.checked);
        const mode = selected ? selected.value : 'sitemap';
        const sitemapField = document.querySelector('[data-input="sitemap"]');
        const manualField = document.querySelector('[data-input="manual"]');
        if (sitemapField) sitemapField.hidden = mode !== 'sitemap';
        if (manualField) manualField.hidden = mode !== 'manual';
    }

    inputModeInputs.forEach((input) => input.addEventListener('change', updateInputMode));
    updateInputMode();

    function formatModeLabel(mode) {
        let value = mode;
        if (!value) value = 'desktop';
        const lower = value.toLowerCase();
        if (lower === 'mobile') return 'Mobile';
        if (lower === 'tablet') return 'Tablet';
        return 'Desktop';
    }

    bindUi({
        form,
        urlInput,
        urlListInput,
        cookieInput,
        modeInputs,
        inputModeInputs,
        newSessionBtn,
        clearGalleryBtn,
        clearDiskBtn,
        exportPdfBtn,
        savePageBtn,
        restartServerBtn,
        sidebarToggleBtn,
        onValidationError: setStatus,
        onError: reportError,
        onCapture: async (payload) => {
            let mode = 'desktop';
            if (payload.mode) mode = payload.mode;
            const host = deriveHost(payload.url);
            if (!host) throw new Error('Invalid URL; check input.');
            state.currentHost = host;
            const modeLabel = formatModeLabel(mode);
            setStatus(`Capturing ${host} — ${modeLabel}…`);
            appendLog(`Capture started for ${host} (${modeLabel}).`, 'success');
            stream.open();
            appendLog('Sending capture request…');
            const response = await requestCapture(payload);
            if (response && typeof response.count === 'number') {
                appendLog(`Capture queued (${response.count} URLs).`, 'success');
            } else {
                appendLog('Capture request accepted.', 'success');
            }
            setStatus('Capture started.');
        },
        onNewSession: async () => {
            await startSession();
            state.currentHost = '';
            gallery.clear();
            setStatus('Session reset.');
            appendLog('Session reset.', 'success');
        },
        onClearGallery: () => {
            gallery.clear();
            setStatus('Gallery cleared.');
            appendLog('Gallery cleared.', 'success');
        },
        onClearDisk: async () => {
            const confirmed = window.confirm('Delete stored screenshots?');
            if (!confirmed) return;
            await clearSession(state.currentHost);
            gallery.clear();
            setStatus('Disk cleared.');
            appendLog('Disk cleared.', 'success');
        },
        onExportPdf: async () => {
            setStatus('Building PDF…');
            await downloadPdf();
            setStatus('PDF downloaded.');
            appendLog('PDF downloaded.', 'success');
        },
        onSavePage: async () => {
            setStatus('Packaging offline bundle…');
            await saveOfflineBundle();
            setStatus('Offline bundle saved.');
            appendLog('Offline bundle saved.', 'success');
        },
        onRestartServer: async () => {
            setStatus('Restarting server…');
            const response = await fetch('/restart', { method: 'POST' });
            if (!response.ok) {
                const text = await response.text().catch(() => '');
                throw new Error(text || 'Restart failed.');
            }
            const payload = await response.json().catch(() => null);
            setStatus('Server restarted.');
            appendLog(payload && payload.message ? payload.message : 'Server restarted.', 'success');
        },
        onToggleSidebar: toggleSidebar
    });
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}
