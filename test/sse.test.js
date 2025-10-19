import test from 'node:test';
import assert from 'node:assert/strict';
import { createSseClient } from '../static/js/sse.js';

class FakeEventSource {
    static instances = [];
    constructor(endpoint) {
        this.endpoint = endpoint;
        this.closed = false;
        this.onmessage = null;
        this.onerror = null;
        FakeEventSource.instances.push(this);
    }
    close() {
        this.closed = true;
    }
    emitMessage(payload) {
        if (!this.onmessage) return;
        this.onmessage({ data: JSON.stringify(payload) });
    }
    emitError(error) {
        if (!this.onerror) return;
        this.onerror(error);
    }
}

test.before(() => {
    global.EventSource = FakeEventSource;
});

test.after(() => {
    delete global.EventSource;
});

test('SSE client handles messages and errors', () => {
    const statuses = [];
    const screenshots = [];
    const errors = [];
    const client = createSseClient({
        endpoint: '/stream',
        onStatus: (message) => statuses.push(message),
        onScreenshot: (payload) => screenshots.push(payload),
        onError: (error) => errors.push(error)
    });
    client.open();
    const instance = FakeEventSource.instances.at(-1);
    instance.emitMessage({ type: 'ping' });
    instance.emitMessage({ imageData: { status: 'captured' } });
    assert.ok(statuses.includes('Working…'));
    assert.equal(screenshots.length, 1);
    instance.emitError(new Error('boom'));
    assert.equal(errors.length, 1);
    assert.equal(instance.closed, true);
});
