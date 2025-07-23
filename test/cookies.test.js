import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCookies } from '../src/cookies.js';

test('parseCookies returns single cookie object', () => {
    const result = parseCookies('a', '1', 'http://example.com/app');
    assert.equal(result.length, 1);
    assert.deepEqual(result[0], {
        name: 'a',
        value: '1',
        domain: 'example.com',
        path: '/'
    });
});
