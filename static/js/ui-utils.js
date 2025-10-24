function selectById(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error(`#${id} missing`);
    return el;
}

function disableForm(form, disabled) {
    const controls = Array.from(form.elements);
    for (const c of controls) c.disabled = disabled;
}

function writeStatus(target, msg) {
    if (!target) return;
    target.textContent = msg;
    target.scrollTop = target.scrollHeight;
}

function appendStatus(target, msg) {
    if (!target) return;
    target.textContent += `\n${msg}`;
    target.scrollTop = target.scrollHeight;
}
