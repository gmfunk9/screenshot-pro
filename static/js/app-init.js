function resolveSelectedMode(inputList) {
    const inputElements = Array.from(inputList);
    for (const inputElement of inputElements) {
        if (inputElement.checked) {
            return inputElement.value;
        }
    }
    return 'desktop';
}
function getUsage() {
    const root = window.ScreenshotGallery;
    if (!root) {
        return null;
    }
    const usage = root.usage;
    if (!usage) {
        return null;
    }
    return usage;
}
async function handleCapture(urlInput, modes, statusEl, gallery) {
    writeStatus(statusEl, '');
    const usage = getUsage();
    let sessionError = null;
    let pageUrls = [];
    const selectedMode = resolveSelectedMode(modes);
    const submittedUrl = urlInput.value;
    try {
        if (usage) {
            usage.recordUsage('capture-submitted', {
                submittedUrl: submittedUrl,
                mode: selectedMode
            });
        }
        pageUrls = await fetchSitemapUrls(urlInput.value, statusEl);
        if (usage) {
            usage.recordUsage('sitemap-fetched', {
                submittedUrl: submittedUrl,
                urls: pageUrls
            });
        }
        for (const pageUrl of pageUrls) {
            await capturePage({
                url: pageUrl,
                mode: selectedMode,
                statusEl: statusEl,
                gallery: gallery
            });
        }
    } catch (error) {
        sessionError = error;
        if (usage) {
            let message = 'Unknown session error';
            if (error) {
                if (error.message) {
                    message = error.message;
                }
            }
            usage.recordUsage('capture-error', {
                submittedUrl: submittedUrl,
                message: message
            });
        }
        throw error;
    } finally {
        if (sessionError) {
            return;
        }
        if (!usage) {
            return;
        }
        usage.recordUsage('capture-complete', {
            submittedUrl: submittedUrl,
            pages: pageUrls.length,
            mode: selectedMode
        });
    }
}
function releaseBlobUrls() {
    for (const blobUrl of blobUrls) {
        URL.revokeObjectURL(blobUrl);
    }
    blobUrls.clear();
}
function selectById(elementId) {
    const element = document.getElementById(elementId);
    if (!element) {
        throw new Error(`#${elementId} missing`);
    }
    return element;
}
function disableForm(form, isDisabled) {
    const formControls = Array.from(form.elements);
    for (const control of formControls) {
        control.disabled = isDisabled;
    }
}
function writeStatus(statusTarget, message) {
    if (!statusTarget) {
        return;
    }
    statusTarget.textContent = message;
    statusTarget.scrollTop = statusTarget.scrollHeight;
}
function appendStatus(statusTarget, message) {
    if (!statusTarget) {
        return;
    }
    statusTarget.textContent += `\n${message}`;
    statusTarget.scrollTop = statusTarget.scrollHeight;
}
function init() {
    const urlInputElement = selectById('urlInput');
    const captureButton = selectById('captureBtn');
    const clearButton = selectById('clearGalleryBtn');
    const statusElement = selectById('sessionStatus');
    const modeInputs = document.querySelectorAll('input[name="mode"]');
    // Use the auto-initialized gallery instance (no createGallery here)
    const screenshotGallery = window.ScreenshotGallery.gallery;
    writeStatus(statusElement, 'Idle. Ready. Max 10 pages per session.');
    captureButton.onclick = async () => {
        disableForm({ elements: [urlInputElement, captureButton, clearButton] }, true);
        try {
            await handleCapture(urlInputElement, modeInputs, statusElement, screenshotGallery);
        } finally {
            disableForm({ elements: [urlInputElement, captureButton, clearButton] }, false);
        }
    };
    clearButton.onclick = () => {
        releaseBlobUrls();
        screenshotGallery.clear('user-click');
        writeStatus(statusElement, 'Gallery cleared.');
    };
}
window.addEventListener('beforeunload', releaseBlobUrls);
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
