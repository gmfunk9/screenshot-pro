import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { screenshotExists, sitemapCacheDir, generateFilePaths } from '../src/file.js';

const tmpDir = path.join(process.cwd(), 'tmp-test');

fs.mkdirSync(tmpDir, { recursive: true });

const tmpFile = path.join(tmpDir, 'test.jpg');
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
    const { finalFilePath, relativePath } = generateFilePaths('http://example.com/page');
    assert.ok(finalFilePath.includes('example_com'));
    assert.ok(relativePath.startsWith('/static/screenshots/example_com/'));
});

test.after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
});
