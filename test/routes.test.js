import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { createApp } from '../src/app.js';
import { newSession, clearSessionDisk } from '../src/session.js';

const app = createApp();

test.after(() => {
    clearSessionDisk();
});

test('POST /session creates a new session', async () => {
    const response = await request(app).post('/session');
    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.ok(response.body.session);
});

test('GET /session returns summary', async () => {
    const response = await request(app).get('/session');
    assert.equal(response.status, 200);
    assert.ok(response.body.id);
    assert.ok(Array.isArray(response.body.hosts));
});

test('DELETE /session clears active session', async () => {
    const response = await request(app).delete('/session');
    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
});

test('POST /capture rejects missing url', async () => {
    const response = await request(app).post('/capture').send({});
    assert.equal(response.status, 400);
    assert.equal(response.body.error, 'Missing field url; add to body.');
});

test('POST /capture rejects invalid mode', async () => {
    const response = await request(app)
        .post('/capture')
        .send({ url: 'https://example.com', mode: 'weird' });
    assert.equal(response.status, 400);
    assert.equal(response.body.error, 'Unsupported mode; use mobile, tablet, or desktop.');
});

test('GET /pdf fails without screenshots', async () => {
    const response = await request(app).get('/pdf');
    assert.equal(response.status, 400);
    assert.equal(response.body.error, 'No screenshots available for export.');
});

test('GET /pdf streams PDF when screenshots exist', async () => {
    const dir = newSession();
    const hostDir = path.join(dir, 'example_com');
    fs.mkdirSync(hostDir, { recursive: true });
    const imagePath = path.join(hostDir, 'home.png');
    await sharp({ create: { width: 10, height: 10, channels: 3, background: { r: 0, g: 0, b: 0 } } }).png().toFile(imagePath);
    const response = await request(app).get('/pdf');
    assert.equal(response.status, 200);
    assert.equal(response.header['content-type'], 'application/pdf');
    assert.ok(response.body.length > 0);
});
