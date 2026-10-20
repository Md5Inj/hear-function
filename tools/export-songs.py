#!/usr/bin/env python3
"""results.jsonl (pipeline, можно несколько через запятую) -> songs-data.js. Берёт только ok-фрагменты, не больше max_per_song на песню,
не больше max_per_bucket на (лад, уровень). python3 -I tools/export-songs.py results.jsonl [max_per_song=2] [max_per_bucket=150]"""
import json, sys, re, collections
paths = sys.argv[1].split(','); per_song = int(sys.argv[2]) if len(sys.argv) > 2 else 2; per_bucket = int(sys.argv[3]) if len(sys.argv) > 3 else 150
melody_path = sys.argv[4] if len(sys.argv) > 4 else None  # melodies.jsonl из tools/melody.py
cand_paths = sys.argv[5].split(',') if len(sys.argv) > 5 else []  # актуальные кандидаты: фрагменты, выпавшие из них, не экспортируем
import os
recs = [json.loads(l) for p in paths if os.path.exists(p) for l in open(p, encoding='utf-8')]
LIVE = re.compile(r'[(\[][^)\]]*\b(live|karaoke|cover|remix|instrumental|demo|rehearsal|acoustic|unplugged|lyric|lyrics)\b[^)\]]*[)\]]|\blive (at|from|in|on)\b|\s[-–]\s*live\b', re.I)
ok = [r for r in recs if r['ok'] and not LIVE.search(r.get('ytTitle', ''))]
ok = [r for r in ok if max(c['beats'] for c in r['chords']) <= 2 * r['beatsPerBar']]
# отметки «разметка неверна» со страниц (flags.jsonl рядом с проектом)
flagged = set(); flagged_ids = set()
if os.path.exists('flags.jsonl'):
    for l in open('flags.jsonl', encoding='utf-8'):
        try: d = json.loads(l); flagged.add((d.get('youtube'), round(float(d.get('start')), 2)))
        except Exception: pass
# отметки из базы сервера (data/db.json, коллекция flags): по id фрагмента
if os.path.exists('data/db.json'):
    try:
        for f in json.load(open('data/db.json', encoding='utf-8')).get('flags', {}).values():
            if f.get('songId'): flagged_ids.add(f['songId'])
            if f.get('youtube') and f.get('start') is not None: flagged.add((f['youtube'], round(float(f['start']), 2)))
    except Exception: pass
ok = [r for r in ok if (r['youtube'], round(r['start'], 2)) not in flagged]
if cand_paths:
    import os as _os
    valid = set()
    for cp in cand_paths:
        if not _os.path.exists(cp): continue
        for f in json.load(open(cp, encoding='utf-8')):
            valid.add((f['bb'], f['mode'], f['section'], tuple((c['c'], round(c['beats'], 3)) for c in f['chords'])))
    # только окна из актуальных кандидатов — т.е. целые гармонические единицы (tools/units.py); вырезки из середины отпадают
    ok = [r for r in ok if (r['bb'], r['mode'], r['section'], tuple((c['c'], round(c['beats'], 3)) for c in r['chords'])) in valid]
melodies = {}
if melody_path and os.path.exists(melody_path):
    for l in open(melody_path, encoding='utf-8'):
        try: d = json.loads(l)
        except Exception: continue  # строка ещё дописывается
        if d.get('melody') and d['melody'].get('conf', 0) >= 0.7: melodies.setdefault(d['youtube'], []).append(d['melody'])
# мелодия подходит фрагменту, если её фраза целиком лежит внутри его времени (окна могли перестроиться)
def mel_for(r):
    dur = sum(c['beats'] for c in r['chords']) * 60.0 / r['bpm']
    cands = [m for m in melodies.get(r['youtube'], []) if m['start'] >= r['start'] - 0.3 and m['end'] <= r['start'] + dur + 0.3]
    return max(cands, key=lambda m: m.get('conf', 0)) if cands else None
SECTION_RU = {'intro': 'вступление', 'verse': 'куплет', 'chorus': 'припев', 'bridge': 'бридж', 'outro': 'кода', 'pre-chorus': 'предприпев', 'instrumental': 'инструментал', 'solo': 'соло', 'interlude': 'интерлюдия', 'coda': 'кода', 'refrain': 'рефрен', 'fadeout': 'затухание', 'transition': 'переход', 'main theme': 'основная тема', 'head': 'тема', 'theme': 'тема', 'vocal': 'вокал', 'ending': 'концовка', 'modulation': 'модуляция', 'key change': 'смена тональности', 'pre-verse': 'перед куплетом', 'prechorus': 'предприпев', 'trans': 'переход', 'secondary theme': 'вторая тема'}
def sec_ru(s):
    s = (s or '').lower()
    for k, v in sorted(SECTION_RU.items(), key=lambda kv: -len(kv[0])):
        if s.startswith(k): return v
    return s
# ранжирование: предпочесть куплет/припев, лучший score/median, фрагменты с 4+ аккордами
def rank(r):
    has_mel = 0 if mel_for(r) else 1
    pref = 0 if re.match(r'^(verse|chorus|refrain)', r['section'] or '') else 1
    return (has_mel, pref, -(r['score'] / max(r['median'], 0.02)))
by_song = collections.defaultdict(list)
for r in ok: by_song[(r['artist'], r['title'])].append(r)
bucket = collections.Counter(); out = []; used_prog = set()
songs_sorted = sorted(by_song.items(), key=lambda kv: kv[0])
# с каждой песни берём окна по кругу уровней: сначала по одному на каждый уровень, затем вторые и т.д.
import os as _os2
LADDER = None
try:
    import subprocess
    LADDER = json.loads(subprocess.run(['node', 'tools/dump-vocab.js'], capture_output=True, text=True).stdout)
except Exception: LADDER = None
def ladder_level(r):
    if not LADDER: return r['level']
    syms = {c['c'].split(':')[0] for c in r['chords']}; bars = sum(c['beats'] for c in r['chords']) / r['beatsPerBar']
    for i, l in enumerate(LADDER[r['mode']]):
        if syms <= set(l['vocab']) and bars <= l['maxBars']: return i + 1
    return None
def fix_inv(tok):
    sym, _, inv = tok.partition(':')
    if inv and not ('7' in sym or 'ø' in sym) and int(inv) > 2: inv = '2'
    return sym + (':' + inv if inv else '')
for r in ok:
    for c in r['chords']: c['c'] = fix_inv(c['c'])
    r['_lvl'] = ladder_level(r)
ok = [r for r in ok if r['_lvl']]
by_song = collections.defaultdict(list)
for r in ok: by_song[(r['artist'], r['title'])].append(r)
songs_sorted = sorted(by_song.items(), key=lambda kv: kv[0])
for key, frs in songs_sorted:
    by_level = collections.defaultdict(list)
    for r in sorted(frs, key=rank): by_level[r['_lvl']].append(r)
    taken = 0; rnd = 0
    while taken < per_song:
        got = False
        for lvl in sorted(by_level):
            if len(by_level[lvl]) > rnd:
                r = by_level[lvl][rnd]; b = (r['mode'], r['_lvl'])
                if bucket[b] >= per_bucket: continue
                prog = (r['mode'], tuple(c['c'] for c in r['chords']), key)
                if prog in used_prog: continue
                used_prog.add(prog); bucket[b] += 1; out.append(r); taken += 1; got = True
                if taken >= per_song: break
        if not got: break
        rnd += 1
def js_str(s): return "'" + s.replace('\\', '\\\\').replace("'", "\\'") + "'"
id_count = collections.Counter()
lines = ['/* Автоматически сгенерировано tools/export-songs.py из аннотаций McGill Billboard (CC BY-NC-SA 4.0),',
         '   выровнено по записям YouTube tools/pipeline.py. Не редактировать руками: правки делайте в songs-db.js. */',
         'window.SongsAuto = [']
for r in sorted(out, key=lambda r: (r['mode'], r['level'], r['artist'], r['title'])):
    sid = '%s-%s' % (('bb-' + r['bb']) if not r['bb'].startswith('ch') else r['bb'], re.sub(r'[^a-z0-9]+', '-', (r['section'] or 'x').lower()).strip('-'))
    id_count[sid] += 1
    if id_count[sid] > 1: sid += '-%d' % id_count[sid]
    chords = ', '.join('{ c: %s%s }' % (js_str(c['c']), '' if c['beats'] == r['beatsPerBar'] else ', beats: %g' % c['beats']) for c in r['chords'])
    bpb = '' if r['beatsPerBar'] == 4 else ', beatsPerBar: %d' % r['beatsPerBar']
    m = mel_for(r)
    mel = ", melody: { start: %.2f, end: %.2f, degrees: [%s] }" % (m['start'], m['end'], ', '.join(js_str(d) for d in m['degrees'])) if m else ''
    lines.append("  { id: %s, title: %s, artist: %s, youtube: %s, key: { tonic: %d, mode: %s }, level: %d, start: %.2f, bpm: %.2f%s, chords: [%s], section: %s%s }," % (
        js_str(sid), js_str(r['title']), js_str(r['artist']), js_str(r['youtube']), r['tonic'], js_str(r['mode']), r['level'], r['start'], r['bpm'], bpb, chords, js_str(sec_ru(r['section'])), mel))
lines.append('];')
# корпус как ES-модуль для приложения (lib/songs-data.js) и в старом формате для legacy/, если он есть
esm = [lines[0], lines[1], 'const SongsAuto = ['] + lines[3:] + ['export default SongsAuto;']
open('lib/songs-data.js', 'w', encoding='utf-8').write('\n'.join(esm) + '\n')
if os.path.isdir('legacy'): open('legacy/songs-data.js', 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
