#!/usr/bin/env python3
"""Проверка фрагментов корпуса по записи, такт за тактом: для каждого аккорда фрагмента берётся его окно в записи,
по хроме выбирается лучшее трезвучие, и аккорд засчитывается, если размеченный не хуже лучшего (с небольшим допуском).
Фрагмент проходит, если промахов не больше n//6 (4 такта — ни одного, 8 — один).
python3 -I tools/verify.py corpus.json chords.json workdir yt-dlp cookies pot_url out.jsonl [max_songs]
corpus.json — массив записей (node tools/dump-corpus.js > corpus.json); результат — jsonl {id, ok, n, misses, bars}."""
import json, sys, os, subprocess, time, random, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
_src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'calibrate.py')).read()
_ns = {}; exec(_src[:_src.index('def main')], _ns)
chroma, template, TRIADS, NOTE = _ns['chroma'], _ns['template'], _ns['TRIADS'], _ns['NOTE']
from chordroot import bar_ok
TOL = 0.015  # допуск: размеченный аккорд засчитывается, если его оценка не ниже лучшего трезвучия минус TOL (жёстко: иначе проскакивают чужие такты)

from scipy.io import wavfile
from scipy.signal import stft as _stft
def tempo_estimate(path):
    """Темп записи по автокорреляции спектрального потока, 60–200 bpm. Неоднозначность ×2 и ×1.5 допускается при сравнении."""
    sr, y = wavfile.read(path)
    if y.ndim > 1: y = y.mean(axis=1)
    y = y.astype(np.float64) / (np.abs(y).max() + 1e-9)
    hop = 512; f, t, Z = _stft(y, fs=sr, nperseg=2048, noverlap=2048 - hop, window='hann', padded=False, boundary=None)
    mag = np.log1p(10 * np.abs(Z)); flux = np.maximum(np.diff(mag, axis=1), 0).sum(axis=0); flux -= flux.mean()
    fps = sr / hop; lags = np.arange(int(fps * 60 / 200), int(fps * 60 / 60) + 1)
    ac = np.array([np.dot(flux[:-l], flux[l:]) / (len(flux) - l) for l in lags])
    return float(60.0 * fps / lags[int(np.argmax(ac))])
def grid_score(t, C, start, bpm, span=45.0):
    """Насколько смены аккордов в записи ложатся на тактовые черты сетки (start, bpm): больше — лучше. Для сравнения сеток одной записи."""
    fps = 1 / (t[1] - t[0]); k = max(1, int(0.12 * fps))
    d = 1 - np.einsum('ij,ij->j', C[:, :-k], C[:, k:]); d = np.convolve(d, np.ones(k) / k, mode='same'); base = d.mean() + 1e-9
    bar = 240 / bpm; lo = max(0, start - span); hi = min(t[-1] - 1, start + span)
    g = [start + n * bar for n in range(int((lo - start) / bar) - 1, int((hi - start) / bar) + 1) if lo <= start + n * bar <= hi]
    return float(np.mean([d[int(x * fps)] for x in g]) / base) if g else 0.0
def halves_agree(t, C, rec):
    """Доля тактов, у которых обе половины дают одно трезвучие: верная сетка не режет такты по смене аккорда."""
    fps = 1 / (t[1] - t[0]); bpb = rec.get('beatsPerBar') or 4; beat = 60.0 / rec['bpm']; pos = rec['start']; agree = 0; n = 0
    for c in rec['chords']:
        beats = c.get('beats', bpb); a, b = pos, pos + beats * beat; pos = b; m = (a + b) / 2
        h1 = C[:, int(a * fps):int(m * fps)]; h2 = C[:, int(m * fps):int(b * fps)]
        if h1.shape[1] < 2 or h2.shape[1] < 2: continue
        best = lambda v: max(((float(template(p) @ v), NOTE[p[0]]) for _, p in TRIADS))[1]
        n += 1; agree += best(h1.mean(axis=1)) == best(h2.mean(axis=1))
    return agree / n if n else 0.0
def fold(b):
    while b > 160: b /= 2
    while b < 80: b *= 2
    return b
def tempo_ok(bpm, est):
    """Темп фрагмента согласуется с оценкой: отношение близко к 1, 2, 1/2, 3/2, 2/3, 3 или 1/3 (±5%)."""
    r = np.log2(bpm / est)
    return any(abs(r - np.log2(k)) <= 0.07 for k in (1, 2, 0.5, 1.5, 2 / 3, 3, 1 / 3))

def pcs_of(CH, mode, token, tonic):
    sym = token.split(':')[0]; d = CH[mode][sym]
    return [(tonic + d['root'] + i) % 12 for i in d['intervals']]

def check_record(rec, t, C, CH):
    """Такты фрагмента -> список (аккорд, лучший, оценка размеченного, оценка лучшего, зачёт)."""
    fps = 1.0 / (t[1] - t[0]); bpb = rec.get('beatsPerBar') or 4; beat = 60.0 / rec['bpm']
    pos = rec['start']; bars = []
    for c in rec['chords']:
        beats = c.get('beats', bpb); a, b = pos, pos + beats * beat; pos = b
        seg = C[:, int(a * fps):int(b * fps)]
        if seg.shape[1] < 2: bars.append((c['c'], '?', 0, 0, False)); continue
        m = seg.mean(axis=1)
        pcs = pcs_of(CH, rec['key']['mode'], c['c'], rec['key']['tonic'])
        mine = float(template(pcs) @ m)
        best = max(((float(template(p) @ m), NOTE[p[0]] + n) for n, p in TRIADS))
        bar = [c['c'], best[1], round(mine, 3), round(best[0], 3)]; bar.append(bar_ok(bar, rec['key']['mode'], rec['key']['tonic'])); bars.append(bar)
    return bars

def verdict(bars):
    n = len(bars); misses = sum(1 for b in bars if not b[4])
    return misses <= n // 6, n, misses

def download(vid, work, ytdlp, cookies, pot):
    wav = os.path.join(work, vid + '.wav')
    if os.path.exists(wav): return wav
    mp4 = os.path.join(work, vid + '.mp4')
    cmd = [ytdlp, '--no-warnings', '--cookies', cookies, '--js-runtimes', 'node', '--remote-components', 'ejs:github',
           '--extractor-args', 'youtubepot-bgutilhttp:base_url=' + pot, '--extractor-args', 'youtube:player_client=mweb', '-f', '18', '-o', mp4, 'https://www.youtube.com/watch?v=' + vid]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if not os.path.exists(mp4):
        err = [l for l in r.stderr.split('\n') if 'ERROR' in l]
        raise RuntimeError(err[-1][:160] if err else 'download failed')
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', mp4, '-vn', '-ac', '1', '-ar', '22050', wav], check=True, timeout=300)
    os.remove(mp4); time.sleep(random.uniform(3.0, 7.0))
    return wav

def main():
    corpus_path, chords_path, work, ytdlp, cookies, pot, out_path = sys.argv[1:8]
    max_songs = int(sys.argv[8]) if len(sys.argv) > 8 else 10 ** 9
    CH = json.load(open(chords_path)); os.makedirs(work, exist_ok=True)
    recs = json.load(open(corpus_path))
    done = {}
    if os.path.exists(out_path):
        for l in open(out_path):
            d = json.loads(l)
            if 'tempoOk' in d or d.get('ok') is None: done[d['id']] = d.get('n')  # старые записи без сверки темпа перепроверяем
    # не проверенные, а также те, чья разметка с тех пор изменилась (другое число аккордов); сначала простые уровни
    recs = [r for r in recs if r['id'] not in done or (done[r['id']] is not None and done[r['id']] != len(r['chords']))]
    recs.sort(key=lambda r: (r.get('level') or 99, r['youtube']))
    by_vid = {}
    for r in recs: by_vid.setdefault(r['youtube'], []).append(r)
    order = sorted(by_vid, key=lambda v: min(r.get('level') or 99 for r in by_vid[v]))
    n_songs = 0
    for vid in order:
        if n_songs >= max_songs: break
        try: wav = download(vid, work, ytdlp, cookies, pot)
        except Exception as e:
            print(time.strftime('%H:%M:%S'), 'skip', vid, str(e)[:100], flush=True)
            for r in by_vid[vid]: open(out_path, 'a').write(json.dumps(dict(id=r['id'], youtube=r['youtube'], start=round(r['start'], 2), ok=None, error=str(e)[:120])) + '\n')
            continue
        t, C = chroma(wav)
        # фрагменты одной записи должны иметь один темп (с точностью до ×2); при расхождении побеждает сетка, лучше ложащаяся на смены аккордов
        clusters = []
        for r in by_vid[vid]:
            fb = fold(r['bpm'])
            for cl in clusters:
                if abs(fb - cl['bpm']) / cl['bpm'] <= 0.08: cl['recs'].append(r); break
            else: clusters.append({'bpm': fb, 'recs': [r]})
        winner = None
        if len(clusters) > 1:
            starts = [r['start'] for r in by_vid[vid]]
            for cl in clusters:  # сетка кластера от начала каждого фрагмента записи + целостность тактов его собственных фрагментов
                bpm = cl['recs'][0]['bpm']
                cl['score'] = float(np.mean([grid_score(t, C, s0, bpm) for s0 in starts])) + 0.15 * float(np.mean([halves_agree(t, C, r) for r in cl['recs']]))
            winner = max(clusters, key=lambda cl: cl['score'])
        for r in by_vid[vid]:
            bars = check_record(r, t, C, CH); ok, n, misses = verdict(bars)
            tok = winner is None or any(r is x for x in winner['recs'])
            open(out_path, 'a').write(json.dumps(dict(id=r['id'], youtube=r['youtube'], start=round(r['start'], 2), ok=ok and tok, n=n, misses=misses, bars=bars, tempoOk=tok, clusters=len(clusters)), ensure_ascii=False) + '\n')
            print(time.strftime('%H:%M:%S'), 'OK ' if ok and tok else 'BAD', r['id'], f'{misses}/{n}', f'bpm {r["bpm"]}' + ('' if tok else ' TEMPO-CONFLICT'), ' '.join(f"{b[0]}>{b[1]}" for b in bars if not b[4]), flush=True)
        n_songs += 1
        try: os.remove(wav)
        except OSError: pass
if __name__ == '__main__': main()
