#!/usr/bin/env python3
"""Конвертер McGill Billboard (salami_chords.txt) в кандидаты фрагментов для тренажёра.
Использование: python3 -I tools/billboard2songs.py <dir McGill-Billboard> vocab.json > candidates.json
vocab.json: {"major": [[...level1 symbols], [...level2], [...level3]], "minor": [...]} (из tools/dump-vocab.js)"""
import os, re, sys, json, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from units import unit_windows, merge_bars, level_of

NOTE_PC = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def pc(name):
    p = NOTE_PC[name[0]]
    for ch in name[1:]: p += 1 if ch == '#' else -1 if ch == 'b' else 0
    return p % 12

# класс качества аккорда
def quality_class(q):
    q = q or 'maj'
    base = q.split('(')[0]
    table = {
        'maj': 'maj', 'maj6': 'maj', '6': 'maj', 'maj9': 'maj7', 'maj7': 'maj7', 'maj13': 'maj7', 'maj(9)': 'maj',
        'min': 'min', 'min6': 'min', 'min9': 'min7', 'min7': 'min7', 'min11': 'min7', 'min13': 'min7', 'minmaj7': 'min',
        '7': 'dom', '9': 'dom', '11': 'dom', '13': 'dom', 'sus4(b7)': 'dom', 'sus4(b7,9)': 'dom',
        'hdim7': 'hdim', 'dim': 'dim', 'dim7': 'dim7', 'aug': 'aug', 'sus4': 'sus', 'sus2': 'sus', '5': 'power', '1': 'power',
    }
    if q in table: return table[q]
    if base in table: return table[base]
    return None

INTERVAL_PC = {'3': 4, 'b3': 3, '5': 7, 'b7': 10, '7': 11, 'b5': 6, '#5': 8, '6': 9, '9': 2, 'b9': 1, '2': 2, '4': 5, '11': 5, '13': 9, 'b13': 8, '#9': 3, '#11': 6, '1': 0}
TONES = {'maj': (0, 4, 7), 'min': (0, 3, 7), 'maj7': (0, 4, 7, 11), 'min7': (0, 3, 7, 10), 'dom': (0, 4, 7, 10), 'hdim': (0, 3, 6, 10), 'dim': (0, 3, 6), 'dim7': (0, 3, 6, 9)}

# (относительный корень, класс) -> символ
MAJOR_MAP = {
    (0, 'maj'): 'I', (0, 'maj7'): 'Imaj7', (0, 'dom'): 'I7', (0, 'min'): 'i', (0, 'min7'): 'i',
    (2, 'min'): 'ii', (2, 'min7'): 'ii7', (2, 'dom'): 'V/V', (2, 'maj'): 'V/V', (2, 'dim'): 'ii°', (2, 'hdim'): 'ii°',
    (4, 'min'): 'iii', (4, 'min7'): 'iii7', (4, 'dom'): 'V/vi', (4, 'maj'): 'V/vi',
    (5, 'maj'): 'IV', (5, 'maj7'): 'IVmaj7', (5, 'dom'): 'IV7', (5, 'min'): 'iv', (5, 'min7'): 'iv',
    (7, 'maj'): 'V', (7, 'dom'): 'V7', (7, 'min'): 'v', (7, 'min7'): 'v',
    (9, 'min'): 'vi', (9, 'min7'): 'vi7', (9, 'dom'): 'V/ii', (9, 'maj'): 'V/ii',
    (11, 'dim'): 'vii°', (11, 'hdim'): 'viiø7', (11, 'dim7'): 'vii°7', (11, 'dom'): 'V/iii', (11, 'maj'): 'V/iii',
    (1, 'maj'): 'N', (3, 'maj'): '♭III', (3, 'dom'): '♭III', (8, 'maj'): '♭VI', (8, 'dom'): '♭VI', (8, 'maj7'): '♭VI', (10, 'maj'): '♭VII', (10, 'dom'): '♭VII', (10, 'maj7'): '♭VII',
}
MINOR_MAP = {
    (0, 'min'): 'i', (0, 'min7'): 'i7', (0, 'maj'): 'I', (0, 'dom'): 'V/iv',
    (2, 'dim'): 'ii°', (2, 'hdim'): 'iiø7', (2, 'min'): 'ii', (2, 'min7'): 'ii', (2, 'dom'): 'V/V', (2, 'maj'): 'V/V',
    (3, 'maj'): 'III', (3, 'maj7'): 'IIImaj7', (3, 'dom'): 'V/VI',
    (5, 'min'): 'iv', (5, 'min7'): 'iv7', (5, 'maj'): 'IV', (5, 'dom'): 'IV',
    (7, 'min'): 'v', (7, 'min7'): 'v7', (7, 'maj'): 'V', (7, 'dom'): 'V7',
    (8, 'maj'): 'VI', (8, 'maj7'): 'VImaj7', (8, 'dom'): 'VI',
    (10, 'maj'): 'VII', (10, 'dom'): 'VII7', (10, 'maj7'): 'VII',
    (11, 'dim'): 'vii°', (11, 'dim7'): 'vii°7', (11, 'hdim'): 'vii°', (1, 'maj'): 'N',
}
DIATONIC = {'major': {0: 'maj', 2: 'min', 4: 'min', 5: 'maj', 7: 'maj', 9: 'min', 11: 'dim'},
            'minor': {0: 'min', 2: 'dim', 3: 'maj', 5: 'min', 7: 'min', 8: 'maj', 10: 'maj'}}

def parse_chord(label):
    """'A:min7/b3' -> (root_pc, class, bass_pc|None); None если не аккорд."""
    if label in ('N', '*', '&pause', '.'): return None
    m = re.match(r'^([A-G][#b]*)(?::([^/]+))?(?:/(.+))?$', label)
    if not m: return None
    root = pc(m.group(1)); q = m.group(2); bass = m.group(3)
    cls = quality_class(q)
    if cls is None: return None
    bpc = (root + INTERVAL_PC[bass]) % 12 if bass in INTERVAL_PC else None
    return root, cls, bpc

def to_symbol(ch, tonic, mode):
    root, cls, bpc = ch
    rel = (root - tonic) % 12
    if cls in ('sus', 'power', 'aug'):
        d = DIATONIC[mode].get(rel)
        if d is None: return None
        cls = d
    sym = (MAJOR_MAP if mode == 'major' else MINOR_MAP).get((rel, cls))
    if sym is None: return None
    inv = 0
    if bpc is not None:
        tones = TONES.get(cls)
        if tones:
            rb = (bpc - root) % 12
            if rb in tones: inv = tones.index(rb)
    if not ('7' in sym or 'ø' in sym): inv = min(inv, 2)  # трезвучие: не выше второго обращения
    return sym + (':%d' % inv if inv else '')

def parse_file(path):
    title = artist = None; metre = (4, 4); tonic = None
    lines = []
    for raw in open(path, encoding='utf-8'):
        raw = raw.rstrip('\n')
        if raw.startswith('# title:'): title = raw.split(':', 1)[1].strip()
        elif raw.startswith('# artist:'): artist = raw.split(':', 1)[1].strip()
        elif raw.startswith('# metre:'):
            a, b = raw.split(':', 1)[1].strip().split('/'); metre = (int(a), int(b)); lines.append(('metre', metre))
        elif raw.startswith('# tonic:'):
            tonic = pc(raw.split(':', 1)[1].strip()); lines.append(('tonic', tonic))
        elif re.match(r'^[\d.e+-]+\t', raw):
            t, rest = raw.split('\t', 1)
            lines.append(('line', float(t), rest))
    return title, artist, lines

def bars_of(rest):
    """Разбор строки с тактами. Возвращает (section_name|None, [[chord labels per bar]])."""
    parts = [p.strip() for p in rest.split(',')]
    section = None
    for p in parts:
        if re.match(r'^(intro|verse|chorus|bridge|outro|pre-chorus|instrumental|solo|interlude|coda|fadeout|fade out|ending|transition|main theme|head|theme|refrain|vocal|pre-verse|prechorus|modulation|key change|secondary theme|trans)', p, re.I):
            section = p.lower()
    bars = []
    for p in parts:
        if '|' not in p: continue
        segs = [s.strip() for s in p.split('|')][1:-1]
        for s in segs:
            if not s: continue
            toks = s.split()
            # 'x2' и т.п. в конце
            toks = [t for t in toks if not re.match(r'^x\d+$', t)]
            bars.append(toks)
        m = re.search(r'\|\s*x(\d+)\s*$', p)
        if m:
            rep = int(m.group(1)); bars = bars * rep
    return section, bars

def song_fragments(path, vocab):
    title, artist, lines = parse_file(path)
    if not title or not artist: return []
    metre = (4, 4); tonic = None
    timeline = []  # (t, section, bars, metre, tonic)
    for item in lines:
        if item[0] == 'metre': metre = item[1]
        elif item[0] == 'tonic': tonic = item[1]
        else:
            t, rest = item[1], item[2]
            if rest.strip() in ('silence', 'end') or '|' not in rest: timeline.append((t, None, [], metre, tonic)); continue
            section, bars = bars_of(rest)
            timeline.append((t, section, bars, metre, tonic))
    # абсолютные такты
    bars_abs = []  # dict(t, dur, chords[(label, beats)], section, metre, tonic, section_id)
    sec_id = 0; cur_section = None
    for i, (t, section, bars, met, ton) in enumerate(timeline):
        if not bars: continue
        if section: sec_id += 1; cur_section = section
        t_next = next((x[0] for x in timeline[i + 1:] if True), None)
        if t_next is None or t_next <= t: continue
        bar_dur = (t_next - t) / len(bars)
        bpb = met[0]
        for j, toks in enumerate(bars):
            # раскрыть точки: каждая позиция = доля; без точек — делим поровну
            if '.' in toks:
                pos = []; cur = None
                for tok in toks:
                    cur = cur if tok == '.' else tok
                    pos.append(cur)
                if len(pos) != bpb: pos = (pos + [pos[-1]] * bpb)[:bpb]
                chords = []
                for lab in pos:
                    if chords and chords[-1][0] == lab: chords[-1][1] += 1
                    else: chords.append([lab, 1])
            else:
                n = len(toks); chords = [[lab, bpb / n] for lab in toks]
                merged = []
                for lab, b in chords:
                    if merged and merged[-1][0] == lab: merged[-1][1] += b
                    else: merged.append([lab, b])
                chords = merged
            bars_abs.append(dict(t=t + j * bar_dur, dur=bar_dur, chords=chords, section=cur_section, sec=sec_id, bpb=bpb, tonic=ton, metre=met))
    if not bars_abs or tonic is None: return []
    # лад: качество аккордов на тонике (по всему треку, для первой тоники)
    def infer_mode(ton, bars):
        cnt = collections.Counter()
        for b in bars:
            for lab, _ in b['chords']:
                ch = parse_chord(lab)
                if ch and (ch[0] - ton) % 12 == 0: cnt[ch[1]] += 1
        mn = cnt['min'] + cnt['min7']; mj = cnt['maj'] + cnt['maj7'] + cnt['dom']
        if mn == 0 and mj == 0:
            # по диатонике
            sc = {'major': 0, 'minor': 0}
            for b in bars:
                for lab, _ in b['chords']:
                    ch = parse_chord(lab)
                    if not ch: continue
                    rel = (ch[0] - ton) % 12
                    for m in sc:
                        if DIATONIC[m].get(rel) == {'maj7': 'maj', 'min7': 'min', 'dom': 'maj'}.get(ch[1], ch[1]): sc[m] += 1
            return 'major' if sc['major'] >= sc['minor'] else 'minor'
        return 'minor' if mn > mj else 'major'
    frags = []
    # лад определяем один раз на каждую тонику по всем тактам с этой тоникой
    mode_by_tonic = {}
    for ton in {b['tonic'] for b in bars_abs}:
        mode_by_tonic[ton] = infer_mode(ton, [b for b in bars_abs if b['tonic'] == ton])
    # группируем по секциям
    by_sec = collections.OrderedDict()
    for b in bars_abs: by_sec.setdefault(b['sec'], []).append(b)
    seen_prog = set()
    for sec, bars in by_sec.items():
        if not bars[0]['section']: continue
        ton = bars[0]['tonic']; mode = mode_by_tonic[ton]
        bpb = bars[0]['bpb']
        if any(b['bpb'] != bpb or b['tonic'] != ton for b in bars): continue
        # символы по тактам; окна — только целые единицы (вся секция или её период с начала)
        bar_syms = []; okk = True; prev_root = None
        for b in bars:
            cur = []
            for lab, beats in b['chords']:
                ch = parse_chord(lab)
                sym = to_symbol(ch, ton, mode) if ch else None
                if sym is None: okk = False; break
                if ch[1] in ('sus', 'power') and (prev_root == ch[0] or (cur and cur[-1][0] == sym)): okk = False; break
                cur.append((sym, beats)); prev_root = ch[0]
            if not okk: break
            bar_syms.append(tuple(cur))
        if not okk: continue
        durs = [b['dur'] for b in bars]
        maxbars = max(v['maxBars'] for v in vocab[mode])
        for off, length in unit_windows(bar_syms, maxbars):
            wd = durs[off:off + length]
            if max(wd) / min(wd) > 1.25: continue
            bar_dur = sum(wd) / len(wd)
            bpm = 60 * bpb / bar_dur
            if not (50 <= bpm <= 220): continue
            chords = merge_bars(bar_syms[off:off + length])
            if len(chords) < 2 or len(chords) > 16: continue
            if max(c['beats'] for c in chords) > 2 * bpb: continue
            if len({c['c'].split(':')[0] for c in chords}) < 2: continue
            level = level_of(chords, bpb, vocab[mode])
            if level is None: continue
            key = (mode, tuple(c['c'] for c in chords))
            if key in seen_prog: continue
            seen_prog.add(key)
            frags.append(dict(title=title, artist=artist, tonic=ton, mode=mode, level=level, start=round(bars[off]['t'], 2), bpm=round(bpm, 2), beatsPerBar=bpb,
                              chords=chords, section=bars[0]['section'], bars=length, offset=off, secLen=len(bars), unit=True))
    return frags

def main():
    root = sys.argv[1]; vocab = json.load(open(sys.argv[2]))
    out = []; seen_song = set()
    for d in sorted(os.listdir(root)):
        p = os.path.join(root, d, 'salami_chords.txt')
        if os.path.exists(p):
            try:
                frs = song_fragments(p, vocab)
                if not frs: continue
                sk = (frs[0]['artist'].strip("' ").lower(), frs[0]['title'].strip().lower())
                if sk in seen_song: continue
                seen_song.add(sk)
                for f in frs: f['bb'] = d; out.append(f)
            except Exception as e:
                print('skip', d, e, file=sys.stderr)
    json.dump(out, sys.stdout, ensure_ascii=False, indent=0)
    c = collections.Counter((f['mode'], f['level']) for f in out)
    songs = collections.Counter((f['mode'], f['level']) for f in {(f['artist'], f['title'], f['mode'], f['level']): f for f in out}.values())
    print('fragments:', dict(sorted(c.items())), file=sys.stderr)
    print('distinct songs:', dict(sorted(songs.items())), file=sys.stderr)
if __name__ == '__main__': main()
