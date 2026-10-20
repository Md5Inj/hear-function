#!/usr/bin/env python3
"""Подгонка первой доли и темпа песни под реальную запись по хроме.
Использование: python3 -I tools/calibrate.py songs.json audio_dir [id ...]
Для каждой песни ищет start и bpm около заданных так, чтобы известная последовательность
аккордов лучше всего совпала с хромой записи. Печатает результат и JSON-патч."""
import json, sys, os
import numpy as np
from scipy.io import wavfile
from scipy.signal import stft

SR = 22050; NFFT = 4096; HOP = 1024

def chroma(path):
    sr, y = wavfile.read(path)
    if y.ndim > 1: y = y.mean(axis=1)
    y = y.astype(np.float64) / (np.abs(y).max() + 1e-9)
    assert sr == SR, sr
    f, t, Z = stft(y, fs=sr, nperseg=NFFT, noverlap=NFFT - HOP, window='hann', padded=False, boundary=None)
    mag = np.abs(Z)
    sel = (f >= 55) & (f <= 1760)
    f = f[sel]; mag = mag[sel]
    pcs = (np.round(12 * np.log2(f / 440.0)) + 69).astype(int) % 12
    C = np.zeros((12, mag.shape[1]))
    for p in range(12): C[p] = np.log1p(10 * mag[pcs == p]).sum(axis=0)
    # сглаживание ~0.2 с
    k = 5; C = np.apply_along_axis(lambda r: np.convolve(r, np.ones(k) / k, mode='same'), 1, C)
    C /= (np.linalg.norm(C, axis=0, keepdims=True) + 1e-9)
    return t, C

def template(pcs):
    v = np.full(12, -0.35); v[list(pcs)] = 1.0; v[pcs[0]] = 1.3
    return v / np.linalg.norm(v)

TRIADS = [(name, [(r + i) % 12 for i in iv]) for r in range(12) for name, iv in (('', (0, 4, 7)), ('m', (0, 3, 7)))]
NOTE = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']

def calibrate(song, t, C, win=30.0, bpm_rel=0.3):
    frames_per_sec = 1.0 / (t[1] - t[0])
    beats = np.array([c['beats'] for c in song['chords']], float)
    scores = {}
    for c in song['chords']:
        key = tuple(c['pcs'])
        if key not in scores:
            s = template(c['pcs']) @ C
            scores[key] = np.concatenate([[0], np.cumsum(s)])
    cums = [scores[tuple(c['pcs'])] for c in song['chords']]
    n = C.shape[1]
    def total(starts, bpm):
        beat = 60.0 / bpm
        tot = np.zeros_like(starts)
        tt = starts.copy()
        for i, c in enumerate(song['chords']):
            a = np.clip((tt * frames_per_sec).astype(int), 0, n - 1)
            b = np.clip(((tt + beats[i] * beat) * frames_per_sec).astype(int), 1, n)
            cum = cums[i]
            tot += (cum[b] - cum[a]) / np.maximum(b - a, 1)
            tt = tt + beats[i] * beat
        return tot / len(song['chords'])
    s0, b0 = song['start'], song['bpm']
    starts = np.arange(max(0, s0 - win), s0 + win, 0.05)
    best = (-1, None, None)
    grid = []
    for bpm in np.arange(b0 * (1 - bpm_rel), b0 * (1 + bpm_rel), 0.25):
        sc = total(starts, bpm)
        grid.append(sc)
        i = int(np.argmax(sc))
        if sc[i] > best[0]: best = (sc[i], starts[i], bpm)
    grid = np.array(grid)
    # кандидаты в пределах 1.5% от лучшего: предпочесть ближайший к исходной догадке
    thr = best[0] * 0.985
    bpms = np.arange(b0 * (1 - bpm_rel), b0 * (1 + bpm_rel), 0.25)
    cand = [(abs(starts[j] - s0), starts[j], bpms[i]) for i, j in zip(*np.where(grid >= thr))]
    cand.sort()
    _, s1, bpm1 = cand[0]
    # уточнение
    fs = np.arange(s1 - 0.3, s1 + 0.3, 0.01)
    best2 = (-1, s1, bpm1)
    for bpm in np.arange(bpm1 - 0.5, bpm1 + 0.5, 0.05):
        sc = total(fs, bpm); i = int(np.argmax(sc))
        if sc[i] > best2[0]: best2 = (sc[i], fs[i], bpm)
    score, s2, bpm2 = best2
    median = float(np.median(grid))
    # проверка аккордов: какой трезвучный шаблон лучше всего подходит каждому такту
    beat = 60.0 / bpm2; tt = s2; checks = []
    for i, c in enumerate(song['chords']):
        a = int(tt * frames_per_sec); b = int((tt + beats[i] * beat) * frames_per_sec)
        seg = C[:, a:b].mean(axis=1)
        bestt = max(TRIADS, key=lambda x: template(x[1]) @ seg)
        exp = c['pcs']
        checks.append((c['c'], NOTE[exp[0]] + ('m' if (exp[1] - exp[0]) % 12 == 3 else ''), NOTE[bestt[1][0]] + bestt[0], float(template(exp) @ seg)))
        tt += beats[i] * beat
    return dict(start=round(float(s2), 2), bpm=round(float(bpm2), 2), score=round(float(score), 3), median=round(median, 3), checks=checks)

def main():
    songs = json.load(open(sys.argv[1]))
    adir = sys.argv[2]
    only = set(sys.argv[3:])
    patch = {}
    for s in songs:
        if only and s['id'] not in only: continue
        path = os.path.join(adir, s['youtube'] + '.wav')
        if not os.path.exists(path): print(f"{s['id']}: нет аудио"); continue
        t, C = chroma(path)
        r = calibrate(s, t, C)
        ok = sum(1 for c in r['checks'] if c[1] == c[2])
        print(f"{s['id']}: start {s['start']} -> {r['start']}, bpm {s['bpm']} -> {r['bpm']}, score {r['score']} (median {r['median']}), chords match {ok}/{len(r['checks'])}")
        for c in r['checks']:
            flag = '' if c[1] == c[2] else '   <-- ожидался %s, слышится %s' % (c[1], c[2])
            print(f"    {c[0]:8s} {c[1]:5s} {c[3]:.3f}{flag}")
        patch[s['id']] = dict(start=r['start'], bpm=r['bpm'], score=r['score'], match=f"{ok}/{len(r['checks'])}")
    json.dump(patch, open(os.path.join(adir, 'patch.json'), 'w'), indent=1)

main()

def calibrate_global(song, t, C, bpm_lo=55.0, bpm_hi=200.0):
    """Поиск по всей записи без априорных start/bpm: нужен, когда известна только последовательность аккордов."""
    frames_per_sec = 1.0 / (t[1] - t[0])
    beats = np.array([c['beats'] for c in song['chords']], float)
    scores = {}
    for c in song['chords']:
        key = tuple(c['pcs'])
        if key not in scores:
            s = template(c['pcs']) @ C
            scores[key] = np.concatenate([[0], np.cumsum(s)])
    cums = [scores[tuple(c['pcs'])] for c in song['chords']]
    n = C.shape[1]
    def total(starts, bpm):
        beat = 60.0 / bpm; tot = np.zeros_like(starts); tt = starts.copy()
        for i, c in enumerate(song['chords']):
            a = np.clip((tt * frames_per_sec).astype(int), 0, n - 1)
            b = np.clip(((tt + beats[i] * beat) * frames_per_sec).astype(int), 1, n)
            tot += (cums[i][b] - cums[i][a]) / np.maximum(b - a, 1)
            tt = tt + beats[i] * beat
        # штраф за выход за конец записи
        tot[(tt * frames_per_sec) > n] = -1
        return tot / len(song['chords'])
    dur = n / frames_per_sec
    starts = np.arange(0, max(1.0, dur - 5), 0.1)
    bpms = np.arange(bpm_lo, bpm_hi, 0.5)
    grid = np.array([total(starts, b) for b in bpms])
    i, j = np.unravel_index(int(np.argmax(grid)), grid.shape)
    s1, bpm1 = starts[j], bpms[i]
    best2 = (-1, s1, bpm1)
    fs = np.arange(max(0, s1 - 0.3), s1 + 0.3, 0.01)
    for bpm in np.arange(bpm1 - 0.6, bpm1 + 0.6, 0.05):
        sc = total(fs, bpm); k = int(np.argmax(sc))
        if sc[k] > best2[0]: best2 = (sc[k], fs[k], bpm)
    score, s2, bpm2 = best2
    median = float(np.median(grid[grid > -1])) if (grid > -1).any() else 0.0
    beat = 60.0 / bpm2; tt = s2; checks = []
    for i, c in enumerate(song['chords']):
        a = int(tt * frames_per_sec); b = int((tt + beats[i] * beat) * frames_per_sec)
        seg = C[:, a:b].mean(axis=1) if b > a else np.zeros(12)
        bestt = max(TRIADS, key=lambda x: template(x[1]) @ seg)
        exp = c['pcs']
        checks.append((c['c'], NOTE[exp[0]] + ('m' if (exp[1] - exp[0]) % 12 == 3 else ''), NOTE[bestt[1][0]] + bestt[0], float(template(exp) @ seg)))
        tt += beats[i] * beat
    return dict(start=round(float(s2), 2), bpm=round(float(bpm2), 2), score=round(float(score), 3), median=round(median, 3), checks=checks)
