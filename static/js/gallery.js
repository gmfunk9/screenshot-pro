(function () {
    'use strict';

    const PLACEHOLDER_TEXT = 'Screenshots will appear here as they finish.';

    function normalizeModeValue(mode) {
        if (!mode) return 'desktop';
        if (typeof mode !== 'string') return 'desktop';
        const trimmed = mode.trim();
        if (trimmed === '') return 'desktop';
        return trimmed;
    }

    function formatMode(mode) {
        if (!mode) return 'Desktop';
        const lower = mode.toLowerCase();
        if (lower === 'mobile') return 'Mobile';
        if (lower === 'tablet') return 'Tablet';
        if (lower === 'desktop') return 'Desktop';
        return mode;
    }

    function normalizeDimensions(size) {
        const result = { width: 0, height: 0 };
        if (!size) return result;
        const width = Number(size.width);
        if (Number.isFinite(width)) result.width = width;
        const height = Number(size.height);
        if (Number.isFinite(height)) result.height = height;
        return result;
    }

    function describeImage(image) {
        if (!image) throw new Error('Missing image payload.');
        const normalizedMode = normalizeModeValue(image.mode);
        const meta = {
            host: '',
            pageTitle: 'Captured screenshot',
            pageUrl: '',
            imageUrl: '',
            mode: normalizedMode,
            modeLabel: formatMode(normalizedMode),
            dimensions: normalizeDimensions(image.dimensions),
            sourceDimensions: normalizeDimensions(image.sourceDimensions),
            mime: ''
        };
        if (typeof image.host === 'string') {
            if (image.host !== '') meta.host = image.host;
        }
        if (typeof image.pageTitle === 'string') {
            if (image.pageTitle !== '') meta.pageTitle = image.pageTitle;
        }
        if (typeof image.pageUrl === 'string') {
            if (image.pageUrl !== '') meta.pageUrl = image.pageUrl;
        }
        if (typeof image.imageUrl === 'string') {
            if (image.imageUrl !== '') meta.imageUrl = image.imageUrl;
        }
        if (typeof image.mime === 'string') {
            if (image.mime !== '') meta.mime = image.mime;
        }
        if (meta.imageUrl === '') throw new Error('Missing image URL; ensure capture stored.');
        return meta;
    }

    function buildPlaceholder() {
        const message = document.createElement('p');
        message.className = 'gallery__placeholder';
        message.textContent = PLACEHOLDER_TEXT;
        return message;
    }

    function buildLink(href, label) {
        const link = document.createElement('a');
        link.href = href;
        link.textContent = label;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        return link;
    }

    function applySize(media, size) {
        if (!size) return;
        const width = size.width;
        if (Number.isFinite(width)) media.width = width;
        const height = size.height;
        if (Number.isFinite(height)) media.height = height;
    }

    function buildImageCard(image) {
        let meta;
        try {
            meta = describeImage(image);
        } catch (error) {
            console.error(error);
            return null;
        }
        const card = document.createElement('article');
        card.className = 'card';

        const header = document.createElement('header');
        header.className = 'card__meta';
        let hasHeader = false;
        if (meta.host !== '') {
            const title = document.createElement('p');
            title.className = 'card__title';
            title.textContent = meta.host;
            header.appendChild(title);
            hasHeader = true;
        }
        if (meta.modeLabel !== '') {
            const badge = document.createElement('span');
            badge.className = 'card__badge';
            badge.textContent = meta.modeLabel;
            header.appendChild(badge);
            hasHeader = true;
        }
        if (hasHeader) card.appendChild(header);

        const media = document.createElement('img');
        media.className = 'card__media';
        media.loading = 'lazy';
        media.decoding = 'async';
        media.fetchPriority = 'low';
        media.alt = meta.pageTitle;
        applySize(media, meta.dimensions);
        media.src = meta.imageUrl;
        if (meta.mime !== '') media.dataset.mime = meta.mime;
        const source = meta.sourceDimensions;
        if (source.width > 0) media.dataset.sourceWidth = String(source.width);
        if (source.height > 0) media.dataset.sourceHeight = String(source.height);

        const actions = document.createElement('div');
        actions.className = 'card__actions';
        if (meta.pageUrl !== '') actions.appendChild(buildLink(meta.pageUrl, 'View page'));
        actions.appendChild(buildLink(meta.imageUrl, 'View image'));

        card.appendChild(media);
        card.appendChild(actions);
        return card;
    }

    function buildErrorCard(image) {
        const card = document.createElement('article');
        card.className = 'card';

        const message = document.createElement('div');
        message.className = 'card__actions';
        let prefix = 'Capture failed';
        if (image.mode) {
            const modeLabel = formatMode(image.mode);
            prefix = `Capture failed (${modeLabel})`;
        }
        message.textContent = `${prefix}: ${image.error}`;

        card.appendChild(message);
        return card;
    }

    function createGallery(container) {
        if (!container) throw new Error('Missing gallery container.');

        let empty = true;

        function showPlaceholder() {
            container.dataset.empty = '';
            container.innerHTML = '';
            container.appendChild(buildPlaceholder());
            empty = true;
        }

        function ensureContent() {
            if (!empty) return;
            container.removeAttribute('data-empty');
            container.innerHTML = '';
            empty = false;
        }

        function append(image) {
            if (!image) return;
            ensureContent();
            if (image.status === 'error') {
                const errorCard = buildErrorCard(image);
                container.appendChild(errorCard);
                return;
            }
            const card = buildImageCard(image);
            if (!card) return;
            const batch = document.createDocumentFragment();
            batch.appendChild(card);
            container.appendChild(batch);
        }

        function clear() {
            showPlaceholder();
        }

        showPlaceholder();

        return { append, clear };
    }

    const root = window;
    if (!root.ScreenshotGallery) {
        root.ScreenshotGallery = {};
    }
    root.ScreenshotGallery.describeImage = describeImage;
    root.ScreenshotGallery.createGallery = createGallery;
})();
