"""Корень аккорда по римской записи (как в лестнице уровней): полутоны от тоники. Для проверки по записи."""
import re
MAJ = [0, 2, 4, 5, 7, 9, 11]; MIN = [0, 2, 3, 5, 7, 8, 10]
ROMAN = {'i': 0, 'ii': 1, 'iii': 2, 'iv': 3, 'v': 4, 'vi': 5, 'vii': 6}
NOTE = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
def degree_pc(tok, mode):
    m = re.match(r'^([♭♯b#]?)([ivIV]+)', tok)
    if not m: return None
    acc, rom = m.group(1), m.group(2).lower()
    if rom not in ROMAN: return None
    pc = (MAJ if mode == 'major' else MIN)[ROMAN[rom]]
    if acc in ('♭', 'b'): pc -= 1
    if acc in ('♯', '#'): pc += 1
    return pc % 12
def root_pc(sym, mode, tonic=0):
    sym = sym.split(':')[0]
    if sym == 'N': return (tonic + 1) % 12
    if '/' in sym:  # побочная доминанта: квинта вверх от цели
        target = degree_pc(sym.split('/')[1], mode)
        return None if target is None else (tonic + target + 7) % 12
    d = degree_pc(sym, mode)
    return None if d is None else (tonic + d) % 12
def root_name(sym, mode, tonic=0):
    pc = root_pc(sym, mode, tonic); return None if pc is None else NOTE[pc]
def bar_ok(bar, mode, tonic, tol=0.04):
    """bar = [аккорд, лучшее трезвучие, оценка аккорда, оценка лучшего, ...]. Корни должны совпадать; при совпадении корней допуск по качеству."""
    sym, best, mine, top = bar[0], bar[1], bar[2], bar[3]
    if best == '?': return False
    rn = root_name(sym, mode, tonic)
    if rn is None: return mine >= top - 0.015
    return rn == best.rstrip('m') and mine >= top - tol
