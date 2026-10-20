/* Обёртка над YouTube IFrame API: воспроизведение фрагмента [start, end), подготовка с паузой, зацикливание тактов. */
window.YTP = (function () {
  'use strict';
  let player = null, ready = false, stopTimer = null, currentId = null, pendingPrepare = null, cueTimer = null;
  const cbs = { state: null, error: null };

  function loadApi() {
    if (window.YT && window.YT.Player) return Promise.resolve();
    return new Promise(res => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (prev) prev(); res(); };
      const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(s);
    });
  }

  async function create(elId) {
    await loadApi();
    return new Promise(res => {
      player = new YT.Player(elId, {
        width: '100%', height: '100%',
        playerVars: { rel: 0, modestbranding: 1, controls: 1, playsinline: 1, origin: location.origin },
        events: {
          onReady: () => { ready = true; res(player); },
          onStateChange: e => {
            if (e.data === 1 && pendingPrepare) {
              const p = pendingPrepare; pendingPrepare = null;
              player.seekTo(p.start, true); player.pauseVideo(); player.unMute();
              p.resolve();
            }
            if (cbs.state) cbs.state(e.data);
          },
          onError: e => { pendingPrepare = null; if (cbs.error) cbs.error(e.data); },
        },
      });
    });
  }

  let loopStart = null;
  function stopAt(end) {
    clearInterval(stopTimer);
    if (end == null) return;
    stopTimer = setInterval(() => {
      const st = state();
      if (st === 0 && loopStart != null) { player.seekTo(loopStart, true); player.playVideo(); return; }
      if (st === 0 || st === 2 || st === -1) return; // уже закончилось, на паузе или не началось
      if (time() >= end - 0.03) {
        if (loopStart != null) player.seekTo(loopStart, true);
        else { player.pauseVideo(); clearInterval(stopTimer); }
      }
    }, 40);
  }

  /* Показать нужное видео без воспроизведения (с задержкой, чтобы серия быстрых вызовов не ломала плеер). */
  function cue(videoId, start) {
    clearTimeout(cueTimer);
    cueTimer = setTimeout(() => {
      if (!ready || currentId === videoId) return;
      clearInterval(stopTimer);
      player.cueVideoById({ videoId, startSeconds: start || 0 });
      currentId = videoId;
    }, 200);
  }

  /* Загрузить и начать играть с start, остановиться на end. Всегда через loadVideoById: это единственный надёжный старт. */
  function playRange(videoId, start, end, loop) {
    if (!ready) return;
    clearTimeout(cueTimer); pendingPrepare = null;
    loopStart = loop ? start : null;
    player.unMute();
    // при зацикливании endSeconds плееру не передаём: иначе он завершает видео, а не пауза
    player.loadVideoById(end != null && !loop ? { videoId, startSeconds: start, endSeconds: end } : { videoId, startSeconds: start });
    currentId = videoId;
    stopAt(end);
  }
  function setLoop(on, start) { loopStart = on ? start : null; }

  /* Подготовить видео к мгновенному старту: загрузить без звука, поставить на паузу на start. */
  function prepare(videoId, start, end) {
    if (!ready) return Promise.resolve();
    clearTimeout(cueTimer); clearInterval(stopTimer);
    return new Promise(resolve => {
      pendingPrepare = { start, resolve };
      player.mute();
      player.loadVideoById(end != null ? { videoId, startSeconds: start, endSeconds: end } : { videoId, startSeconds: start });
      currentId = videoId;
      setTimeout(() => { if (pendingPrepare && pendingPrepare.resolve === resolve) { pendingPrepare = null; player.unMute(); resolve(); } }, 4000);
    });
  }
  function resume(end) { if (!ready) return; loopStart = null; player.unMute(); player.playVideo(); stopAt(end); }

  function destroy() { cbs.state = null; cbs.error = null; clearInterval(stopTimer); clearTimeout(cueTimer); pendingPrepare = null; loopStart = null; currentId = null; ready = false; if (player) { try { player.destroy(); } catch (e) { /* плеер уже снят вместе с DOM */ } } player = null; }
  function pause() { clearInterval(stopTimer); loopStart = null; if (ready) player.pauseVideo(); }
  function play() { clearInterval(stopTimer); if (ready) player.playVideo(); }
  function time() { if (!ready) return 0; const t = player.getCurrentTime(); return typeof t === 'number' && isFinite(t) ? t : 0; }
  function seek(t) { if (ready) player.seekTo(Math.max(0, t), true); }
  function rate(r) { if (ready) player.setPlaybackRate(r); }
  function state() { if (!ready) return -1; const st = player.getPlayerState(); return typeof st === 'number' ? st : -1; }

  const ERRORS = { 2: 'неверный ID видео', 5: 'ошибка HTML5-плеера', 100: 'видео не найдено или скрыто', 101: 'владелец запретил встраивание', 150: 'владелец запретил встраивание' };
  function parseId(s) {
    s = (s || '').trim();
    const m = /(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/.exec(s);
    if (m) return m[1];
    return /^[\w-]{11}$/.test(s) ? s : null;
  }

  return { create, cue, playRange, prepare, resume, setLoop, pause, play, time, seek, rate, state, parseId, destroy, ERRORS, on: (ev, cb) => { cbs[ev] = cb; }, get ready() { return ready; }, get player() { return player; }, get currentId() { return currentId; } };
})();
