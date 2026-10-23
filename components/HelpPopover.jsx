'use client';
/* Кнопка «?» у шестерёнки: краткая инструкция к упражнению и клавиши. Вёрстка на Tailwind. */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
const TEXT = {
  degrees: { title: 'Degrees', steps: ['"Listen": a cadence, then one note.', 'Name the degree: a button or digit 1–7, "−" and "+" before the digit for alterations.', 'After the answer "resolution" plays the move of the degree to the tonic.', 'Each group of degrees runs as four tasks: one octave, different octaves, in tempo (two seconds to answer), in tempo and different octaves.'], keys: [['1–7', 'degree'], ['− / +', 'lower or raise'], ['Enter', 'next'], ['R', 'repeat']] },
  progressions: { title: 'Progressions', steps: ['"Listen": a cadence, then chords bar by bar.', 'Fill the bars with chords from the panel or with digits; the cursor jumps to the next empty bar.', '"Check" shows the answer and how much you got right.'], keys: [['1–7', 'chord of the degree'], ['− then digit', '♭III, ♭VI, ♭VII'], ['Space', 'chord of the bar'], ['← →', 'bar'], ['Backspace', 'erase'], ['Enter', 'check / next']] },
  songs: { title: 'Song chords', steps: ['"Listen": a cadence in the song\'s key, then a fragment of the recording. Clicking a bar plays just it.', 'Select bars with the mouse or Shift with arrows: a panel above them lets you play, loop, slow down.', 'Enter the chord of each bar, "%" repeats the previous one. After checking, compare your answer and the correct one on piano.'], keys: [['1–7', 'chord of the degree'], ['%', 'same as previous bar'], ['Space', 'play selection'], ['L', 'loop'], ['T', 'tonic'], ['Enter', 'check / next']] },
  intervals: { title: 'Intervals', steps: ['"Listen": two notes — low to high, high to low or together, depending on the task.', 'Name the interval with a button or key: digit 2–8 for a major or perfect one, "−" before the digit for a minor one, "+" then 4 for the tritone.', 'Each group of intervals runs as four tasks: up, down, harmonic, mixed. The last group mixes all intervals.'], keys: [['2–8', 'major / perfect'], ['− then digit', 'minor'], ['+ then 4', 'tritone'], ['Enter', 'next'], ['R', 'repeat']] },
  melodies: { title: 'Song melodies', steps: ['"Listen": a cadence, then a vocal phrase.', 'The degree of each note in order: buttons or digits, "−" and "+" for alterations.', 'Backspace erases the last degree, arrows move the cursor.'], keys: [['1–7', 'degree'], ['− / +', 'alteration'], ['Space', 'play the phrase'], ['T', 'tonic'], ['Enter', 'check / next']] },
};
const kbd = 'font-sans text-[13px] px-[7px] py-px border border-rule rounded-md bg-tint text-ink-2';
export default function HelpPopover({ exercise }) {
  const t = TEXT[exercise]; const [open, setOpen] = useState(false); const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onClick = ev => { if (ref.current && !ref.current.contains(ev.target)) setOpen(false); };
    const onKey = ev => { if (ev.key === 'Escape') setOpen(false); };
    const id = setTimeout(() => { document.addEventListener('click', onClick); document.addEventListener('keydown', onKey); }, 0);
    return () => { clearTimeout(id); document.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey); };
  }, [open]);
  if (!t) return null;
  return (
    <>
      <button className="w-9 h-9 rounded-full border border-rule bg-paper text-ink-2 inline-flex items-center justify-center cursor-pointer font-serif text-base font-medium hover:border-ink hover:text-ink" aria-label="Help" data-tip="Help" onClick={ev => { ev.stopPropagation(); setOpen(o => !o); }}>?</button>
      {open && (
        <div className="absolute right-0 top-11 z-30 w-[min(420px,calc(100vw-1.5rem))] bg-paper border border-rule rounded-xl shadow-[0_12px_32px_rgba(28,32,51,0.12)] pt-5 px-4 pb-4 grid gap-4" ref={ref}>
          <button className="absolute top-2 right-2 w-8 h-8 rounded-full bg-transparent text-ink-3 text-2xl leading-none inline-flex items-center justify-center cursor-pointer hover:bg-tint hover:text-ink" type="button" aria-label="Close" onClick={() => setOpen(false)}>×</button>
          <div className="grid gap-2"><span className="text-[13px] text-ink-3">{t.title}</span>
            <ol className="m-0 pl-[18px] text-sm leading-normal [&>li]:my-1">{t.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          </div>
          <div className="grid gap-2"><span className="text-[13px] text-ink-3">Keys</span>
            <table className="border-collapse w-full [&_td]:py-1 [&_td]:pr-2 [&_td]:border-b [&_td]:border-rule [&_td]:align-top [&_td]:text-[13px] [&_td:first-child]:w-[110px] [&_td:first-child]:whitespace-nowrap"><tbody>{t.keys.map(([k, d]) => <tr key={k}><td><kbd className={kbd}>{k}</kbd></td><td className="text-ink">{d}</td></tr>)}</tbody></table>
          </div>
          <div><Link href="/guide" className="text-accent hover:underline" onClick={() => setOpen(false)}>Full guide</Link></div>
        </div>
      )}
    </>
  );
}
