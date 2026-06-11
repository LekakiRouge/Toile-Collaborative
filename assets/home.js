'use strict';

const $ = (id) => document.getElementById(id);

async function api(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({ ok: false, error: 'Réponse invalide' }));
  if (!res.ok || !data.ok) {
    throw new Error(data.error || 'Erreur serveur');
  }
  return data;
}

$('createBtn').addEventListener('click', async () => {
  const msg = $('createMsg');
  msg.textContent = 'Création...';
  msg.className = 'msg';
  try {
    const data = await api('api/create.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: $('newName').value,
        width: parseInt($('newWidth').value, 10),
        height: parseInt($('newHeight').value, 10),
        bg_color: $('newBg').value,
      }),
    });
    window.location.href = 'canvas.php?c=' + encodeURIComponent(data.slug);
  } catch (e) {
    msg.textContent = e.message;
    msg.classList.add('error');
  }
});

function extractSlug(value) {
  value = value.trim();
  if (!value) return '';
  const m = value.match(/[?&]c=([^&]+)/);
  if (m) return decodeURIComponent(m[1]);
  return value;
}

$('joinBtn').addEventListener('click', () => {
  const slug = extractSlug($('joinInput').value);
  if (slug) {
    window.location.href = 'canvas.php?c=' + encodeURIComponent(slug);
  }
});

$('joinInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('joinBtn').click();
});
