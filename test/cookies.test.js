import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCookies } from '../src/cookies.js';

test('parseCookies returns cookie objects', () => {
    const result = parseCookies('a=1; b=2', 'http://example.com/app');
    assert.equal(result.length, 2);
    assert.deepEqual(result[0], {
        name: 'a',
        value: '1',
        domain: 'example.com',
        path: '/'
    });
    assert.deepEqual(result[1], {
        name: 'b',
        value: '2',
        domain: 'example.com',
        path: '/'
    });
});
