const ZOOM_WARNING_MODAL_ID = 'zoom-warning-modal';
const ZOOM_WARNING_TEXT_ID = 'zoom-warning-text';
const ZOOM_WARNING_DISMISS_ID = 'zoom-warning-dismiss';
const ZOOM_WARNING_SET_ID = 'zoom-warning-set';
const CHECK_INTERVAL_MS = 500;
const EXPECTED_ZOOM_PERCENT = 100;
const MODAL_STYLE_PROPERTIES = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 99999,
    background: '#d90000',
    color: '#fff',
    fontFamily: 'sans-serif',
    fontSize: '16px',
    padding: '16px 24px',
    borderRadius: '8px',
    textAlign: 'center',
    display: 'none',
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
};
const BUTTON_STYLE_PROPERTIES = {
    background: '#fff',
    color: '#d90000',
    border: 'none',
    borderRadius: '4px',
    padding: '8px 16px',
    cursor: 'pointer'
};
let dismissedZoomPercent = null;
let correctedZoomRatio = null;
function enforceZoomWatcher() {
    let zoomWarningModal = document.getElementById(ZOOM_WARNING_MODAL_ID);
    if (!zoomWarningModal) {
        zoomWarningModal = createZoomWarningModal();
        document.body.appendChild(zoomWarningModal);
    }
    const zoomCheckInterval = setInterval(checkZoomLevel, CHECK_INTERVAL_MS);
    checkZoomLevel();
    return zoomCheckInterval;
}
function createZoomWarningModal() {
    const modalElement = document.createElement('div');
    modalElement.id = ZOOM_WARNING_MODAL_ID;
    Object.assign(modalElement.style, MODAL_STYLE_PROPERTIES);
    const messageElement = document.createElement('div');
    messageElement.id = ZOOM_WARNING_TEXT_ID;
    messageElement.style.marginBottom = '12px';
    modalElement.appendChild(messageElement);
    const actionsContainer = document.createElement('div');
    actionsContainer.style.display = 'flex';
    actionsContainer.style.gap = '8px';
    actionsContainer.style.justifyContent = 'center';
    const setButton = createModalButton(ZOOM_WARNING_SET_ID, 'Set zoom to 100%');
    setButton.addEventListener('click', handleSetZoomClick);
    actionsContainer.appendChild(setButton);
    const dismissButton = createModalButton(ZOOM_WARNING_DISMISS_ID, 'Dismiss');
    dismissButton.addEventListener('click', handleDismissClick);
    actionsContainer.appendChild(dismissButton);
    modalElement.appendChild(actionsContainer);
    return modalElement;
}
function createModalButton(id, text) {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = id;
    button.textContent = text;
    Object.assign(button.style, BUTTON_STYLE_PROPERTIES);
    return button;
}
function getZoomPercent() {
    const devicePixelRatio = window.devicePixelRatio;
    let zoomRatio;
    if (devicePixelRatio) {
        zoomRatio = devicePixelRatio;
    } else {
        const outerWindowWidth = window.outerWidth;
        const innerWindowWidth = window.innerWidth;
        zoomRatio = outerWindowWidth / innerWindowWidth;
    }
    const zoomPercentage = Math.round(zoomRatio * 100);
    return zoomPercentage;
}
function checkZoomLevel() {
    const currentZoom = getZoomPercent();
    const isExpectedZoom = currentZoom === EXPECTED_ZOOM_PERCENT;
    if (isExpectedZoom) {
        clearZoomCorrection();
        resetDismissedZoom();
        hideModal();
        return;
    }
    const isDismissedZoom = dismissedZoomPercent === currentZoom;
    if (isDismissedZoom) {
        return;
    }
    setWarningMessage(currentZoom);
    showModal();
}
function setWarningMessage(zoomValue) {
    const warningText = `⚠️ Browser zoom is ${zoomValue}%. Set zoom to 100% for accurate captures.`;
    const warningMessage = document.getElementById(ZOOM_WARNING_TEXT_ID);
    if (!warningMessage) {
        return;
    }
    warningMessage.textContent = warningText;
}
function showModal() {
    dismissedZoomPercent = null;
    const zoomWarningModal = document.getElementById(ZOOM_WARNING_MODAL_ID);
    zoomWarningModal.style.display = 'block';
}
function hideModal() {
    const zoomWarningModal = document.getElementById(ZOOM_WARNING_MODAL_ID);
    zoomWarningModal.style.display = 'none';
}
function handleDismissClick() {
    const currentZoom = getZoomPercent();
    dismissedZoomPercent = currentZoom;
    hideModal();
}
function handleSetZoomClick() {
    const currentZoom = getZoomPercent();
    applyZoomCorrection(currentZoom);
    dismissedZoomPercent = currentZoom;
    hideModal();
}
function applyZoomCorrection(currentZoom) {
    const htmlElement = document.documentElement;
    if (!htmlElement) {
        return;
    }
    if (currentZoom === 0) {
        return;
    }
    if (currentZoom === EXPECTED_ZOOM_PERCENT) {
        clearZoomCorrection();
        return;
    }
    const zoomRatio = EXPECTED_ZOOM_PERCENT / currentZoom;
    htmlElement.style.zoom = `${zoomRatio}`;
    const bodyElement = document.body;
    if (bodyElement) {
        bodyElement.style.zoom = `${zoomRatio}`;
    }
    correctedZoomRatio = zoomRatio;
}
function clearZoomCorrection() {
    const htmlElement = document.documentElement;
    if (!htmlElement) {
        return;
    }
    if (correctedZoomRatio === null) {
        return;
    }
    htmlElement.style.zoom = '';
    const bodyElement = document.body;
    if (bodyElement) {
        bodyElement.style.zoom = '';
    }
    correctedZoomRatio = null;
}
function resetDismissedZoom() {
    dismissedZoomPercent = null;
}
enforceZoomWatcher();
