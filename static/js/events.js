export function bindUi(options) {
    if (!options) throw new Error('Missing UI options.');
    const form = options.form;
    const urlInput = options.urlInput;
    const cookieInput = options.cookieInput;
    const newSessionBtn = options.newSessionBtn;
    const clearGalleryBtn = options.clearGalleryBtn;
    const clearDiskBtn = options.clearDiskBtn;
    const exportPdfBtn = options.exportPdfBtn;
    const savePageBtn = options.savePageBtn;

    if (!form) throw new Error('Missing capture form.');
    if (!urlInput) throw new Error('Missing URL input.');
    if (!cookieInput) throw new Error('Missing cookie input.');
    if (!newSessionBtn) throw new Error('Missing new session button.');
    if (!clearGalleryBtn) throw new Error('Missing clear gallery button.');
    if (!clearDiskBtn) throw new Error('Missing clear disk button.');
    if (!exportPdfBtn) throw new Error('Missing export PDF button.');
    if (!savePageBtn) throw new Error('Missing save page button.');

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

    async function handleCapture(event) {
        event.preventDefault();
        const rawUrl = urlInput.value.trim();
        if (!rawUrl) {
            notifyValidation('Provide a URL to capture.');
            return;
        }
        const payload = { url: rawUrl, cookie: cookieInput.value.trim() };
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

    form.addEventListener('submit', handleCapture);
    newSessionBtn.addEventListener('click', handleNewSession);
    clearGalleryBtn.addEventListener('click', handleClearGallery);
    clearDiskBtn.addEventListener('click', handleClearDisk);
    exportPdfBtn.addEventListener('click', handleExportPdf);
    savePageBtn.addEventListener('click', handleSavePage);
}
