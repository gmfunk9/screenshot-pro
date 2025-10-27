(function (root) {
    if (!root) {
        throw new Error('Missing window context for usage tracker.');
    }
    if (!root.ScreenshotGallery) {
        root.ScreenshotGallery = {};
    }
    var endpoint = 'usage-log.php';
    function ensureEventName(value) {
        if (typeof value !== 'string') {
            throw new Error('Missing event name; pass string.');
        }
        var trimmed = value.trim();
        if (trimmed === '') {
            throw new Error('Missing event name; pass string.');
        }
        return trimmed;
    }
    function readNumber(value) {
        if (!Number.isFinite(value)) {
            return 0;
        }
        return value;
    }
    function readScreenSize() {
        var screen = root.screen;
        var width = 0;
        var height = 0;
        if (screen) {
            width = readNumber(screen.width);
            height = readNumber(screen.height);
        }
        return { width: width, height: height };
    }
    function readViewportSize() {
        var width = readNumber(root.innerWidth);
        var height = readNumber(root.innerHeight);
        return { width: width, height: height };
    }
    function readLanguage() {
        var nav = root.navigator;
        if (!nav) {
            return '';
        }
        if (typeof nav.language !== 'string') {
            return '';
        }
        return nav.language;
    }
    function buildContext() {
        return {
            screen: readScreenSize(),
            viewport: readViewportSize(),
            language: readLanguage(),
            referrer: document.referrer || ''
        };
    }
    function buildPayload(eventName, detail) {
        var payload = {
            event: eventName,
            at: new Date().toISOString(),
            context: buildContext(),
            detail: detail
        };
        return payload;
    }
    function stringifyPayload(payload) {
        try {
            return JSON.stringify(payload);
        } catch (error) {
            console.warn('Usage payload stringify failed.', error);
            return '';
        }
    }
    function trySendBeacon(json) {
        var nav = root.navigator;
        if (!nav) {
            return false;
        }
        var sendBeacon = nav.sendBeacon;
        if (typeof sendBeacon !== 'function') {
            return false;
        }
        try {
            return sendBeacon(endpoint, json);
        } catch (error) {
            console.warn('Usage sendBeacon failed.', error);
            return false;
        }
    }
    function tryFetch(json) {
        var fetchFn = root.fetch;
        if (typeof fetchFn !== 'function') {
            return;
        }
        fetchFn(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: json,
            keepalive: true
        }).catch(function (error) {
            console.warn('Usage log send failed.', error);
        });
    }
    function send(payload) {
        var json = stringifyPayload(payload);
        if (typeof json !== 'string') {
            console.warn('Usage payload JSON missing string.');
            return;
        }
        if (json.length === 0) {
            console.warn('Usage payload JSON empty.');
            return;
        }
        var sent = trySendBeacon(json);
        if (sent) {
            return;
        }
        tryFetch(json);
    }
    function recordUsage(eventName, detail) {
        var name = ensureEventName(eventName);
        var payloadDetail = null;
        if (detail !== undefined) {
            payloadDetail = detail;
        }
        var payload = buildPayload(name, payloadDetail);
        send(payload);
    }
    root.ScreenshotGallery.usage = {
        recordUsage: recordUsage
    };
}(window));
