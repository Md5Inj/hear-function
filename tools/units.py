"""Целые гармонические единицы: фрагмент допустим, только если это вся секция целиком
или её повторяющийся период (один или несколько полных периодов с начала секции).
Нельзя вырезать окно из середины более богатой прогрессии: контекст теряется."""

def period(seq):
    """Наименьший период последовательности (список хэшируемых элементов); n, если периода нет."""
    n = len(seq)
    for p in range(1, n + 1):
        if n % p == 0 and all(seq[i] == seq[i % p] for i in range(n)): return p
    return n

def unit_windows(seq, maxbars=8, minbars=4):
    """Одно окно (offset, length) на секцию: кратчайшая целая единица не короче minbars тактов —
    k полных периодов с начала секции, либо вся секция, если периода нет и она влезает в maxbars."""
    n = len(seq)
    if n == 0: return []
    p = period(seq)
    if p < n:
        k = 1
        while k * p < minbars: k += 1
        return [(0, k * p)] if k * p <= maxbars and k * p <= n else []
    return [(0, n)] if minbars <= n <= maxbars else []

def merge_bars(bar_syms):
    """[( (sym, beats), ... ) per bar] -> [{'c','beats'}] со слиянием одинаковых соседних аккордов."""
    out = []
    for bar in bar_syms:
        for sym, beats in bar:
            if out and out[-1]['c'] == sym: out[-1]['beats'] += beats
            else: out.append({'c': sym, 'beats': beats})
    for c in out: c['beats'] = round(c['beats'], 3)
    return out

def level_of(chords, bpb, vocab_mode):
    syms = {c['c'].split(':')[0] for c in chords}; bars = sum(c['beats'] for c in chords) / bpb
    return next((i + 1 for i, v in enumerate(vocab_mode) if syms <= set(v['vocab']) and bars <= v['maxBars']), None)
