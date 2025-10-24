function enforceZoomWatcher() {
    const id = 'zoom-warning-modal';
    let modal = document.getElementById(id);

    if (!modal) {
        modal = document.createElement('div');
        modal.id = id;
        Object.assign(modal.style, {
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
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        });
        document.body.appendChild(modal);
    }

    function getZoomPercent() {
        const ratio = window.devicePixelRatio || (window.outerWidth / window.innerWidth);
        return Math.round(ratio * 100);
    }

    function checkZoom() {
        const zoom = getZoomPercent();
        if (zoom !== 100) {
            modal.textContent = `⚠️ Browser zoom is ${zoom}%. Set zoom to 100% for accurate captures.`;
            modal.style.display = 'block';
        } else {
            modal.style.display = 'none';
        }
    }

    checkZoom();
    setInterval(checkZoom, 500);
}

enforceZoomWatcher();
