/* Страница «Аккаунт»: смена почты и пароля */
ET.ready.then(function () {
  'use strict';
  const $ = ET.$;
  $('#accEmail').value = ET.store.user ? ET.store.user.email : ''; $('#accCurrent').textContent = ET.store.user ? ET.store.user.email : '';
  $('#emailForm').addEventListener('submit', async ev => {
    ev.preventDefault(); $('#emailErr').textContent = ''; $('#emailOk').textContent = '';
    try {
      const d = await ET.api('POST', '/account/email', { email: $('#accEmail').value, password: $('#accEmailPass').value });
      ET.store.user = d.user; localStorage.setItem('etUser', JSON.stringify(d.user));
      document.querySelectorAll('.user-pill').forEach(p => p.dataset.tip = 'Аккаунт: ' + d.user.email); $('#accCurrent').textContent = d.user.email;
      $('#accEmailPass').value = ''; $('#emailOk').textContent = 'Почта изменена'; ET.toast('Почта изменена');
    } catch (e) { $('#emailErr').textContent = e.message; }
  });
  $('#passForm').addEventListener('submit', async ev => {
    ev.preventDefault(); $('#passErr').textContent = ''; $('#passOk').textContent = '';
    if ($('#accNewPass').value !== $('#accNewPass2').value) { $('#passErr').textContent = 'Новые пароли не совпадают'; return; }
    try {
      await ET.api('POST', '/account/password', { password: $('#accOldPass').value, newPassword: $('#accNewPass').value });
      ['#accOldPass', '#accNewPass', '#accNewPass2'].forEach(s => { $(s).value = ''; });
      $('#passOk').textContent = 'Пароль изменён'; ET.toast('Пароль изменён');
    } catch (e) { $('#passErr').textContent = e.message; }
  });
});
