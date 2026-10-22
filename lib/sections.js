/* Section names are stored on songs (куплет, припев, …), including in data/db.json which must not be rewritten.
   Translate them to English at render time instead. Unknown values pass through unchanged. */
const MAP = {
  'куплет': 'Verse',
  'припев': 'Chorus',
  'вступление': 'Intro',
  'бридж': 'Bridge',
  'кода': 'Coda',
  'предприпев': 'Pre-chorus',
  'интерлюдия': 'Interlude',
  'соло': 'Solo',
  'переход': 'Transition',
  'инструментал': 'Instrumental',
  'рефрен': 'Refrain',
  'перед куплетом': 'Before the verse',
  'вступление на фортепиано': 'Piano intro',
  'финальный припев': 'Final chorus',
  'последний куплет': 'Last verse',
  'начало куплета': 'Start of the verse',
  'вступление, второй круг': 'Intro, second time',
  'куплет 1: «see the stone set in your eyes»': 'Verse 1: "See the stone set in your eyes"',
};

export function sectionEn(s) {
  if (!s) return s;
  const key = String(s).trim().toLowerCase();
  return MAP[key] || s;
}
