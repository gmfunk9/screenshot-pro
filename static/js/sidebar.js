function setSidebarState(appShell, sidebar, toggleBtn, labelEl, iconEl, nextState) {
  appShell.dataset.sidebar = nextState;
  const expanded = nextState === 'expanded';
  toggleBtn.setAttribute('aria-expanded', expanded);
  sidebar.setAttribute('aria-hidden', !expanded);
  if (labelEl) labelEl.textContent = expanded ? 'Hide controls' : 'Show controls';
  if (iconEl) iconEl.textContent = expanded ? '⟨' : '⟩';
}

function initSidebar(appShell, sidebar, toggleBtn, labelEl, iconEl) {
  let state = appShell.dataset.sidebar || 'expanded';
  setSidebarState(appShell, sidebar, toggleBtn, labelEl, iconEl, state);
  toggleBtn.addEventListener('click', () => {
    state = state === 'collapsed' ? 'expanded' : 'collapsed';
    setSidebarState(appShell, sidebar, toggleBtn, labelEl, iconEl, state);
  });
}

initSidebar(
  document.querySelector('.app-shell'),
  document.getElementById('sidebar'),
  document.getElementById('sidebarToggle'),
  document.getElementById('sidebarToggleLabel'),
  document.getElementById('sidebarToggleIcon')
);
