import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSitemapEntries } from '../src/sitemap.js';

test('normalizeSitemapEntries resolves relative sitemap entries', () => {
    const baseUrl = 'https://example.com/root/page';
    const entries = [
        'https://example.com/',
        '/about',
        { loc: '/contact' },
        { url: 'https://example.com/pricing' },
        '/about',
        null,
        { loc: '' }
    ];
    const result = normalizeSitemapEntries(baseUrl, entries);
    assert.deepEqual(result, [
        'https://example.com/',
        'https://example.com/about',
        'https://example.com/contact',
        'https://example.com/pricing'
    ]);
});

test('normalizeSitemapEntries skips invalid values', () => {
    const baseUrl = 'https://example.com/';
    const entries = [
        undefined,
        '',
        { foo: 'bar' },
        '   ',
        'mailto:info@example.com'
    ];
    const result = normalizeSitemapEntries(baseUrl, entries);
    assert.deepEqual(result, []);
});
