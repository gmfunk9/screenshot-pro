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
    function send(payload) {
        var json = JSON.stringify(payload);
        if (!json) {
            return;
        }
        var nav = root.navigator;
        if (nav) {
            var sendBeacon = nav.sendBeacon;
            if (typeof sendBeacon === 'function') {
                var blob = new Blob([json], { type: 'application/json' });
                var sent = sendBeacon(endpoint, blob);
                if (sent) {
                    return;
                }
            }
        }
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
