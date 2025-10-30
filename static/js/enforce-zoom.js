const ZOOM_WARNING_MODAL_ID = 'zoom-warning-modal';
const ZOOM_WARNING_TEXT_ID = 'zoom-warning-text';
const ZOOM_WARNING_DISMISS_ID = 'zoom-warning-dismiss';
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
let dismissedZoomPercent = null;
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
    const dismissButton = document.createElement('button');
    dismissButton.type = 'button';
    dismissButton.id = ZOOM_WARNING_DISMISS_ID;
    dismissButton.textContent = 'Dismiss';
    dismissButton.style.background = '#fff';
    dismissButton.style.color = '#d90000';
    dismissButton.style.border = 'none';
    dismissButton.style.borderRadius = '4px';
    dismissButton.style.padding = '8px 16px';
    dismissButton.style.cursor = 'pointer';
    dismissButton.addEventListener('click', handleDismissClick);
    modalElement.appendChild(dismissButton);
    return modalElement;
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
function resetDismissedZoom() {
    dismissedZoomPercent = null;
}
enforceZoomWatcher();
