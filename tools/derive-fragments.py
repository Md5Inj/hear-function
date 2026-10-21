#!/usr/bin/env python3
"""Для песен с уже проверенным выравниванием (ok-фрагменты в results.jsonl) вывести тайминги окон-кандидатов
без повторного скачивания. Окна берутся только из кандидатов (целые единицы, см. tools/units.py).
Billboard: start = bbStart + смещение, bpm = bbBpm * отношение темпов (по выровненным фрагментам песни).
Chordonomicon: тайминг старого окна + его положение в секции (secSyms кандидата) -> начало единицы.
python3 -I tools/derive-fragments.py results.jsonl[,...] candidates.json[,...] derived.jsonl"""
import json, sys, os, collections, statistics
res_path, cand_path, out_path = sys.argv[1:4]
recs = [json.loads(l) for p in res_path.split(',') if os.path.exists(p) for l in open(p, encoding='utf-8')]
cands = [f for p in cand_path.split(',') if os.path.exists(p) for f in json.load(open(p, encoding='utf-8'))]
def key_of(r): return (r['bb'], r['mode'], r['section'], tuple((c['c'], round(c['beats'], 3)) for c in r['chords']))
have = {key_of(r) for r in recs}
ok_recs = [r for r in recs if r.get('ok') and not r.get('derived')]
out = []; done_keys = set()
def emit(f, a_start, a_bpm, src):
    k = key_of(f)
    if k in have or k in done_keys or a_start < 0: return  # начало раньше нуля: единица начинается до старта ролика
    done_keys.add(k)
    out.append(dict(songKey=f['artist'] + ' — ' + f['title'], artist=f['artist'], title=f['title'], youtube=src['youtube'], ytTitle=src.get('ytTitle'), ytDur=src.get('ytDur'), expectedDur=src.get('expectedDur'), bb=f['bb'],
                    tonic=f['tonic'], mode=f['mode'], level=f['level'], section=f['section'], beatsPerBar=f['beatsPerBar'], chords=f['chords'],
                    start=round(a_start, 2), bpm=round(a_bpm, 2), bbStart=f.get('start'), bbBpm=f.get('bpm'), score=0, median=0, match=1.0, ok=True, derived=True))
# --- Billboard: выравнивание по песне (bb id): смещение и отношение темпов
by_bb = collections.defaultdict(list)
for r in ok_recs:
    if not r.get('noprior') and r.get('bbStart') is not None and r.get('bbBpm'): by_bb[r['bb']].append(r)
align = {}
for bb, rs in by_bb.items():
    offs = [r['start'] - r['bbStart'] for r in rs]; ratios = [r['bpm'] / r['bbBpm'] for r in rs]
    if len(rs) >= 2 and (max(offs) - min(offs) > 1.5): continue  # фрагменты не согласованы — не доверяем
    align[bb] = dict(off=statistics.median(offs), ratio=statistics.median(ratios), src=rs[0])
for f in cands:
    a = align.get(f['bb'])
    if not a or f.get('start') is None or f.get('bpm') is None: continue
    emit(f, f['start'] + a['off'], f['bpm'] * a['ratio'], a['src'])
# --- Chordonomicon: по старому ok-окну той же песни находим его смещение в секции кандидата
by_ch = collections.defaultdict(list)
for r in ok_recs:
    if str(r['bb']).startswith('ch'): by_ch[r['bb']].append(r)
def merged(syms):
    out = []
    for s in syms:
        if out and out[-1]['c'] == s: out[-1]['beats'] += 4.0
        else: out.append({'c': s, 'beats': 4.0})
    return out
n_ch = 0; n_far = 0
for f in cands:
    if f.get('start') is not None or not f.get('secSyms'): continue
    best = None  # ближайшее по положению старое окно: экстраполяция темпа не дальше 8 тактов
    for r in by_ch.get(f['bb'], []):
        if r['mode'] != f['mode']: continue
        rc = [(c['c'], round(c['beats'], 3)) for c in r['chords']]; L = int(round(sum(b for _, b in rc) / 4))
        syms = f['secSyms']
        for o in range(0, len(syms) - L + 1):
            if [(c['c'], round(c['beats'], 3)) for c in merged(syms[o:o + L])] == rc:
                d = abs(o - f['offset'])
                if best is None or d < best[0]: best = (d, o, r)
                break
    if best is None: continue
    if best[0] > 8: n_far += 1; continue
    d, found, r = best
    bar = 4 * 60.0 / r['bpm']
    emit(f, r['start'] + (f['offset'] - found) * bar, r['bpm'], r); n_ch += 1
open(out_path, 'w', encoding='utf-8').write(''.join(json.dumps(r, ensure_ascii=False) + '\n' for r in out))
cnt = collections.Counter((r['mode'], r['level']) for r in out)
print('aligned billboard songs:', len(align), 'chordonomicon derived:', n_ch, 'too far (dropped):', n_far, 'derived fragments:', len(out), file=sys.stderr)
print({f'{m} {l}': n for (m, l), n in sorted(cnt.items())}, file=sys.stderr)
