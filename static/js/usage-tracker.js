(function (root) {
    if (!root) {
        throw new Error('Missing window context for usage tracker.');
    }
    if (!root.ScreenshotGallery) {
        root.ScreenshotGallery = {};
    }
    var state = {
        counters: {},
        totals: {},
        timers: {}
    };
    function snapshotTimers() {
        var timers = {};
        var keys = Object.keys(state.timers);
        var index = 0;
        while (index < keys.length) {
            var name = keys[index];
            var timer = state.timers[name];
            timers[name] = {
                startedAt: timer.startedAt,
                totalMs: timer.totalMs,
                runs: timer.runs
            };
            index += 1;
        }
        return timers;
    }
    function snapshot() {
        return {
            counters: Object.assign({}, state.counters),
            totals: Object.assign({}, state.totals),
            timers: snapshotTimers()
        };
    }
    function dispatch(detail) {
        if (typeof root.CustomEvent !== 'function') {
            return;
        }
        var payload = {
            action: detail.action,
            event: detail.event,
            timer: detail.timer,
            elapsedMs: detail.elapsedMs,
            payload: detail.payload,
            state: snapshot()
        };
        var event = new CustomEvent('screenshotpro:usage', { detail: payload });
        root.dispatchEvent(event);
    }
    function ensureName(name, errorMessage) {
        if (typeof name !== 'string') {
            throw new Error(errorMessage);
        }
        var trimmed = name.trim();
        if (trimmed === '') {
            throw new Error(errorMessage);
        }
        return trimmed;
    }
    function firstNumericField(data) {
        if (!data) {
            return null;
        }
        if (typeof data !== 'object') {
            return null;
        }
        var keys = Object.keys(data);
        var index = 0;
        while (index < keys.length) {
            var key = keys[index];
            var value = data[key];
            if (typeof value === 'number') {
                if (Number.isFinite(value)) {
                    return value;
                }
            }
            index += 1;
        }
        return null;
    }
    function ensureCounter(name) {
        if (!state.counters[name]) {
            state.counters[name] = 0;
        }
    }
    function ensureTotal(name) {
        if (!state.totals[name]) {
            state.totals[name] = 0;
        }
    }
    function ensureTimer(name) {
        if (!state.timers[name]) {
            state.timers[name] = {
                startedAt: 0,
                totalMs: 0,
                runs: 0
            };
        }
    }
    function recordUsage(eventName, payload) {
        var name = ensureName(eventName, 'Missing event name; pass string.');
        ensureCounter(name);
        state.counters[name] += 1;
        var numeric = firstNumericField(payload);
        if (Number.isFinite(numeric)) {
            ensureTotal(name);
            state.totals[name] += numeric;
        }
        var detailPayload = null;
        if (payload !== undefined) {
            detailPayload = payload;
        }
        dispatch({
            action: 'recordUsage',
            event: name,
            payload: detailPayload
        });
        return state.counters[name];
    }
    function startTimer(timerName) {
        var name = ensureName(timerName, 'Missing timer name; pass string.');
        ensureTimer(name);
        var timer = state.timers[name];
        if (timer.startedAt > 0) {
            return timer.startedAt;
        }
        timer.startedAt = root.performance.now();
        dispatch({
            action: 'startTimer',
            timer: name,
            payload: null
        });
        return timer.startedAt;
    }
    function stopTimer(timerName) {
        var name = ensureName(timerName, 'Missing timer name; pass string.');
        var timer = state.timers[name];
        if (!timer) {
            return 0;
        }
        if (timer.startedAt === 0) {
            return 0;
        }
        var elapsed = root.performance.now() - timer.startedAt;
        timer.totalMs += elapsed;
        timer.runs += 1;
        timer.startedAt = 0;
        dispatch({
            action: 'stopTimer',
            timer: name,
            elapsedMs: elapsed,
            payload: null
        });
        return elapsed;
    }
    function observeUsage(handler) {
        if (typeof handler !== 'function') {
            throw new Error('Missing usage handler; provide function.');
        }
        root.addEventListener('screenshotpro:usage', handler);
        return function unsubscribe() {
            root.removeEventListener('screenshotpro:usage', handler);
        };
    }
    root.ScreenshotGallery.usage = {
        recordUsage: recordUsage,
        startTimer: startTimer,
        stopTimer: stopTimer,
        snapshot: snapshot
    };
    root.ScreenshotGallery.observeUsage = observeUsage;
    root.ScreenshotGallery.logUsage = function () {
        return observeUsage(function (event) {
            console.log('[usage]', event.detail);
        });
    };
}(window));

