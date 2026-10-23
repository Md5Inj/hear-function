import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getLocale } from 'next-intl/server';
export async function generateMetadata() { return { title: (await getLocale()) === 'ru' ? 'Как пользоваться — Hear Function' : 'How to use — Hear Function' }; }
const KEYS = [
  ['1–7', 'degree or the chord of that degree'], ['− then digit', 'lowered degree (♭3, ♭6, ♭7) or its chord'], ['+ then digit', 'raised degree'],
  ['Enter', 'check the answer, then the next question'], ['Backspace', 'erase the answer in the current bar'], ['← →', 'move to the neighbouring bar, with Shift select a range'],
  ['R', "repeat the question (degrees, progressions) or the previous bar's chord (songs)"], ['T', 'tonic chord'], ['Space', 'play the selected bars or the phrase'], ['L', 'loop the selected bars'],
];
function GuideEn() {
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
        <li>"Check" shows the answer and how much you got right. Space plays the chord of the current bar.</li>
      </ol>

      <h2>Song chords</h2>
      <ol>
        <li>A player with a fragment of a real recording is at the bottom. "Listen" plays a cadence in the song's key and then the fragment; "No cadence" the fragment only; "Tonic" a single tonic chord.</li>
        <li>Clicking a bar plays just it. Select several bars with the mouse or Shift with arrows; a panel appears above the selection: play, loop, slow to half speed.</li>
        <li>Enter the chord of each bar. The "%" sign repeats the previous bar's chord.</li>
        <li>"Check" shows whether you are right and what share of the bars you got.</li>
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

const KEYS_RU = [
  ['1–7', 'ступень или аккорд этой ступени'], ['− затем цифра', 'пониженная ступень (♭3, ♭6, ♭7) или аккорд на ней'], ['+ затем цифра', 'повышенная ступень'],
  ['Enter', 'проверить ответ, затем следующий вопрос'], ['Backspace', 'стереть ответ в текущем такте'], ['← →', 'перейти к соседнему такту, с Shift выделить диапазон'],
  ['R', "повторить вопрос (ступени, прогрессии) или аккорд предыдущего такта (песни)"], ['T', 'тонический аккорд'], ['Пробел', 'сыграть выделенные такты или фразу'], ['L', 'зациклить выделенные такты'],
];
function GuideRu() {
  return (
    <article className="max-w-[720px] mx-auto pt-7 pb-[60px] [&_h1]:font-serif [&_h1]:font-medium [&_h1]:text-4xl [&_h1]:mb-3.5 [&_h2]:font-serif [&_h2]:font-medium [&_h2]:text-2xl [&_h2]:mt-[34px] [&_h2]:mb-2.5 [&_p]:text-base [&_p]:leading-relaxed [&_p]:text-ink [&_li]:text-base [&_li]:leading-relaxed [&_li]:text-ink [&_li]:my-1.5 [&_ol]:pl-[22px]">
      <h1>Как пользоваться</h1>
      <p className="!text-lg !text-ink-2">Четыре упражнения, у каждого свои уровни. Везде одна логика: сначала каденция задаёт тональность, потом звучит вопрос, вы отвечаете ступенями или аккордами относительно тоники.</p>

      <h2>Вход и прогресс</h2>
      <p>Без входа можно посмотреть главную, упражнения требуют аккаунт: он нужен, чтобы хранить уровни, ответы и пройденные песни. Прогресс ведётся отдельно по каждому упражнению и ладу: мажор и минор переключаются в меню, подпунктами у каждого упражнения.</p>

      <h2>Уровни</h2>
      <p>Каждый уровень добавляет одну ступень или один аккорд к предыдущим. Уровень открывается автоматически, когда из последних двадцати ответов шестнадцать верных. Текущий уровень и список всех уровней показываются за шестерёнкой справа в полосе серии; там же можно перейти на любой уровень вручную.</p>

      <h2>Ступени</h2>
      <ol>
        <li>Нажмите «Слушать»: прозвучит каденция, затем одна нота.</li>
        <li>Выберите ступень кнопкой или цифрой на клавиатуре. Знаки «−» и «+» перед цифрой дают пониженные и повышенные ступени.</li>
        <li>После ответа показывается верная ступень, кнопка «разрешение» проигрывает ход этой ступени к тонике, это помогает запомнить её тяготение.</li>
      </ol>
      <p>Каждая группа ступеней идёт четырьмя задачами: одна октава; разные октавы, где нота может прозвучать на октаву ниже или выше; в темпе, где каденция вдвое короче и на ответ даётся две секунды после ноты, иначе вопрос засчитывается как ошибка; и в темпе в разных октавах.</p>
      <p>На верхних уровнях каденция звучит не каждый раз: несколько нот подряд идут в одной тональности, и вы держите тонику в памяти.</p>

      <h2>Интервалы</h2>
      <ol>
        <li>«Слушать»: две ноты. На уровнях «вверх» сначала нижняя, затем верхняя; на уровнях «вниз» наоборот; на уровнях «гармонически» обе вместе; на уровнях «смешанно» любой из этих способов.</li>
        <li>Назовите интервал кнопкой или клавишей: цифра 2–8 для большого или чистого интервала, «−» перед цифрой для малого, «+» затем 4 для тритона.</li>
        <li>После ответа показываются название интервала и обе ноты, «ещё раз» проигрывает их снова.</li>
      </ol>
      <p>Интервалы идут группами по возрастанию, каждая только своими интервалами: секунды; терции; кварта, квинта и тритон; сексты; септимы и октава. Последняя группа смешивает все двенадцать. Каждая группа — четыре отдельные задачи: вверх, вниз, гармонически и смешанно, где способ подачи каждый раз случайный.</p>

      <h2>Прогрессии</h2>
      <ol>
        <li>«Слушать»: каденция, затем последовательность аккордов, по одному на такт.</li>
        <li>Заполните такты аккордами из панели или цифрами. Курсор сам переходит к следующему пустому такту.</li>
        <li>«Проверить» показывает ответ и сколько угадано. Пробел проигрывает аккорд текущего такта.</li>
      </ol>

      <h2>Аккорды песен</h2>
      <ol>
        <li>Внизу плеер с фрагментом настоящей записи. «Слушать» играет каденцию в тональности песни и затем фрагмент; «Без каденции» только фрагмент; «Тоника» один тонический аккорд.</li>
        <li>Клик по такту играет только его. Выделите несколько тактов мышью или Shift со стрелками, над выделением появится панель: сыграть, зациклить, замедлить вдвое.</li>
        <li>Впишите аккорд каждого такта. Знак «%» повторяет аккорд предыдущего такта.</li>
        <li>«Проверить» показывает, верно ли и какую долю тактов вы угадали.</li>
      </ol>
      <p>Пройденные песни больше не выпадают. Когда песни уровня закончились, можно повторить их или перейти к ошибкам.</p>

      <h2>Мелодии песен</h2>
      <p>Вместо аккордов звучит вокальная фраза, ответ: ступень каждой ноты по порядку. Каденция перед фразой задаёт тональность, кнопка «слушать фразу» играет только её.</p>

      <h2>Работа над ошибками</h2>
      <p>Всё, на что вы ответили неверно, сохраняется. Красная кнопка «Работа над ошибками» у шестерёнки показывает, сколько ошибок на текущем уровне, и открывает режим, где задаются только они. Верный ответ убирает ошибку из списка. Режим включается и в настройках, блок «Режим».</p>

      <h2>История</h2>
      <p>Значок часов в шапке открывает историю: пройденные песни по ладу и уровню, ответы в ступенях и прогрессиях. Любую песню можно пройти ещё раз или убрать из истории, тогда она снова будет выпадать в упражнении.</p>

      <h2>Горячие клавиши</h2>
      <table className="border-collapse w-full [&_td]:py-[7px] [&_td]:pr-2.5 [&_td]:border-b [&_td]:border-rule [&_td]:align-top [&_td]:text-[15px] [&_td:first-child]:w-[150px] [&_td:first-child]:whitespace-nowrap"><tbody>{KEYS_RU.map(([k, d]) => <tr key={k}><td><kbd className="font-sans border border-rule rounded-md px-[7px] py-px text-[13px] bg-tint text-ink-2">{k}</kbd></td><td>{d}</td></tr>)}</tbody></table>
      <p>Русская раскладка тоже работает: R это К, T это Е, L это Д, «−» это И.</p>

      <p className="mt-[34px]"><Button asChild variant="primary" size="primary"><Link href="/degrees">Начать со ступеней</Link></Button></p>
    </article>
  );
}

export default async function Guide() { return (await getLocale()) === 'ru' ? <GuideRu /> : <GuideEn />; }
