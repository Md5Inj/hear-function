#!/usr/bin/env python3
"""Пересобрать кандидаты Chordonomicon по правилу целых единиц, без обращения к Spotify:
метаданные (название, исполнитель, длительность) берутся из старого файла кандидатов.
python3 -I tools/rewindow-chordonomicon.py chordonomicon_v2.csv vocab.json old_candidates.json out.json"""
import csv, sys, json, os, re, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from units import unit_windows, merge_bars, level_of
csv.field_size_limit(10 ** 8)
csv_path, vocab_path, old_path, out_path = sys.argv[1:5]
vocab = json.load(open(vocab_path))
# функции разбора из конвертера (его тело выполняется при импорте, поэтому берём только определения)
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'chordonomicon2songs.py'), encoding='utf-8').read()
defs = src[src.index('NOTE_PC = '):src.index('out = []; n_songs = 0')]
ns = {'re': re, 'collections': collections, 'sys': sys, '__file__': os.path.join(os.path.dirname(os.path.abspath(__file__)), 'chordonomicon2songs.py')}
exec(defs, ns)
parse, to_symbol, infer_key = ns['parse'], ns['to_symbol'], ns['infer_key']
old = json.load(open(old_path, encoding='utf-8'))
meta = {}
for f in old: meta.setdefault(f['bb'], dict(title=f['title'], artist=f['artist'], duration=f.get('duration')))
want = {k[2:] for k in meta}
out = []
for row in csv.DictReader(open(csv_path, encoding='utf-8')):
    if row['id'] not in want: continue
    toks = row['chords'].split()
    sections = []; cur = None
    for tk in toks:
        if tk.startswith('<'): cur = (tk.strip('<>').split('_')[0], []); sections.append(cur)
        elif cur: cur[1].append(tk)
    parsed_all = [p for _, ch in sections for p in map(parse, ch)]
    if not parsed_all or any(p is None for p in parsed_all): continue
    ton, mode, diat, margin = infer_key([(p[0], p[1]) for p in parsed_all])
    m = meta['ch' + row['id']]; seen_prog = set()
    maxbars = max(v['maxBars'] for v in vocab[mode])
    for name, ch in sections:
        if name not in ('verse', 'chorus', 'bridge', 'intro', 'prechorus', 'pre-chorus', 'outro'): continue
        syms = []
        for tk in ch:
            p = parse(tk); s = to_symbol(p, ton, mode) if p else None
            if s is None: syms = None; break
            syms.append(s)
        if not syms: continue
        bar_syms = [((s, 4.0),) for s in syms]
        for off, length in unit_windows(bar_syms, maxbars):
            chords = merge_bars(bar_syms[off:off + length])
            if len(chords) < 2 or max(c['beats'] for c in chords) > 8: continue
            if len({c['c'].split(':')[0] for c in chords}) < 2: continue
            level = level_of(chords, 4, vocab[mode])
            if level is None: continue
            key = tuple(c['c'] for c in chords)
            if key in seen_prog: continue
            seen_prog.add(key)
            out.append(dict(tonic=ton, mode=mode, level=level, start=None, bpm=None, beatsPerBar=4, chords=chords, section=name, bb='ch' + row['id'],
                            offset=off, secLen=len(syms), secSyms=syms, unit=True, title=m['title'], artist=m['artist'], duration=m['duration']))
json.dump(out, open(out_path, 'w'), ensure_ascii=False)
print('songs:', len(want), 'fragments:', dict(sorted(collections.Counter((f['mode'], f['level']) for f in out).items())), file=sys.stderr)
