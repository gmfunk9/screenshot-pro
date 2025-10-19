export function createSseClient(options) {
    if (!options) throw new Error('Missing SSE options.');
    const endpoint = options.endpoint;
    if (!endpoint) throw new Error('Missing SSE endpoint.');

    let source = null;

    function notifyStatus(text) {
        const handler = options.onStatus;
        if (!handler) return;
        handler(text);
    }

    function notifyError(error) {
        const handler = options.onError;
        if (!handler) return;
        handler(error);
    }

    function notifyScreenshot(payload) {
        const handler = options.onScreenshot;
        if (!handler) return;
        handler(payload);
    }

    function close() {
        if (!source) return;
        source.close();
        source = null;
    }

    function handleMessage(event) {
        let data = null;
        try {
            data = JSON.parse(event.data);
        } catch (error) {
            notifyError(error);
            return;
        }

        if (!data) return;
        const type = data.type;
        if (type === 'ping') {
            notifyStatus('Working…');
            return;
        }
        const image = data.imageData;
        if (!image) return;
        notifyScreenshot(image);
    }

    function handleError(error) {
        notifyError(error);
        close();
        notifyStatus('Disconnected');
    }

    function open() {
        close();
        source = new EventSource(endpoint);
        notifyStatus('Listening for captures…');
        source.onmessage = handleMessage;
        source.onerror = handleError;
    }

    return { open, close };
}
