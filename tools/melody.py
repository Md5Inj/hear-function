#!/usr/bin/env python3
"""Извлечение вокальной мелодии из клипов: demucs (вокал) -> torchcrepe (высота) -> ноты -> ступени.
mlenv/bin/python tools/melody.py results.jsonl[,...] clips_dir melodies.jsonl
Для каждого принятого фрагмента ищет первую уверенную вокальную фразу из 4–10 нот внутри фрагмента."""
import json, os, sys, math, collections
import numpy as np, torch, torchaudio, torchcrepe, soundfile as sf
from demucs.pretrained import get_model
from demucs.apply import apply_model
paths, clips, out_path = sys.argv[1].split(','), sys.argv[2], sys.argv[3]
shard = [int(x) for x in sys.argv[4].split('/')] if len(sys.argv) > 4 else [0, 1]  # k/n: обрабатывать только свою долю клипов
recs = [json.loads(l) for p in paths if os.path.exists(p) for l in open(p, encoding='utf-8')]
ok = [r for r in recs if r['ok']]
done = {}
if os.path.exists(out_path):
    for l in open(out_path, encoding='utf-8'):
        d = json.loads(l); done[(d['youtube'], round(d['fragStart'], 2))] = d
torch.set_num_threads(max(1, (os.cpu_count() - 2) // shard[1]))
model = get_model('htdemucs'); model.eval()
DEG = {'major': ['1', '♭2', '2', '♭3', '3', '4', '♯4', '5', '♭6', '6', '♭7', '7'], 'minor': ['1', '♭2', '2', '♭3', '♮3', '4', '♯4', '5', '♭6', '♮6', '♭7', '♮7']}
HOP = 320  # 20 мс при 16 кГц
def vocals(path):
    cache = path + '.vocals.npy'
    data, sr = sf.read(path, dtype='float32', always_2d=True)
    mix16 = torchaudio.functional.resample(torch.from_numpy(data.T.copy()).mean(0), sr, 16000)
    if os.path.exists(cache): return torch.from_numpy(np.load(cache)), mix16
    wav = torch.from_numpy(data.T.copy())
    wav = torchaudio.functional.resample(wav, sr, model.samplerate)
    if wav.shape[0] == 1: wav = wav.repeat(2, 1)
    with torch.no_grad():
        out = apply_model(model, wav[None], device='cpu', progress=False)[0]
    v = out[model.sources.index('vocals')].mean(0)
    v16 = torchaudio.functional.resample(v, model.samplerate, 16000)
    np.save(cache, v16.numpy())
    return v16, mix16
def notes_from(v16):
    audio = v16[None]
    f0, conf = torchcrepe.predict(audio, 16000, HOP, 65.4, 1046.5, model='full', batch_size=1024, device='cpu', return_periodicity=True)
    f0 = f0[0].numpy(); conf = conf[0].numpy()
    midi = 69 + 12 * np.log2(np.maximum(f0, 1) / 440.0)
    # медианное сглаживание 50 мс
    k = 5; midi_s = np.array([np.median(midi[max(0, i - k // 2): i + k // 2 + 1]) for i in range(len(midi))])
    voiced = conf > 0.55
    notes = []; i = 0; n = len(midi_s)
    while i < n:
        if not voiced[i]: i += 1; continue
        j = i; pitch = midi_s[i]
        while j < n and voiced[j] and abs(midi_s[j] - pitch) < 0.75:
            pitch = 0.9 * pitch + 0.1 * midi_s[j]; j += 1
        dur = (j - i) * HOP / 16000
        if dur >= 0.1:
            core = midi_s[i + (j - i) // 5: j - (j - i) // 5] if j - i >= 5 else midi_s[i:j]  # центральная часть ноты, без глиссандо на входе и выходе
            notes.append(dict(t=i * HOP / 16000, dur=dur, midi=float(np.median(core)), conf=float(conf[i:j].mean())))
        i = j
    return notes
def phrase(notes, tonic, mode, clip_offset):
    # группируем в фразы по паузам > 0.35 с; берём первую фразу из 4–10 нот со средней уверенностью >= 0.65
    groups = []; cur = []
    for nt in notes:
        if cur and nt['t'] - (cur[-1]['t'] + cur[-1]['dur']) > 0.35: groups.append(cur); cur = []
        cur.append(nt)
    if cur: groups.append(cur)
    for g in groups:
        g = [x for x in g if x['dur'] >= 0.12]
        if 4 <= len(g) <= 10 and np.mean([x['conf'] for x in g]) >= 0.65 and np.mean([x.get('vocal', 1) for x in g]) >= 0.08 and len({int(round(x['midi'])) for x in g}) >= 3:
            degrees = [DEG[mode][(int(round(x['midi'])) - tonic) % 12] for x in g]
            return dict(start=round(g[0]['t'] + clip_offset, 2), end=round(g[-1]['t'] + g[-1]['dur'] + clip_offset + 0.15, 2), degrees=degrees,
                        conf=round(float(np.mean([x['conf'] for x in g])), 3), midi=[round(x['midi'], 2) for x in g])
    return None
out = open(out_path, 'a', encoding='utf-8')
import zlib
for r in ok:
    key = (r['youtube'], round(r['start'], 2))
    if key in done: continue
    if zlib.crc32(('%s_%.2f' % key).encode()) % shard[1] != shard[0]: continue
    path = os.path.join(clips, '%s_%.2f.wav' % (r['youtube'], r['start']))
    if not os.path.exists(path): continue
    try:
        v16, mix16 = vocals(path)
        notes = notes_from(v16)
        # доля энергии вокала в миксе на каждой ноте
        for nt in notes:
            a = int(nt['t'] * 16000); b = int((nt['t'] + nt['dur']) * 16000)
            ev = float((v16[a:b] ** 2).mean()) if b > a else 0; em = float((mix16[a:b] ** 2).mean()) if b > a else 1e-9
            nt['vocal'] = ev / max(em, 1e-9)
        clip_offset = max(0, r['start'] - 0.5)
        ph = phrase([nt for nt in notes if clip_offset + nt['t'] >= r['start'] - 0.05], r['tonic'], r['mode'], clip_offset)
        rec = dict(youtube=r['youtube'], fragStart=r['start'], melody=ph, nNotes=len(notes))
        out.write(json.dumps(rec, ensure_ascii=False) + '\n'); out.flush()
        print(r['artist'], '-', r['title'], '|', ph['degrees'] if ph else 'no phrase', flush=True)
    except Exception as e:
        print('error', r['youtube'], str(e)[:120], flush=True)
print('DONE', flush=True)
