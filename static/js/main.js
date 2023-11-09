document.addEventListener("DOMContentLoaded", function() {
    const captureForm = document.getElementById("capture-form");
    const urlInput = document.getElementById("urlInput");
    const gallery = document.getElementById("gallery");
    const result = document.getElementById("result");
    const templateImageWrap = document.querySelector(".image-wrap");
    let eventSource;
    let isFirstAppend = true;

    captureForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        
        const url = urlInput.value;
        if (!url) return;

        // Start listening to the stream
        startListening();

        // Initiate the capture
        try {
            await fetch('/capture', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url })
            });
        } catch (error) {
            console.error("Failed to communicate with server:", error);
        }
    });

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
    
});
