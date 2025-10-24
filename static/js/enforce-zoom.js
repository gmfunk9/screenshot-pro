const ZOOM_WARNING_MODAL_ID = 'zoom-warning-modal';
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
    if (currentZoom !== EXPECTED_ZOOM_PERCENT) {
        setWarningMessage(currentZoom);
        showModal();
    } else {
        hideModal();
    }
}
function setWarningMessage(zoomValue) {
    const warningText = `⚠️ Browser zoom is ${zoomValue}%. Set zoom to 100% for accurate captures.`;
    const zoomWarningModal = document.getElementById(ZOOM_WARNING_MODAL_ID);
    zoomWarningModal.textContent = warningText;
}
function showModal() {
    const zoomWarningModal = document.getElementById(ZOOM_WARNING_MODAL_ID);
    zoomWarningModal.style.display = 'block';
}
function hideModal() {
    const zoomWarningModal = document.getElementById(ZOOM_WARNING_MODAL_ID);
    zoomWarningModal.style.display = 'none';
}
enforceZoomWatcher();