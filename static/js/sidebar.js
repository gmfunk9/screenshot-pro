function setSidebarState(appShell, sidebar, toggleBtn, labelEl, iconEl, nextState) {
    appShell.dataset.sidebar = nextState;
    const expanded = nextState === 'expanded';

    toggleBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    sidebar.setAttribute('aria-hidden', expanded ? 'false' : 'true');

    if (labelEl) {
        labelEl.textContent = expanded ? 'Hide controls' : 'Show controls';
    }

    if (iconEl) {
        iconEl.textContent = expanded ? '⟨' : '⟩';
    }
}

function initSidebar(appShell, sidebar, toggleBtn, labelEl, iconEl) {
    let initial = appShell.dataset.sidebar || 'expanded';

    if (typeof window.matchMedia === 'function') {
        const query = window.matchMedia('(max-width: 960px)');
        if (query && query.matches) {
            initial = 'collapsed';
        }
    }

    setSidebarState(appShell, sidebar, toggleBtn, labelEl, iconEl, initial);

    toggleBtn.addEventListener('click', () => {
        const current = appShell.dataset.sidebar;
        const next = current === 'collapsed' ? 'expanded' : 'collapsed';
        setSidebarState(appShell, sidebar, toggleBtn, labelEl, iconEl, next);
    });
}
initSidebar(
    document.querySelector('.app-shell'),
    document.getElementById('sidebar'),
    document.getElementById('sidebarToggle'),
    document.getElementById('sidebarToggleLabel'),
    document.getElementById('sidebarToggleIcon')
);