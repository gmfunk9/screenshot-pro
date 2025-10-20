import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { screenshotExists, sitemapCacheDir, generateFilePaths } from '../src/file.js';

const tmpDir = path.join(process.cwd(), 'tmp-test');

fs.mkdirSync(tmpDir, { recursive: true });

const tmpFile = path.join(tmpDir, 'test.png');
fs.writeFileSync(tmpFile, '');

// Test screenshotExists

test('screenshotExists detects files', () => {
    assert.equal(screenshotExists(tmpFile), true);
});

// Test sitemapCacheDir creates directory

test('sitemapCacheDir ensures dir', () => {
    const dir = sitemapCacheDir();
    assert.equal(fs.existsSync(dir), true);
});

// Test generateFilePaths output

test('generateFilePaths builds paths', () => {
    const { finalFilePath, relativePath } = generateFilePaths('http://example.com/page', 'desktop');
    assert.ok(finalFilePath.includes('example_com'));
    assert.match(relativePath, /^\/static\/screenshots\/\d+\/example_com\//);
    assert.ok(finalFilePath.endsWith('page_desktop.png'));
});

test('generateFilePaths appends mode slug', () => {
    const { finalFilePath, relativePath } = generateFilePaths('http://example.com/page', 'mobile');
    assert.ok(finalFilePath.endsWith('page_mobile.png'));
    assert.ok(relativePath.endsWith('page_mobile.png'));
});

test.after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
});
