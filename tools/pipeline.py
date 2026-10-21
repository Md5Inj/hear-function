#!/usr/bin/env python3
"""Конвейер: кандидаты (billboard2songs) -> поиск YouTube -> скачивание -> калибровка -> results.jsonl
python3 -I tools/pipeline.py candidates.json chords.json workdir ytdlp_bin cookies potserver_url [max_songs]
workdir: кэш поиска (search.json), wav, results.jsonl, skipped.jsonl"""
import json, os, re, sys, subprocess, time, random, collections, urllib.request, urllib.parse, importlib.util
cand_path, chords_path, work, ytdlp, cookies, pot = sys.argv[1:7]
max_songs = int(sys.argv[7]) if len(sys.argv) > 7 else 10 ** 9
os.makedirs(work, exist_ok=True)
spec = importlib.util.spec_from_file_location('calibrate', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'calibrate.py'))
# calibrate.py вызывает main() при импорте — подавим
src = open(spec.origin, encoding='utf-8').read().replace('\nmain()\n', '\n')
cal = {}; exec(compile(src, spec.origin, 'exec'), cal)

CH = json.load(open(chords_path))
cands = json.load(open(cand_path))
results_path = os.path.join(work, 'results.jsonl'); skipped_path = os.path.join(work, 'skipped.jsonl'); search_path = os.path.join(work, 'search.json')
search_cache = json.load(open(search_path)) if os.path.exists(search_path) else {}
done = set()
if os.path.exists(results_path):
    for line in open(results_path): done.add(json.loads(line)['songKey'])
if os.path.exists(skipped_path):
    for line in open(skipped_path): done.add(json.loads(line)['songKey'])

def log(*a): print(time.strftime('%H:%M:%S'), *a, flush=True)
def clean_artist(a): return re.sub(r"'+$", '', a.strip())
LIVE = re.compile(r'[(\[][^)\]]*\b(live|karaoke|cover|remix|instrumental|demo|rehearsal|acoustic|unplugged|lyric|lyrics)\b[^)\]]*[)\]]|\blive (at|from|in|on)\b|\s[-–]\s*live\b', re.I)
BAD = re.compile(r'\b(live|cover|karaoke|remix|lyrics?|reaction|tutorial|lesson|instrumental|slowed|sped|8d|nightcore|reverb|backing|acoustic version|unplugged|concert|tour|rehearsal|demo|edit)\b', re.I)

def yt_search(q):
    if q in search_cache: return search_cache[q]
    out = subprocess.run([ytdlp, '--no-warnings', '--cookies', cookies, '--flat-playlist', '--print', '%(id)s\t%(duration)s\t%(channel)s\t%(title)s', 'ytsearch8:' + q], capture_output=True, text=True, timeout=120).stdout
    res = []
    for line in out.strip().split('\n'):
        p = line.split('\t')
        if len(p) == 4 and re.match(r'^[\w-]{11}$', p[0]):
            try: dur = float(p[1])
            except: dur = None
            res.append(dict(id=p[0], dur=dur, channel=p[2], title=p[3]))
    search_cache[q] = res
    json.dump(search_cache, open(search_path, 'w'), ensure_ascii=False)
    time.sleep(random.uniform(1.0, 2.5))
    return res

def embeddable(vid):
    try:
        urllib.request.urlopen('https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=%s&format=json' % vid, timeout=15).read()
        return True
    except Exception: return False

def choose(res, artist, title, expected_dur):
    best = None
    for r in res:
        if r['dur'] is None: continue
        if BAD.search(r['title']) and not BAD.search(title): continue
        if LIVE.search(r['title']): continue  # концертные версии и т.п. даже если в названии песни есть такое слово
        dd = abs(r['dur'] - expected_dur)
        if dd > 12: continue
        score = dd
        ch = (r['channel'] or '').lower()
        if (artist.lower().split() or [''])[0] in ch or 'vevo' in ch or 'topic' in ch or 'records' in ch: score -= 6
        if title.lower() in r['title'].lower(): score -= 2
        if best is None or score < best[0]: best = (score, r)
    return best[1] if best else None

def download(vid):
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
    os.remove(mp4)
    time.sleep(random.uniform(3.0, 7.0))
    return wav

def pcs_of(mode, token, tonic):
    sym = token.split(':')[0]; d = CH[mode][sym]
    return [(tonic + d['root'] + i) % 12 for i in d['intervals']]

# группировка кандидатов по песне; порядок: сначала минор (его мало), потом мажор, внутри — по уровню по кругу
by_song = collections.OrderedDict()
for f in cands:
    f['artist'] = clean_artist(f['artist'])
    lst = by_song.setdefault((f['artist'], f['title']), [])
    if not any(x['mode'] == f['mode'] and x['section'] == f['section'] and x['chords'] == f['chords'] for x in lst): lst.append(f)
# круговой порядок по корзинам (лад, уровень): каждая следующая песня пополняет следующую корзину
# корзины — все пары (лад, уровень), встречающиеся у кандидатов; самые редкие первыми
_cnt = collections.Counter((f['mode'], f['level']) for f in cands)
buckets = sorted(_cnt, key=lambda b: (_cnt[b], b[0] != 'minor', b[1]))
queues = {b: [item for item in by_song.items() if any((f['mode'], f['level']) == b for f in item[1])] for b in buckets}
order = []; used = set(); bi = 0
while any(queues.values()):
    b = buckets[bi % len(buckets)]; bi += 1
    while queues[b] and queues[b][0][0] in used: queues[b].pop(0)
    if queues[b]:
        item = queues[b].pop(0); used.add(item[0]); order.append(item)

processed = 0
for (artist, title), frs in order:
    if processed >= max_songs: break
    key = artist + ' — ' + title
    if key in done: continue
    processed += 1
    bb = frs[0]['bb']
    # ожидаемая длительность трека: последняя метка 'end' в файле billboard
    expected = frs[0].get('duration')
    try:
        res = yt_search(artist + ' ' + title)
        pick = choose(res, artist, title, expected) if expected else None
        if not pick:
            open(skipped_path, 'a').write(json.dumps(dict(songKey=key, reason='no matching video', expected=expected, found=[(r['dur'], r['title']) for r in res[:4]]), ensure_ascii=False) + '\n'); log('skip', key, 'no video'); continue
        if not embeddable(pick['id']):
            open(skipped_path, 'a').write(json.dumps(dict(songKey=key, reason='not embeddable', id=pick['id']), ensure_ascii=False) + '\n'); log('skip', key, 'not embeddable'); continue
        wav = download(pick['id'])
        t, C = cal['chroma'](wav)
        accepted = []
        for f in frs:
            song = dict(start=f['start'], bpm=f['bpm'], chords=[dict(c=c['c'], beats=c['beats'], pcs=pcs_of(f['mode'], c['c'], f['tonic'])) for c in f['chords']])
            if f.get('start') is None:
                r = cal['calibrate_global'](song, t, C)
                f = dict(f, start=r['start'], bpm=r['bpm'], noprior=True)
            else:
                r = cal['calibrate'](song, t, C, win=15.0, bpm_rel=0.08)
            match = 0.0
            for c in r['checks']:
                if c[1] == c[2]: match += 1
                elif c[1].rstrip('m') == c[2].rstrip('m'): match += 0.5
            match /= len(r['checks'])
            need = 1.0 if len(r['checks']) <= 4 else 0.9  # короткий фрагмент — ни одного промаха по тактам
            # хвост записи (последние 10 %): затухание и коды, совпадения там ложные
            frag_end = r['start'] + sum(c['beats'] for c in song['chords']) * 60.0 / r['bpm']
            in_tail = bool(pick.get('dur')) and frag_end > 0.9 * pick['dur']
            if f.get('noprior'):
                ok = match >= need and r['score'] >= 2.0 * max(r['median'], 0.02) and len(r['checks']) >= 3 and not in_tail
            else:
                ok = match >= need and r['score'] >= 1.8 * max(r['median'], 0.02) and abs(r['bpm'] - f['bpm']) <= 0.06 * f['bpm'] and abs(r['start'] - f['start']) <= 12 and not in_tail
            rec = dict(songKey=key, artist=artist, title=title, youtube=pick['id'], ytTitle=pick['title'], ytDur=pick['dur'], expectedDur=expected, bb=bb,
                       tonic=f['tonic'], mode=f['mode'], level=f['level'], section=f['section'], beatsPerBar=f['beatsPerBar'], chords=f['chords'],
                       start=r['start'], bpm=r['bpm'], bbStart=f['start'], bbBpm=f['bpm'], score=r['score'], median=r['median'], match=round(match, 2), ok=ok, noprior=bool(f.get('noprior')))
            accepted.append(rec)
        # согласованное смещение между секциями: если >=2 фрагмента с приличным фитом дают одинаковое смещение
        # относительно разметки Billboard, это сильное свидетельство, что версия записи та же
        decent = [r for r in accepted if not r.get('noprior') and r['score'] >= 1.4 * max(r['median'], 0.02) and abs(r['bpm'] - r['bbBpm']) <= 0.04 * r['bbBpm']]
        offs = sorted(r['start'] - r['bbStart'] for r in decent)
        consensus = None
        for i in range(len(offs)):
            group = [o for o in offs if abs(o - offs[i]) <= 0.6]
            if len(group) >= 2 and (consensus is None or len(group) > consensus[1]): consensus = (sum(group) / len(group), len(group))
        for r in accepted:
            if r.get('noprior'): continue
            fit_prior = abs(r['start'] - r['bbStart']) <= 1.0 and abs(r['bpm'] - r['bbBpm']) <= 0.025 * r['bbBpm'] and r['score'] >= 1.4 * max(r['median'], 0.02)
            fit_cons = consensus is not None and abs((r['start'] - r['bbStart']) - consensus[0]) <= 0.6 and r['score'] >= 1.3 * max(r['median'], 0.02) and abs(r['bpm'] - r['bbBpm']) <= 0.04 * r['bbBpm']
            r['ok'] = bool(r['ok'] or fit_prior or fit_cons); r['consensus'] = consensus[0] if consensus else None
        for rec in accepted: open(results_path, 'a').write(json.dumps(rec, ensure_ascii=False) + '\n')
        log(key, '->', pick['id'], 'ok %d/%d' % (sum(1 for r in accepted if r['ok']), len(accepted)))
        os.remove(wav)
    except Exception as e:
        open(skipped_path, 'a').write(json.dumps(dict(songKey=key, reason=str(e)[:200]), ensure_ascii=False) + '\n'); log('skip', key, str(e)[:120])
        if 'Sign in' in str(e) or 'bot' in str(e): log('STOP: YouTube blocks downloads'); break
log('DONE')
