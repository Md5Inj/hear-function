import Link from 'next/link';
import { Button } from '@/components/ui/button';
export const metadata = { title: 'How to use — hear function' };
const KEYS = [
  ['1–7', 'degree or the chord of that degree'], ['− then digit', 'lowered degree (♭3, ♭6, ♭7) or its chord'], ['+ then digit', 'raised degree'],
  ['Enter', 'check the answer, then the next question'], ['Backspace', 'erase the answer in the current bar'], ['← →', 'move to the neighbouring bar, with Shift select a range'],
  ['R', "repeat the question (degrees, progressions) or the previous bar's chord (songs)"], ['T', 'tonic chord'], ['Space', 'play the selected bars or the phrase'], ['L', 'loop the selected bars'],
];
export default function Guide() {
  return (
    <article className="max-w-[720px] mx-auto pt-7 pb-[60px] [&_h1]:font-serif [&_h1]:font-medium [&_h1]:text-4xl [&_h1]:mb-3.5 [&_h2]:font-serif [&_h2]:font-medium [&_h2]:text-2xl [&_h2]:mt-[34px] [&_h2]:mb-2.5 [&_p]:text-base [&_p]:leading-relaxed [&_p]:text-ink [&_li]:text-base [&_li]:leading-relaxed [&_li]:text-ink [&_li]:my-1.5 [&_ol]:pl-[22px]">
      <h1>How to use</h1>
      <p className="!text-lg !text-ink-2">Four exercises, each with its own levels. The same logic everywhere: a cadence sets the key, then the question sounds, and you answer with degrees or chords relative to the tonic.</p>

      <h2>Sign in and progress</h2>
      <p>You can view the home page without signing in; the exercises require an account to store levels, answers and passed songs. Progress is tracked separately for each exercise and key: major and minor switch in the menu, as sub-items under each exercise.</p>

      <h2>Levels</h2>
      <p>Each level adds one degree or one chord to the previous ones. A level opens automatically once sixteen of the last twenty answers are correct. The current level and the list of all levels are shown behind the gear on the right of the series bar; there you can also jump to any level manually.</p>

      <h2>Degrees</h2>
      <ol>
        <li>Press "Listen": a cadence sounds, then a single note.</li>
        <li>Choose the degree with a button or a digit on the keyboard. The "−" and "+" signs before the digit give lowered and raised degrees.</li>
        <li>After the answer the correct degree is shown; the "resolution" button plays the move of that degree to the tonic, which helps you remember its pull.</li>
      </ol>
      <p>Each group of degrees runs as four tasks: one octave; different octaves, where the note can sound an octave lower or higher; in tempo, where the cadence is half as long and you have two seconds after the note to answer, otherwise the question counts as a mistake; and in tempo across different octaves.</p>
      <p>On the higher levels the cadence does not sound every time: several notes in a row stay in one key, and you hold the tonic in memory.</p>

      <h2>Intervals</h2>
      <ol>
        <li>"Listen": two notes. On "up" levels the lower note comes first, then the upper; on "down" levels the other way round; on "harmonic" levels both together; on "mixed" levels any of these.</li>
        <li>Name the interval with a button or key: digit 2–8 for a major or perfect interval, "−" before the digit for a minor one, "+" then 4 for the tritone.</li>
        <li>After the answer the interval's name and both notes are shown; "again" plays them once more.</li>
      </ol>
      <p>Intervals come in ascending groups, each with its own intervals only: seconds; thirds; fourth, fifth and tritone; sixths; sevenths and the octave. The last group mixes all twelve. Each group is four separate tasks: up, down, harmonic and mixed, where the way the notes sound is random each time.</p>

      <h2>Progressions</h2>
      <ol>
        <li>"Listen": a cadence, then a sequence of chords, one per bar.</li>
        <li>Fill the bars with chords from the panel or with digits. The cursor moves on its own to the next empty bar.</li>
        <li>"Check" shows where the mistake is; "Fix" keeps the correct bars and lets you re-answer. Space plays the chord of the current bar.</li>
      </ol>

      <h2>Song chords</h2>
      <ol>
        <li>A player with a fragment of a real recording is at the bottom. "Listen" plays a cadence in the song's key and then the fragment; "No cadence" the fragment only; "Tonic" a single tonic chord.</li>
        <li>Clicking a bar plays just it. Select several bars with the mouse or Shift with arrows; a panel appears above the selection: play, loop, slow to half speed.</li>
        <li>Enter the chord of each bar. The "%" sign repeats the previous bar's chord.</li>
        <li>After checking you can compare your answer and the correct one on piano.</li>
      </ol>
      <p>Passed songs no longer come up. When a level's songs run out, you can repeat them or move to the mistakes.</p>

      <h2>Song melodies</h2>
      <p>Instead of chords a vocal phrase sounds; the answer is the degree of each note in order. A cadence before the phrase sets the key, and the "listen to the phrase" button plays only it.</p>

      <h2>Mistakes</h2>
      <p>Everything you answered incorrectly is saved. The red "Mistakes" button by the gear shows how many mistakes are on the current level and opens a mode that asks only those. A correct answer removes the mistake from the list. The mode also turns on in settings, the "Mode" block.</p>

      <h2>History</h2>
      <p>The clock icon in the header opens the history: passed songs by key and level, answers in degrees and progressions. Any song can be passed again or removed from the history, after which it will come up in the exercise again.</p>

      <h2>Keyboard shortcuts</h2>
      <table className="border-collapse w-full [&_td]:py-[7px] [&_td]:pr-2.5 [&_td]:border-b [&_td]:border-rule [&_td]:align-top [&_td]:text-[15px] [&_td:first-child]:w-[150px] [&_td:first-child]:whitespace-nowrap"><tbody>{KEYS.map(([k, d]) => <tr key={k}><td><kbd className="font-sans border border-rule rounded-md px-[7px] py-px text-[13px] bg-tint text-ink-2">{k}</kbd></td><td>{d}</td></tr>)}</tbody></table>
      <p>A Russian keyboard layout works too: R is К, T is Е, L is Д, "−" is И.</p>

      <p className="mt-[34px]"><Button asChild variant="primary" size="primary"><Link href="/degrees">Start with degrees</Link></Button></p>
    </article>
  );
}
