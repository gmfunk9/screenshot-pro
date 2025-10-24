function resolveSelectedMode(list) {
    const inputs = Array.from(list);
    for (const i of inputs) if (i.checked) return i.value;
    return 'desktop';
}

async function handleCapture(urlInput, modes, statusEl, gallery) {
    writeStatus(statusEl, '');
    const urls = await fetchSitemapUrls(urlInput.value, statusEl);
    const mode = resolveSelectedMode(modes);
    for (const u of urls) await capturePage({ url: u, mode, statusEl, gallery });
}

function init() {
    const urlInput = selectById('urlInput');
    const captureBtn = selectById('captureBtn');
    const clearBtn = selectById('clearGalleryBtn');
    const statusEl = selectById('sessionStatus');
    const galleryContainer = selectById('result');
    const modes = document.querySelectorAll('input[name="mode"]');
    const gallery = window.ScreenshotGallery.createGallery(galleryContainer);

    writeStatus(statusEl, 'Idle. Ready. Max 10 pages per session.');

    captureBtn.onclick = async () => {
        disableForm({ elements: [urlInput, captureBtn, clearBtn] }, true);
        try {
            await handleCapture(urlInput, modes, statusEl, gallery);
        } finally {
            disableForm({ elements: [urlInput, captureBtn, clearBtn] }, false);
        }
    };

    clearBtn.onclick = () => {
        releaseBlobUrls();
        gallery.clear();
        writeStatus(statusEl, 'Gallery cleared.');
    };
}

window.addEventListener('beforeunload', releaseBlobUrls);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
