#!/usr/bin/env python3
"""Chordonomicon (CSV) -> кандидаты фрагментов (без таймингов; выравнивание делает pipeline глобальным поиском).
python3 -I tools/chordonomicon2songs.py chordonomicon_v2.csv vocab.json out.json [mode=minor] [max_songs=600]
Название/исполнителя/длительность берёт со страницы встраивания Spotify по spotify_song_id."""
import csv, sys, json, re, collections, urllib.request, time, random
csv.field_size_limit(10 ** 8)
path, vocab_path, out_path = sys.argv[1:4]
want_mode = sys.argv[4] if len(sys.argv) > 4 else 'minor'
max_songs = int(sys.argv[5]) if len(sys.argv) > 5 else 600          # квота песен на каждый целевой уровень
want_levels = {int(x) for x in sys.argv[6].split(',')} if len(sys.argv) > 6 and sys.argv[6] else None  # целевые уровни лестницы
vocab = json.load(open(vocab_path))
NOTE_PC = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def pc(name):
    p = NOTE_PC[name[0]]
    for ch in name[1:]: p += 1 if ch in 's#' else -1 if ch == 'b' else 0
    return p % 12
def parse(tok):
    m = re.match(r'^([A-G][sb#]?)(.*?)(?:/([A-G][sb#]?))?$', tok)
    if not m: return None
    root = pc(m.group(1)); q = m.group(2); bass = pc(m.group(3)) if m.group(3) else None
    cls = {'': 'maj', 'maj': 'maj', 'min': 'min', 'm': 'min', '7': 'dom', '9': 'dom', '11': 'dom', '13': 'dom', 'maj7': 'maj7', 'maj9': 'maj7', 'min7': 'min7', 'm7': 'min7', 'min9': 'min7', 'min11': 'min7',
           'dim': 'dim', 'dim7': 'dim7', 'hdim7': 'hdim', 'min7b5': 'hdim', 'm7b5': 'hdim', 'sus4': 'sus', 'sus2': 'sus', 'sus': 'sus', 'aug': 'aug', '5': 'power', '6': 'maj', 'maj6': 'maj', 'min6': 'min', 'm6': 'min', 'add9': 'maj', 'madd9': 'min', 'minadd9': 'min', '7sus4': 'dom', 'maj13': 'maj7', 'mmaj7': 'min', 'minmaj7': 'min'}.get(q)
    if cls is None: return None
    return root, cls, bass
sys.path.insert(0, __import__('os').path.dirname(__file__))
from billboard2songs import MAJOR_MAP, MINOR_MAP, DIATONIC, TONES
from units import unit_windows, merge_bars, level_of
def to_symbol(ch, tonic, mode):
    root, cls, bpc = ch; rel = (root - tonic) % 12
    if cls in ('sus', 'power', 'aug'):
        d = DIATONIC[mode].get(rel)
        if d is None: return None
        cls = d
    sym = (MAJOR_MAP if mode == 'major' else MINOR_MAP).get((rel, cls))
    if sym is None: return None
    inv = 0
    if bpc is not None and cls in TONES:
        rb = (bpc - root) % 12
        if rb in TONES[cls]: inv = TONES[cls].index(rb)
    if not ('7' in sym or 'ø' in sym): inv = min(inv, 2)
    return sym + (':%d' % inv if inv else '')
def quality_simple(cls): return {'maj7': 'maj', 'min7': 'min', 'dom': 'maj', 'hdim': 'dim', 'dim7': 'dim'}.get(cls, cls)
def infer_key(chords):
    """chords: список (root, cls). Возвращает (tonic, mode, доля диатоники, запас)."""
    best = []
    for mode in ('major', 'minor'):
        for ton in range(12):
            good = 0
            for root, cls in chords:
                rel = (root - ton) % 12; q = quality_simple(cls)
                d = DIATONIC[mode].get(rel)
                if d == q or (mode == 'minor' and rel == 7 and q == 'maj') or (mode == 'minor' and rel == 11 and q == 'dim'): good += 1
            best.append((good / len(chords), ton, mode))
    best.sort(reverse=True)
    (s1, ton, mode), s2 = best[0], best[1][0]
    # относительный мажор/минор: выбираем по тонике — какой из тонических аккордов чаще и стоит первым
    rel_major = (ton + 3) % 12 if mode == 'minor' else ton
    rel_minor = ton if mode == 'minor' else (ton + 9) % 12
    cnt = collections.Counter((r, quality_simple(c)) for r, c in chords)
    first = chords[0]
    maj_score = cnt[(rel_major, 'maj')] + (2 if (first[0], quality_simple(first[1])) == (rel_major, 'maj') else 0) + (2 if (chords[-1][0], quality_simple(chords[-1][1])) == (rel_major, 'maj') else 0)
    min_score = cnt[(rel_minor, 'min')] + (2 if (first[0], quality_simple(first[1])) == (rel_minor, 'min') else 0) + (2 if (chords[-1][0], quality_simple(chords[-1][1])) == (rel_minor, 'min') else 0)
    if min_score > maj_score: ton, mode = rel_minor, 'minor'
    elif maj_score > min_score: ton, mode = rel_major, 'major'
    return ton, mode, s1, s1 - s2
def spotify(track_id):
    try:
        req = urllib.request.Request('https://open.spotify.com/embed/track/' + track_id, headers={'User-Agent': 'Mozilla/5.0'})
        html = urllib.request.urlopen(req, timeout=20).read().decode('utf-8', 'ignore')
        m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html, re.S)
        d = json.loads(m.group(1))
        def find(o):
            if isinstance(o, dict):
                if 'name' in o and 'artists' in o and 'duration' in o: return o
                for v in o.values():
                    r = find(v)
                    if r: return r
            elif isinstance(o, list):
                for v in o:
                    r = find(v)
                    if r: return r
        e = find(d)
        if not e: return None
        return dict(title=e['name'], artist=', '.join(a['name'] for a in e['artists']), duration=e['duration'] / 1000.0)
    except Exception:
        return None
out = []; n_songs = 0; seen_art = collections.Counter(); quota = collections.Counter()
rows = list(csv.DictReader(open(path, encoding='utf-8')))
random.seed(int(__import__('os').environ.get('SEED', '7'))); random.shuffle(rows)  # другой SEED даёт другую выборку песен
for row in rows:
    if not want_levels and n_songs >= max_songs: break
    if not row.get('spotify_song_id'): continue
    genre = (row.get('main_genre') or '')
    if genre not in ('pop', 'rock', 'metal', 'country', 'punk', 'alternative', 'indie', 'soul', 'rnb', 'folk', 'blues'): continue
    toks = row['chords'].split()
    sections = []; cur = None
    for tk in toks:
        if tk.startswith('<'): cur = (tk.strip('<>').split('_')[0], []); sections.append(cur)
        elif cur: cur[1].append(tk)
    parsed_all = [p for _, ch in sections for p in map(parse, ch)]
    if not parsed_all or any(p is None for p in parsed_all) or len(parsed_all) < 8: continue
    ton, mode, diat, margin = infer_key([(p[0], p[1]) for p in parsed_all])
    if mode != want_mode or diat < 0.9: continue
    frags = []; seen_prog = set()
    for name, ch in sections:
        if name not in ('verse', 'chorus', 'bridge', 'intro', 'prechorus', 'pre-chorus', 'outro'): continue
        syms = []; okk = True
        for tk in ch:
            p = parse(tk); s = to_symbol(p, ton, mode) if p else None
            if s is None: okk = False; break
            syms.append(s)
        if not okk or len(syms) < 2: continue
        # окна — только целые единицы: вся секция или её повторяющийся период с начала (tools/units.py)
        bar_syms = [((s, 4.0),) for s in syms]
        maxbars = max(v['maxBars'] for v in vocab[mode])
        for off, length in unit_windows(bar_syms, maxbars):
          win = merge_bars(bar_syms[off:off + length])
          if sum(c['beats'] for c in win) < 16: continue
          if len({c['c'].split(':')[0] for c in win}) < 2 or max(c['beats'] for c in win) > 8: continue
          level = level_of(win, 4, vocab[mode])
          if level is None: continue
          key = tuple(c['c'] for c in win)
          if key in seen_prog: continue
          seen_prog.add(key)
          frags.append(dict(tonic=ton, mode=mode, level=level, start=None, bpm=None, beatsPerBar=4, chords=win, section=name, bb='ch' + row['id'], offset=off, secLen=len(syms), secSyms=syms, unit=True))
    if not frags: continue
    if want_levels:
        frags = [f for f in frags if f['level'] in want_levels and quota[f['level']] < max_songs]
        if not frags: continue
    meta = spotify(row['spotify_song_id']); time.sleep(random.uniform(0.3, 0.8))
    if not meta or not meta['title'] or not meta['artist']: continue
    if seen_art[meta['artist']] >= 3: continue
    seen_art[meta['artist']] += 1
    n_songs += 1
    for lv in {f['level'] for f in frags}: quota[lv] += 1
    for f in frags: f.update(title=meta['title'], artist=meta['artist'], duration=meta['duration']); out.append(f)
    if want_levels and all(quota[lv] >= max_songs for lv in want_levels): break
    print(n_songs, meta['artist'], '-', meta['title'], mode, [f['level'] for f in frags], file=sys.stderr, flush=True)
json.dump(out, open(out_path, 'w'), ensure_ascii=False)
print('fragments:', dict(collections.Counter((f['mode'], f['level']) for f in out)), file=sys.stderr)
