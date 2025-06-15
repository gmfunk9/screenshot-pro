let active = 'd';

function refresh() {
  fetch('/api/shots').then(r => r.json()).then(data => {
    const container = document.getElementById('shots');
    container.innerHTML = '';
    data.forEach(item => {
      const card = document.createElement('div');
      card.className = 'card';
      const title = document.createElement('div');
      title.textContent = item.url;
      card.appendChild(title);
      ['d', 't', 'm'].forEach(v => {
        const img = document.createElement('img');
        img.src = `shots/${item.id}--${v}.png`;
        img.dataset.vp = v;
        if (v === active) { img.classList.add('active'); }
        card.appendChild(img);
      });
      container.appendChild(card);
    });
  });
}

function setViewport(v) {
  active = v;
  document.querySelectorAll('.vp-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.vp === v);
  });
  document.querySelectorAll('.card img').forEach(img => {
    img.classList.toggle('active', img.dataset.vp === v);
  });
}

document.getElementById('capture').onclick = () => {
  const url = document.getElementById('url').value;
  fetch('/api/capture', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  }).then(refresh);
};

document.querySelectorAll('.vp-btn').forEach(btn => {
  btn.onclick = () => setViewport(btn.dataset.vp);
});

refresh();
