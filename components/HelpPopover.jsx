'use client';
/* Кнопка «?» у шестерёнки: краткая инструкция к упражнению и клавиши. */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
const TEXT = {
  degrees: { title: 'Ступени', steps: ['«Слушать»: каденция, затем одна нота.', 'Назовите ступень: кнопка или цифра 1–7, «−» и «+» перед цифрой для альтераций.', 'После ответа «разрешение» играет ход ступени к тонике.', 'Каждая группа ступеней идёт четырьмя задачами: одна октава, разные октавы, в темпе (две секунды на ответ), в темпе и разных октавах.'], keys: [['1–7', 'ступень'], ['− / +', 'понизить или повысить'], ['Enter', 'дальше'], ['R', 'повторить']] },
  progressions: { title: 'Прогрессии', steps: ['«Слушать»: каденция, затем аккорды по тактам.', 'Заполните такты аккордами из панели или цифрами; курсор сам идёт к следующему пустому.', '«Проверить», затем «Исправить», чтобы переответить ошибочные такты.'], keys: [['1–7', 'аккорд ступени'], ['− затем цифра', '♭III, ♭VI, ♭VII'], ['Пробел', 'аккорд такта'], ['← →', 'такт'], ['Backspace', 'стереть'], ['Enter', 'проверить / дальше']] },
  songs: { title: 'Аккорды песен', steps: ['«Слушать»: каденция в тональности песни, затем фрагмент записи. Клик по такту играет только его.', 'Выделите такты мышью или Shift со стрелками: над ними панель сыграть, зациклить, замедлить.', 'Впишите аккорд каждого такта, «%» повторяет предыдущий. После проверки сравните свой вариант и правильный на пианино.'], keys: [['1–7', 'аккорд ступени'], ['%', 'как в предыдущем такте'], ['Пробел', 'сыграть выделение'], ['L', 'цикл'], ['T', 'тоника'], ['Enter', 'проверить / дальше']] },
  intervals: { title: 'Интервалы', steps: ['«Слушать»: две ноты — снизу вверх, сверху вниз или вместе, смотря какая задача.', 'Назовите интервал кнопкой или клавишей: цифра 2–8 для большого или чистого, «−» перед цифрой для малого, «+» затем 4 для тритона.', 'Каждая группа интервалов идёт четырьмя задачами: вверх, вниз, гармонически, смешанно. Последняя группа смешивает все интервалы.'], keys: [['2–8', 'большой / чистый'], ['− затем цифра', 'малый'], ['+ затем 4', 'тритон'], ['Enter', 'дальше'], ['R', 'повторить']] },
  melodies: { title: 'Мелодии песен', steps: ['«Слушать»: каденция, затем вокальная фраза.', 'Ступень каждой ноты по порядку: кнопки или цифры, «−» и «+» для альтераций.', 'Backspace стирает последнюю ступень, стрелки двигают курсор.'], keys: [['1–7', 'ступень'], ['− / +', 'альтерация'], ['Пробел', 'сыграть фразу'], ['T', 'тоника'], ['Enter', 'проверить / дальше']] },
};
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
      <button className="gear help" aria-label="Как пользоваться" data-tip="Как пользоваться" onClick={ev => { ev.stopPropagation(); setOpen(o => !o); }}>?</button>
      {open && (
        <div className="popover help-pop" ref={ref}>
          <button className="modal-close" type="button" aria-label="Закрыть" onClick={() => setOpen(false)}>×</button>
          <div className="pop-row"><span className="pop-label">{t.title}</span>
            <ol className="help-steps">{t.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          </div>
          <div className="pop-row"><span className="pop-label">Клавиши</span>
            <table className="keys-table small"><tbody>{t.keys.map(([k, d]) => <tr key={k}><td><kbd>{k}</kbd></td><td>{d}</td></tr>)}</tbody></table>
          </div>
          <div className="pop-row"><Link href="/guide" className="link" onClick={() => setOpen(false)}>Подробная инструкция</Link></div>
        </div>
      )}
    </>
  );
}
