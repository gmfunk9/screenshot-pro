import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createGallery } from '../static/js/gallery.js';

function setupDom() {
    const dom = new JSDOM('<div id="gallery"></div>');
    global.window = dom.window;
    global.document = dom.window.document;
    return dom.window.document.getElementById('gallery');
}

test.afterEach(() => {
    delete global.window;
    delete global.document;
});

test('gallery renders cards for captures', () => {
    const container = setupDom();
    const gallery = createGallery(container);
    gallery.append({
        status: 'captured',
        imageUrl: '/static/screenshots/test.jpg',
        pageUrl: 'https://example.com',
        dimensions: { width: 100, height: 200 }
    });
    const cards = container.querySelectorAll('.card');
    assert.equal(cards.length, 1);
    const image = cards[0].querySelector('img');
    assert.equal(image.src.endsWith('/static/screenshots/test.jpg'), true);
    gallery.clear();
    assert.equal(container.querySelectorAll('.card').length, 0);
});

test('gallery renders failure messages', () => {
    const container = setupDom();
    const gallery = createGallery(container);
    gallery.append({ status: 'error', error: 'Boom' });
    const card = container.querySelector('.card');
    assert.ok(card.textContent.includes('Boom'));
});
