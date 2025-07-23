import test from 'node:test';
import assert from 'node:assert/strict';

const imageData = { pageUrl: 'http://example.com', relativePath: '/img.jpg' };
const payload = `data: ${JSON.stringify({ imageData })}\n\n`;

test('SSE payload contains pageUrl', () => {
    const parsed = JSON.parse(payload.slice(6));
    assert.equal(parsed.imageData.pageUrl, imageData.pageUrl);
});
