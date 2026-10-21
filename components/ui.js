/* Императивные помощники интерфейса: тост, подтверждение у кнопки, свои подсказки для [data-tip]. Только в браузере. */
export function toast(msg) {
  let el = document.getElementById('toast'); if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('show'), 3500);
}
export function confirmPop(anchor, text) {
  return new Promise(resolve => {
    document.querySelectorAll('.confirm-pop').forEach(p => p.remove());
    const pop = document.createElement('div'); pop.className = 'confirm-pop';
    pop.innerHTML = `<div class="confirm-text">${text}</div><div class="confirm-actions"><button class="btn mini" data-ok>Да</button><button class="btn quiet mini" data-no>Отмена</button></div>`;
    document.body.appendChild(pop);
    const r = anchor.getBoundingClientRect(), b = pop.getBoundingClientRect();
    let left = r.left + r.width / 2 - b.width / 2; left = Math.max(8, Math.min(left, window.innerWidth - b.width - 8));
    pop.style.left = left + window.scrollX + 'px'; pop.style.top = r.bottom + 8 + window.scrollY + 'px';
    const done = v => { pop.remove(); document.removeEventListener('click', outside, true); document.removeEventListener('keydown', esc); resolve(v); };
    const outside = ev => { if (!pop.contains(ev.target)) done(false); };
    const esc = ev => { if (ev.key === 'Escape') done(false); };
    pop.querySelector('[data-ok]').addEventListener('click', () => done(true));
    pop.querySelector('[data-no]').addEventListener('click', () => done(false));
    setTimeout(() => { document.addEventListener('click', outside, true); document.addEventListener('keydown', esc); }, 0);
    pop.querySelector('[data-no]').focus();
  });
}
export function installTips() {
  if (window.__etTips) return; window.__etTips = true;
  let bubble, cur, timer;
  const hide = () => { clearTimeout(timer); if (bubble) bubble.hidden = true; cur = null; };
  const show = el => {
    const text = el.dataset.tip; if (!text) return;
    if (!bubble) { bubble = document.createElement('div'); bubble.className = 'tip-bubble'; bubble.hidden = true; document.body.appendChild(bubble); }
    bubble.textContent = text; bubble.hidden = false; cur = el;
    const r = el.getBoundingClientRect(), b = bubble.getBoundingClientRect();
    let left = r.left + r.width / 2 - b.width / 2; left = Math.max(8, Math.min(left, window.innerWidth - b.width - 8));
    const below = r.bottom + 8 + b.height < window.innerHeight;
    bubble.classList.toggle('above', !below);
    bubble.style.left = left + window.scrollX + 'px';
    bubble.style.top = (below ? r.bottom + 8 : r.top - b.height - 8) + window.scrollY + 'px';
  };
  const target = ev => ev.target.closest && ev.target.closest('[data-tip]');
  document.addEventListener('mouseover', ev => { const el = target(ev); if (!el || el === cur) return; clearTimeout(timer); timer = setTimeout(() => show(el), 350); });
  document.addEventListener('mouseout', ev => { const el = target(ev); if (el && !el.contains(ev.relatedTarget)) hide(); });
  document.addEventListener('focusin', ev => { const el = target(ev); if (el) show(el); });
  document.addEventListener('focusout', hide);
  document.addEventListener('mousedown', hide, true);
  document.addEventListener('scroll', hide, true);
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape') hide(); });
}
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export function weightedPick(arr, weight) {
  const w = arr.map(weight); const sum = w.reduce((a, b) => a + b, 0); let r = Math.random() * sum;
  for (let i = 0; i < arr.length; i++) { r -= w[i]; if (r <= 0) return arr[i]; }
  return arr[arr.length - 1];
}

/* Параметры в адресе без перезагрузки: обновление страницы и «назад» возвращают к тому же месту */
export function getQuery() { return typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search); }
export function setQuery(patch, push) {
  const q = getQuery();
  Object.entries(patch).forEach(([k, v]) => { if (v == null || v === '') q.delete(k); else q.set(k, String(v)); });
  const url = window.location.pathname + (q.toString() ? '?' + q.toString() : '');
  if (url === window.location.pathname + window.location.search) return;
  (push ? window.history.pushState : window.history.replaceState).call(window.history, null, '', url);
}
