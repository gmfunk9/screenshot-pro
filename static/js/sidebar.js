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
function setSidebarState(appShell, sidebar, toggleBtn, labelEl, iconEl, nextState) {
    appShell.dataset.sidebar = nextState;
    const isExpanded = nextState === 'expanded';
    toggleBtn.setAttribute('aria-expanded', isExpanded);
    const isHidden = !isExpanded;
    sidebar.setAttribute('aria-hidden', isHidden);
    if (labelEl) {
        let labelText;
        if (isExpanded) {
            labelText = 'Hide controls';
        } else {
            labelText = 'Show controls';
        }
        labelEl.textContent = labelText;
    }
    if (iconEl) {
        let iconText;
        if (isExpanded) {
            iconText = '⟨';
        } else {
            iconText = '⟩';
        }
        iconEl.textContent = iconText;
    }
}
function initSidebar(appShell, sidebar, toggleBtn, labelEl, iconEl) {
    let currentState = appShell.dataset.sidebar || 'expanded';
    setSidebarState(appShell, sidebar, toggleBtn, labelEl, iconEl, currentState);
    toggleBtn.addEventListener('click', () => {
        let newState;
        if (currentState === 'collapsed') {
            newState = 'expanded';
        } else {
            newState = 'collapsed';
        }
        currentState = newState;
        setSidebarState(appShell, sidebar, toggleBtn, labelEl, iconEl, currentState);
        const usage = getUsage();
        if (!usage) {
            return;
        }
        let stateLabel = 'closed';
        if (currentState === 'expanded') {
            stateLabel = 'open';
        }
        usage.recordUsage('sidebar-toggle', { state: stateLabel });
    });
}
initSidebar(
    document.querySelector('.app-shell'),
    document.getElementById('sidebar'),
    document.getElementById('sidebarToggle'),
    document.getElementById('sidebarToggleLabel'),
    document.getElementById('sidebarToggleIcon')
);
