/* Синхронно, до первой отрисовки: шапка пользователя из кэша localStorage (подтверждается сервером позже в common.js) */
(function () {
  var nav = document.querySelector('.nav'); if (!nav || nav.querySelector('.user-chip')) return;
  // подпункты Мажор / Минор у каждого упражнения
  Array.prototype.slice.call(nav.querySelectorAll('a')).forEach(function (a) {
    var href = a.getAttribute('href') || '';
    if (!/^(degrees|progressions|songs|melodies)\.html/.test(href)) return;
    var item = document.createElement('div'); item.className = 'nav-item' + (a.classList.contains('current') ? ' current' : '');
    a.parentNode.insertBefore(item, a); item.appendChild(a);
    var sub = document.createElement('div'); sub.className = 'nav-sub';
    sub.innerHTML = '<div class="nav-sub-box"><a href="' + href + '?mode=major">Мажор</a><a href="' + href + '?mode=minor">Минор</a></div>';
    item.appendChild(sub);
  });
  var u = null; try { u = JSON.parse(localStorage.getItem('etUser') || 'null'); } catch (e) {}
  var chip = document.createElement('span'); chip.className = 'user-chip';
  var onHistory = /history\.html$/.test(location.pathname);
  if (u) chip.innerHTML = '<a href="history.html" class="hist-link' + (onHistory ? ' current' : '') + '" data-tip="История" aria-label="История"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></a><a href="account.html" class="user-pill' + (/account\.html$/.test(location.pathname) ? ' current' : '') + '" data-tip="Аккаунт: ' + (u.email || '') + '">' + (u.name || '') + '</a><button class="link logout" id="btnLogout" data-tip="Выйти"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M21 3v18"/></svg></button>';
  else chip.innerHTML = '<a href="index.html?login=1" class="btn primary mini" id="btnLoginTop">Войти</a>';
  nav.appendChild(chip);
})();
