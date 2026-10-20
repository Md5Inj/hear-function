#!/usr/bin/env python3
"""Вписать результаты calibrate.py (patch.json) в songs-db.js.
Использование: python3 -I tools/apply-patch.py patch.json [min_match_ratio=0.6]"""
import json, re, sys
patch = json.load(open(sys.argv[1]))
min_ratio = float(sys.argv[2]) if len(sys.argv) > 2 else 0.6
path = 'songs-db.js'
src = open(path, encoding='utf-8').read()
for sid, p in patch.items():
    m = re.search(r"\{ id: '" + re.escape(sid) + r"'.*?\n(?:.*?\n)*?.*?start: [\d.]+, bpm: [\d.]+", src)
    if not m: print('не найдено:', sid); continue
    block = m.group(0)
    new = re.sub(r"start: [\d.]+, bpm: [\d.]+", f"start: {p['start']}, bpm: {p['bpm']}", block)
    a, b = p['match'].split('/')
    if int(a) / int(b) >= min_ratio: new = new.replace(", draft: true", "")
    src = src.replace(block, new)
    print(f"{sid}: start {p['start']}, bpm {p['bpm']}, совпадение аккордов {p['match']}{'' if int(a)/int(b) >= min_ratio else ' — оставлена пометка draft'}")
open(path, 'w', encoding='utf-8').write(src)
