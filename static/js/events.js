export function bindUi(options) {
    if (!options) throw new Error('Missing UI options.');
    const form = options.form;
    const urlInput = options.urlInput;
    const urlListInput = options.urlListInput;
    const inputModeInputs = options.inputModeInputs;
    const cookieInput = options.cookieInput;
    const modeInputs = options.modeInputs;
    const newSessionBtn = options.newSessionBtn;
    const clearGalleryBtn = options.clearGalleryBtn;
    const clearDiskBtn = options.clearDiskBtn;
    const exportPdfBtn = options.exportPdfBtn;
    const savePageBtn = options.savePageBtn;
    const restartServerBtn = options.restartServerBtn;
    const sidebarToggleBtn = options.sidebarToggleBtn;

    if (!form) throw new Error('Missing capture form.');
    if (!urlInput) throw new Error('Missing URL input.');
    if (!urlListInput) throw new Error('Missing URL list input.');
    if (!inputModeInputs) throw new Error('Missing input mode options.');
    if (!inputModeInputs.length) throw new Error('Missing input mode options.');
    if (!cookieInput) throw new Error('Missing cookie input.');
    if (!modeInputs) throw new Error('Missing mode inputs.');
    if (!modeInputs.length) throw new Error('Missing mode options.');
    if (!newSessionBtn) throw new Error('Missing new session button.');
    if (!clearGalleryBtn) throw new Error('Missing clear gallery button.');
    if (!clearDiskBtn) throw new Error('Missing clear disk button.');
    if (!exportPdfBtn) throw new Error('Missing export PDF button.');
    if (!savePageBtn) throw new Error('Missing save page button.');
    if (!restartServerBtn) throw new Error('Missing restart server button.');
    if (!sidebarToggleBtn) throw new Error('Missing sidebar toggle button.');

    function notifyValidation(message) {
        const handler = options.onValidationError;
        if (!handler) return;
        handler(message);
    }

    function notifyError(error) {
        const handler = options.onError;
        if (!handler) return;
        handler(error);
    }

    function resolveMode() {
        for (const input of modeInputs) {
            if (!input) continue;
            if (input.checked) return input.value;
        }
        return 'desktop';
    }

    function resolveInputMode() {
        for (const input of inputModeInputs) {
            if (!input) continue;
            if (input.checked) return input.value;
        }
        return 'sitemap';
    }

    function collectUrls() {
        const raw = urlListInput.value || '';
        return raw
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);
    }

    async function handleCapture(event) {
        event.preventDefault();
        const inputMode = resolveInputMode();
        if (inputMode === 'manual') {
            const urls = collectUrls();
            if (!urls.length) {
                notifyValidation('Provide at least one URL.');
                return;
            }
            const payload = {
                url: urls[0],
                urls,
                cookie: cookieInput.value.trim(),
                mode: resolveMode()
            };
            const handler = options.onCapture;
            if (!handler) return;
            try {
                await handler(payload);
            } catch (error) {
                notifyError(error);
            }
            return;
        }
        const rawUrl = urlInput.value.trim();
        if (!rawUrl) {
            notifyValidation('Provide a URL to capture.');
            return;
        }
        const payload = {
            url: rawUrl,
            cookie: cookieInput.value.trim(),
            mode: resolveMode()
        };
        const handler = options.onCapture;
        if (!handler) return;
        try {
            await handler(payload);
        } catch (error) {
            notifyError(error);
        }
    }

    async function handleNewSession() {
        const handler = options.onNewSession;
        if (!handler) return;
        try {
            await handler();
        } catch (error) {
            notifyError(error);
        }
    }

    function handleClearGallery() {
        const handler = options.onClearGallery;
        if (!handler) return;
        handler();
    }

    async function handleClearDisk() {
        const handler = options.onClearDisk;
        if (!handler) return;
        try {
            await handler();
        } catch (error) {
            notifyError(error);
        }
    }

    async function handleExportPdf() {
        const handler = options.onExportPdf;
        if (!handler) return;
        try {
            await handler();
        } catch (error) {
            notifyError(error);
        }
    }

    async function handleSavePage() {
        const handler = options.onSavePage;
        if (!handler) return;
        try {
            await handler();
        } catch (error) {
            notifyError(error);
        }
    }

    async function handleRestartServer() {
        const handler = options.onRestartServer;
        if (!handler) return;
        try {
            await handler();
        } catch (error) {
            notifyError(error);
        }
    }

    function handleSidebarToggle() {
        const handler = options.onToggleSidebar;
        if (!handler) return;
        handler();
    }

    form.addEventListener('submit', handleCapture);
    newSessionBtn.addEventListener('click', handleNewSession);
    clearGalleryBtn.addEventListener('click', handleClearGallery);
    clearDiskBtn.addEventListener('click', handleClearDisk);
    exportPdfBtn.addEventListener('click', handleExportPdf);
    savePageBtn.addEventListener('click', handleSavePage);
    restartServerBtn.addEventListener('click', handleRestartServer);
    sidebarToggleBtn.addEventListener('click', handleSidebarToggle);
}
