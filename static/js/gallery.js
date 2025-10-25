const PLACEHOLDER_TEXT = 'Screenshots will appear here as they finish.';
function getUsage() {
    const root = window.ScreenshotGallery;
    if (!root) {
        return null;
    }
    const usage = root.usage;
    if (!usage) {
        return null;
    }
    return usage;
}
function normalizeModeValue(mode) {
    if (!mode) {
        return 'desktop';
    }
    if (typeof mode !== 'string') {
        return 'desktop';
    }
    const trimmedMode = mode.trim();
    if (trimmedMode === '') {
        return 'desktop';
    }
    return trimmedMode;
}
function formatMode(mode) {
    if (!mode) {
        return 'Desktop';
    }
    const lowerCaseMode = mode.toLowerCase();
    if (lowerCaseMode === 'mobile') {
        return 'Mobile';
    }
    if (lowerCaseMode === 'tablet') {
        return 'Tablet';
    }
    if (lowerCaseMode === 'desktop') {
        return 'Desktop';
    }
    return mode;
}
function normalizeDimensions(size) {
    const result = { width: 0, height: 0 };
    if (!size) {
        return result;
    }
    const widthValue = Number(size.width);
    if (Number.isFinite(widthValue)) {
        result.width = widthValue;
    }
    const heightValue = Number(size.height);
    if (Number.isFinite(heightValue)) {
        result.height = heightValue;
    }
    return result;
}
function describeImage(image) {
    if (!image) {
        throw new Error('Missing image payload.');
    }
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
        if (image.host !== '') {
            meta.host = image.host;
        }
    }
    if (typeof image.pageTitle === 'string') {
        if (image.pageTitle !== '') {
            meta.pageTitle = image.pageTitle;
        }
    }
    if (typeof image.pageUrl === 'string') {
        if (image.pageUrl !== '') {
            meta.pageUrl = image.pageUrl;
        }
    }
    if (typeof image.imageUrl === 'string') {
        if (image.imageUrl !== '') {
            meta.imageUrl = image.imageUrl;
        }
    }
    if (typeof image.mime === 'string') {
        if (image.mime !== '') {
            meta.mime = image.mime;
        }
    }
    if (meta.imageUrl === '') {
        throw new Error('Missing image URL; ensure capture stored.');
    }
    return meta;
}
const root = window;
if (!root.ScreenshotGallery) {
    root.ScreenshotGallery = {};
}
const container = document.getElementById('result');
if (!container) {
    throw new Error('Missing gallery container #result.');
}
const templateCard = document.getElementById('gallery-card-template');
if (!templateCard) {
    throw new Error('Missing #gallery-card-template.');
}
const templateError = document.getElementById('gallery-error-template');
if (!templateError) {
    throw new Error('Missing #gallery-error-template.');
}
const templatePlaceholder = document.getElementById('gallery-placeholder-template');
if (!templatePlaceholder) {
    throw new Error('Missing #gallery-placeholder-template.');
}
let isGalleryEmpty = container.hasAttribute('data-empty');
function showPlaceholder() {
    container.setAttribute('data-empty', '');
    container.innerHTML = '';
    const clonedNode = templatePlaceholder.content.cloneNode(true);
    container.appendChild(clonedNode);
    isGalleryEmpty = true;
}
function ensureContent() {
    if (!isGalleryEmpty) {
        return;
    }
    container.removeAttribute('data-empty');
    container.innerHTML = '';
    isGalleryEmpty = false;
}
function append(image) {
    if (!image) {
        return;
    }
    ensureContent();
    if (image.status === 'error') {
        const fragment = templateError.content.cloneNode(true);
        const actionsBox = fragment.querySelector('.card__actions');
        let modeForError = image.mode;
        if (!modeForError) {
            modeForError = 'desktop';
        }
        const modeLabel = formatMode(modeForError);
        actionsBox.textContent = `Capture failed (${modeLabel}): ${image.error}`;
        container.appendChild(fragment);
        return;
    }
    let meta;
    try {
        meta = describeImage(image);
    } catch (error) {
        const fragment = templateError.content.cloneNode(true);
        const actionsBox = fragment.querySelector('.card__actions');
        let errorMessage = 'Unknown error';
        if (error) {
            if (error.message) {
                errorMessage = error.message;
            }
        }
        actionsBox.textContent = `Capture failed: ${errorMessage}`;
        container.appendChild(fragment);
        return;
    }
    const fragment = templateCard.content.cloneNode(true);
    const cardElement = fragment.querySelector('article.card');
    const headerElement = cardElement.querySelector('.card__meta');
    const titleElement = cardElement.querySelector('.card__title');
    const badgeElement = cardElement.querySelector('.card__badge');
    let urlHash = '';
    if (typeof image.urlHash === 'string') {
        const trimmedHash = image.urlHash.trim();
        if (trimmedHash !== '') {
            urlHash = trimmedHash;
        }
    }
    if (urlHash !== '') {
        cardElement.dataset.urlHash = urlHash;
    }
    cardElement.dataset.mode = meta.mode;
    let hasHeader = false;
    if (meta.host !== '') {
        titleElement.textContent = meta.host;
        hasHeader = true;
    } else {
        titleElement.remove();
    }
    if (meta.modeLabel !== '') {
        badgeElement.textContent = meta.modeLabel;
        hasHeader = true;
    } else {
        badgeElement.remove();
    }
    if (!hasHeader) {
        headerElement.remove();
    }
    const mediaElement = cardElement.querySelector('.card__media');
    mediaElement.alt = meta.pageTitle;
    if (meta.dimensions.width > 0) {
        mediaElement.width = meta.dimensions.width;
    }
    if (meta.dimensions.height > 0) {
        mediaElement.height = meta.dimensions.height;
    }
    mediaElement.src = meta.imageUrl;
    if (meta.mime !== '') {
        mediaElement.dataset.mime = meta.mime;
    }
    if (meta.sourceDimensions.width > 0) {
        mediaElement.dataset.sourceWidth = String(meta.sourceDimensions.width);
    }
    if (meta.sourceDimensions.height > 0) {
        mediaElement.dataset.sourceHeight = String(meta.sourceDimensions.height);
    }
    const actionsElement = cardElement.querySelector('.card__actions');
    const linkPageElement = actionsElement.querySelector('a[data-action="view-page"]');
    const linkImageElement = actionsElement.querySelector('a[data-action="view-image"]');
    if (meta.pageUrl !== '') {
        linkPageElement.href = meta.pageUrl;
    } else {
        linkPageElement.remove();
    }
    linkImageElement.href = meta.imageUrl;
    container.appendChild(fragment);
}
function clear(reason) {
    showPlaceholder();
    const usage = getUsage();
    if (usage) {
        let reasonLabel = 'unknown';
        if (typeof reason === 'string') {
            const trimmed = reason.trim();
            if (trimmed !== '') {
                reasonLabel = trimmed;
            }
        }
        usage.recordUsage('gallery-cleared', { reason: reasonLabel });
    }
}
function handleGalleryClick(event) {
    const usage = getUsage();
    if (!usage) {
        return;
    }
    const target = event.target;
    if (!target) {
        return;
    }
    if (typeof target.getAttribute !== 'function') {
        return;
    }
    const action = target.getAttribute('data-action');
    if (!action) {
        return;
    }
    if (typeof target.closest !== 'function') {
        return;
    }
    const cardElement = target.closest('article.card');
    if (!cardElement) {
        return;
    }
    let urlHash = '';
    if (cardElement.dataset.urlHash) {
        urlHash = cardElement.dataset.urlHash;
    }
    let mode = 'desktop';
    if (cardElement.dataset.mode) {
        mode = cardElement.dataset.mode;
    }
    if (action === 'view-page') {
        usage.recordUsage('gallery-view', { action: action, urlHash: urlHash, mode: mode });
        return;
    }
    if (action === 'view-image') {
        usage.recordUsage('gallery-download', { action: action, urlHash: urlHash, mode: mode });
        return;
    }
    if (action === 'share') {
        usage.recordUsage('gallery-share', { action: action, urlHash: urlHash, mode: mode });
    }
}
const hasNoChildren = !container.children.length;
if (hasNoChildren) {
    showPlaceholder();
}
if (container.hasAttribute('data-empty')) {
    showPlaceholder();
}
container.addEventListener('click', handleGalleryClick);
root.ScreenshotGallery.describeImage = describeImage;
root.ScreenshotGallery.gallery = { append, clear };
