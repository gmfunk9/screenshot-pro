const PLACEHOLDER_TEXT = 'Screenshots will appear here as they finish.';

function formatMode(mode) {
    if (!mode) return 'Desktop';
    const lower = mode.toLowerCase();
    if (lower === 'mobile') return 'Mobile';
    if (lower === 'tablet') return 'Tablet';
    if (lower === 'desktop') return 'Desktop';
    return mode;
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
    const card = document.createElement('article');
    card.className = 'card';

    const header = document.createElement('header');
    header.className = 'card__meta';
    let hasHeader = false;
    if (image.host) {
        const title = document.createElement('p');
        title.className = 'card__title';
        title.textContent = image.host;
        header.appendChild(title);
        hasHeader = true;
    }
    if (image.mode) {
        const badge = document.createElement('span');
        badge.className = 'card__badge';
        badge.textContent = formatMode(image.mode);
        header.appendChild(badge);
        hasHeader = true;
    }
    if (hasHeader) card.appendChild(header);

    const media = document.createElement('img');
    media.className = 'card__media';
    media.src = image.imageUrl;
    media.alt = image.pageTitle || 'Captured screenshot';
    applySize(media, image.dimensions);

    const actions = document.createElement('div');
    actions.className = 'card__actions';
    actions.appendChild(buildLink(image.pageUrl, 'View page'));
    actions.appendChild(buildLink(image.imageUrl, 'View image'));

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

export function createGallery(container) {
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
        container.appendChild(card);
    }

    function clear() {
        showPlaceholder();
    }

    showPlaceholder();

    return { append, clear };
}
