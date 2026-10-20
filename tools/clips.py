#!/usr/bin/env python3
"""Вырезать аудио принятых фрагментов (для извлечения мелодии).
python3 -I tools/clips.py results1.jsonl[,results2...] clips_dir ytdlp cookies pot_url
Клип: clips/<youtube>_<start>.wav (моно 22050), от start-0.5 до end+0.5."""
import json, os, sys, subprocess, time, random
paths, clips, ytdlp, cookies, pot = sys.argv[1].split(','), sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5]
os.makedirs(clips, exist_ok=True)
recs = [json.loads(l) for p in paths if os.path.exists(p) for l in open(p, encoding='utf-8')]
ok = [r for r in recs if r['ok']]
def clip_name(r): return '%s_%.2f.wav' % (r['youtube'], r['start'])
def end_of(r):
    beat = 60.0 / r['bpm']; return r['start'] + sum(c['beats'] for c in r['chords']) * beat
by_video = {}
for r in ok: by_video.setdefault(r['youtube'], []).append(r)
todo = {v: [r for r in frs if not os.path.exists(os.path.join(clips, clip_name(r)))] for v, frs in by_video.items()}
todo = {v: frs for v, frs in todo.items() if frs}
print('videos to fetch:', len(todo), flush=True)
for v, frs in todo.items():
    mp4 = os.path.join(clips, v + '.mp4'); wav = os.path.join(clips, v + '.full.wav')
    try:
        if not os.path.exists(wav):
            subprocess.run([ytdlp, '--no-warnings', '--cookies', cookies, '--js-runtimes', 'node', '--remote-components', 'ejs:github',
                            '--extractor-args', 'youtubepot-bgutilhttp:base_url=' + pot, '--extractor-args', 'youtube:player_client=mweb', '-f', '18', '-o', mp4,
                            'https://www.youtube.com/watch?v=' + v], capture_output=True, text=True, timeout=300)
            if not os.path.exists(mp4): print('fail', v, flush=True); continue
            subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', mp4, '-vn', '-ac', '1', '-ar', '22050', wav], check=True, timeout=300)
            os.remove(mp4)
        for r in frs:
            a = max(0, r['start'] - 0.5); b = end_of(r) + 0.5
            subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-ss', '%.3f' % a, '-t', '%.3f' % (b - a), '-i', wav, os.path.join(clips, clip_name(r))], check=True, timeout=120)
        os.remove(wav)
        print(time.strftime('%H:%M:%S'), v, len(frs), 'clips', flush=True)
        time.sleep(random.uniform(3, 7))
    except Exception as e:
        print('error', v, str(e)[:120], flush=True)
print('DONE', flush=True)
