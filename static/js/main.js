import { createGallery } from 'app/gallery';
import { capturePages } from 'app/capture';
import { fetchSitemap, storeCapture, fetchStatus, startSession, clearSession, downloadPdf, saveOfflineBundle, normalizeMode } from 'app/actions';
import { bindUi } from 'app/events';

const state = { busy: false, currentHost: '' };

export function deriveHost(url) {
    if (!url) {
        return '';
    }
    try {
        return new URL(url).hostname;
    } catch (error) {
        return '';
    }
}

function disableForm(form, disabled) {
    if (!form) {
        return;
    }
    let controls = [];
    if (form.elements) {
        controls = Array.from(form.elements);
    }
    for (const control of controls) {
        if (!control) {
            continue;
        }
        control.disabled = disabled;
    }
}

function setSidebarState(appShell, sidebar, toggleBtn, labelEl, iconEl, nextState) {
    appShell.dataset.sidebar = nextState;
    const expanded = nextState === 'expanded';
    if (expanded) {
        toggleBtn.setAttribute('aria-expanded', 'true');
        sidebar.setAttribute('aria-hidden', 'false');
    } else {
        toggleBtn.setAttribute('aria-expanded', 'false');
        sidebar.setAttribute('aria-hidden', 'true');
    }
    if (labelEl) {
        if (expanded) {
            labelEl.textContent = 'Hide controls';
        } else {
            labelEl.textContent = 'Show controls';
        }
    }
    if (iconEl) {
        if (expanded) {
            iconEl.textContent = '⟨';
        } else {
            iconEl.textContent = '⟩';
        }
    }
}

function initSidebar(appShell, sidebar, toggleBtn, labelEl, iconEl) {
    let initial = appShell.dataset.sidebar;
    if (!initial) {
        initial = 'expanded';
    }
    let prefersCollapsed = false;
    if (typeof window.matchMedia === 'function') {
        const query = window.matchMedia('(max-width: 960px)');
        if (query) {
            if (query.matches) {
                prefersCollapsed = true;
            }
        }
    }
    if (prefersCollapsed) {
        initial = 'collapsed';
    }
    setSidebarState(appShell, sidebar, toggleBtn, labelEl, iconEl, initial);
    toggleBtn.addEventListener('click', () => {
        const current = appShell.dataset.sidebar;
        let next = 'collapsed';
        if (current === 'collapsed') {
            next = 'expanded';
        }
        setSidebarState(appShell, sidebar, toggleBtn, labelEl, iconEl, next);
    });
}

async function hydrateFromServer(gallery, setStatus) {
    try {
        const data = await fetchStatus();
        if (!data) {
            return;
        }
        if (Array.isArray(data.images)) {
            for (const image of data.images) {
                gallery.append(image);
            }
        }
        const summary = data.session;
        if (summary) {
            if (Array.isArray(summary.hosts)) {
                if (summary.hosts.length) {
                    state.currentHost = summary.hosts[summary.hosts.length - 1];
                }
            }
        }
        if (setStatus) {
            setStatus('Ready.');
        }
    } catch (error) {
        console.error(error);
        if (setStatus) {
            setStatus('Failed to load session status.');
        }
    }
}

function buildCapturePayload(result) {
    return {
        host: result.meta.host,
        pageUrl: result.meta.pageUrl,
        pageTitle: result.meta.pageTitle,
        mode: result.meta.mode,
        blob: result.blob,
        mime: result.meta.mime,
        dimensions: result.meta.dimensions
    };
}

function reportError(setStatus, error) {
    console.error(error);
    let message = 'Action failed.';
    if (error) {
        if (error.message) {
            message = error.message;
        }
    }
    setStatus(message);
    window.alert(message);
}

function init() {
    const form = document.getElementById('capture-form');
    const urlInput = document.getElementById('urlInput');
    const cookieInput = document.getElementById('cookieInput');
    const modeInputs = document.querySelectorAll('input[name="mode"]');
    const newSessionBtn = document.getElementById('newSessionBtn');
    const clearGalleryBtn = document.getElementById('clearGalleryBtn');
    const clearDiskBtn = document.getElementById('clearDiskBtn');
    const exportPdfBtn = document.getElementById('exportPdfBtn');
    const savePageBtn = document.getElementById('savePageBtn');
    const sidebarToggleBtn = document.getElementById('sidebarToggle');
    const galleryContainer = document.getElementById('result');
    const statusEl = document.getElementById('sessionStatus');
    const appShell = document.querySelector('.app-shell');
    const sidebar = document.getElementById('sidebar');
    const sidebarToggleLabel = document.getElementById('sidebarToggleLabel');
    const sidebarToggleIcon = document.getElementById('sidebarToggleIcon');

    if (!form) {
        throw new Error('Missing capture form.');
    }
    if (!urlInput) {
        throw new Error('Missing URL input.');
    }
    if (!cookieInput) {
        throw new Error('Missing cookie input.');
    }
    if (!modeInputs) {
        throw new Error('Missing mode inputs.');
    }
    if (!modeInputs.length) {
        throw new Error('Missing mode options.');
    }
    if (!newSessionBtn) {
        throw new Error('Missing new session button.');
    }
    if (!clearGalleryBtn) {
        throw new Error('Missing clear gallery button.');
    }
    if (!clearDiskBtn) {
        throw new Error('Missing clear disk button.');
    }
    if (!exportPdfBtn) {
        throw new Error('Missing export PDF button.');
    }
    if (!savePageBtn) {
        throw new Error('Missing save offline button.');
    }
    if (!sidebarToggleBtn) {
        throw new Error('Missing sidebar toggle button.');
    }
    if (!galleryContainer) {
        throw new Error('Missing gallery container.');
    }
    if (!statusEl) {
        throw new Error('Missing status element.');
    }
    if (!appShell) {
        throw new Error('Missing app shell.');
    }
    if (!sidebar) {
        throw new Error('Missing sidebar.');
    }

    const gallery = createGallery(galleryContainer);

    function setStatus(message) {
        statusEl.textContent = message;
    }

    initSidebar(appShell, sidebar, sidebarToggleBtn, sidebarToggleLabel, sidebarToggleIcon);
    setStatus('Loading session…');
    hydrateFromServer(gallery, setStatus);

    bindUi({
        form,
        urlInput,
        cookieInput,
        modeInputs,
        newSessionBtn,
        clearGalleryBtn,
        clearDiskBtn,
        exportPdfBtn,
        savePageBtn,
        sidebarToggleBtn,
        onValidationError: setStatus,
        onError: (error) => reportError(setStatus, error),
        onCapture: async (payload) => {
            if (state.busy) {
                throw new Error('Capture already running; wait for completion.');
            }
            state.busy = true;
            disableForm(form, true);
            try {
                const mode = normalizeMode(payload.mode);
                setStatus('Fetching sitemap…');
                const urls = await fetchSitemap(payload.url);
                setStatus(`Capturing ${urls.length} pages…`);
                await capturePages({
                    urls,
                    mode,
                    cookie: payload.cookie,
                    onStatus: (message) => setStatus(message),
                    onCapture: async (result) => {
                        setStatus(`Saving ${result.meta.pageUrl}`);
                        const stored = await storeCapture(buildCapturePayload(result));
                        let nextHost = stored.host;
                        if (!nextHost) {
                            nextHost = deriveHost(result.meta.pageUrl);
                        }
                        state.currentHost = nextHost;
                        gallery.append(stored);
                        setStatus(`Stored ${stored.pageUrl}`);
                    }
                });
                setStatus('Capture complete.');
            } catch (error) {
                reportError(setStatus, error);
            } finally {
                state.busy = false;
                disableForm(form, false);
            }
        },
        onNewSession: async () => {
            setStatus('Creating new session…');
            await startSession();
            gallery.clear();
            state.currentHost = '';
            setStatus('Session reset.');
        },
        onClearGallery: () => {
            gallery.clear();
            setStatus('Gallery cleared.');
        },
        onClearDisk: async () => {
            const confirmed = window.confirm('Delete stored screenshots?');
            if (!confirmed) {
                return;
            }
            await clearSession(state.currentHost);
            gallery.clear();
            state.currentHost = '';
            setStatus('Disk cleared.');
        },
        onExportPdf: async () => {
            setStatus('Building PDF…');
            await downloadPdf();
            setStatus('PDF downloaded.');
        },
        onSavePage: async () => {
            setStatus('Building offline bundle…');
            await saveOfflineBundle();
            setStatus('Offline bundle saved.');
        },
        onToggleSidebar: () => {
            const current = appShell.dataset.sidebar;
            let next = 'collapsed';
            if (current === 'collapsed') {
                next = 'expanded';
            }
            setSidebarState(appShell, sidebar, sidebarToggleBtn, sidebarToggleLabel, sidebarToggleIcon, next);
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
