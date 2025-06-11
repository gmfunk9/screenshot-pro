document.addEventListener("DOMContentLoaded", function() {
    const captureForm = document.getElementById("capture-form");
    const urlInput = document.getElementById("urlInput");
    const cookieInput = document.getElementById("cookieInput");
    const gallery = document.getElementById("gallery");
    const result = document.getElementById("result");
    const templateImageWrap = document.querySelector(".image-wrap");
    const savePageBtn = document.getElementById("savePageBtn");
    const newSessionBtn = document.getElementById("newSessionBtn");
    const clearGalleryBtn = document.getElementById("clearGalleryBtn");
    const clearDiskBtn = document.getElementById("clearDiskBtn");
    const exportPdfBtn = document.getElementById("exportPdfBtn");
    let eventSource;
    let isFirstAppend = true;
    let currentHost = '';

    captureForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        
        const url = urlInput.value;
        if (!url) return;
        currentHost = new URL(url).hostname;

        // Start listening to the stream
        startListening();

        // Initiate the capture
        try {
            await fetch('/capture', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url, cookie: cookieInput.value })
            });
        } catch (error) {
            console.error("Failed to communicate with server:", error);
        }
    });

    savePageBtn.addEventListener("click", savePage);
    newSessionBtn.addEventListener("click", startSession);
    clearGalleryBtn.addEventListener("click", clearGallery);
    clearDiskBtn.addEventListener("click", clearDisk);
    exportPdfBtn.addEventListener("click", exportPdf);

    function startListening() {
        if (eventSource) {
            eventSource.close();
        }

        eventSource = new EventSource('/stream');
        
        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type && data.type === "ping") {
                return;
            }

            if (data.imageData.relativePath) {
                displayScreenshot(data.imageData.relativePath, data.imageData.dimensions);
            }
        };

        eventSource.onerror = (error) => {
            console.error("EventSource failed:", error);
            eventSource.close();
        };
    }

    function displayScreenshot(filepath, dimensions) {
        // Clone the template
        const clonedImageWrap = templateImageWrap.cloneNode(true);
        
        if (isFirstAppend) {
            // Clear the div
            result.innerHTML = '';
            
            // Set the flag to false so we don't clear it next time
            isFirstAppend = false;
        }
        const img = clonedImageWrap.querySelector(".screenshot-img");
        img.src = filepath;
        img.alt = "Captured Screenshot";
    
        // Adjusting width and height attributes
        if (dimensions && dimensions.width && dimensions.height) {
            img.width = dimensions.width;
            img.height = dimensions.height;
        }
        let modifiedFilepath = filepath
            .replace('/static/screenshots/', 'https://')
            .replace('_com/', '.com/')
            .replace('.jpg', '');

        
        // Adjusting the action buttons if needed (you can modify this part further as per requirements)
        const viewPageBtn = clonedImageWrap.querySelector(".view-page-btn");
        viewPageBtn.href = modifiedFilepath;
    
        const viewImageBtn = clonedImageWrap.querySelector(".view-image-btn");
        viewImageBtn.href = filepath;
        
        console.log("appendChild clonedImageWrap");
        result.appendChild(clonedImageWrap);
    }

    async function fetchText(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to load ${url}`);
        }
        return response.text();
    }

    async function imageToDataUrl(src) {
        const response = await fetch(src);
        if (!response.ok) {
            return src;
        }
        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    }

    async function savePage() {
        const css = await fetchText('/static/css/style.min.css');
        const mainJs = await fetchText('/static/js/main.js');
        const grabJs = await fetchText('/static/js/fpgrab.js');

        const doc = document.documentElement.cloneNode(true);
        doc.querySelectorAll('link[rel="stylesheet"]').forEach(el => el.remove());
        doc.querySelectorAll('script[src]').forEach(el => el.remove());

        const head = doc.querySelector('head');
        const styleEl = document.createElement('style');
        styleEl.textContent = css;
        head.appendChild(styleEl);

        const body = doc.querySelector('body');
        const scriptGrab = document.createElement('script');
        scriptGrab.textContent = grabJs;
        body.appendChild(scriptGrab);
        const scriptMain = document.createElement('script');
        scriptMain.textContent = mainJs;
        body.appendChild(scriptMain);

        const images = doc.querySelectorAll('img');
        for (const img of images) {
            img.src = await imageToDataUrl(img.src);
        }

        const finalHtml = '<!DOCTYPE html>\n' + doc.outerHTML;
        const blob = new Blob([finalHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'page.html';
        a.click();
        URL.revokeObjectURL(url);
    }

    async function startSession() {
        await fetch('/session', { method: 'POST' });
        result.innerHTML = '';
        isFirstAppend = true;
    }

    function clearGallery() {
        result.innerHTML = '';
        isFirstAppend = true;
    }

    async function clearDisk() {
        if (!confirm('Delete screenshots?')) return;
        const params = currentHost ? '?host=' + encodeURIComponent(currentHost) : '';
        await fetch('/session' + params, { method: 'DELETE' });
        clearGallery();
    }

    async function exportPdf() {
        const res = await fetch('/pdf');
        if (!res.ok) {
            alert('Export failed');
            return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'screenshots.pdf';
        a.click();
        URL.revokeObjectURL(url);
    }
    
});
