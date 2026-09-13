// בחירה חופשית של ספר מכל הספרייה של ספריא (רמב"ם, מסילת ישרים, חובות
// הלבבות, ספרי מוסר, מדרש, זוהר...) - לא רק מהלוחות המובנים.
//
// שני שלבים:
// 1. /api/name/<שם בעברית>  - פותר שם חופשי לספר, כולל שגיאות כתיב, ומחזיר הצעות
// 2. /api/shape/<title>     - מבנה הספר (כמה פרקים/שערים), משם בונים את היחידות

import { toHebrewNum } from './curriculum.js';

const API = 'https://www.sefaria.org/api';

async function getJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`ספריא החזירה ${res.status}`);
  return res.json();
}

// פתרון שם חופשי לספר.
// מחזיר { title, heTitle } אם זוהה ספר, או { suggestions: [...] } אם לא ברור.
export async function resolveBook(nameHe) {
  const q = (nameHe || '').trim();
  if (!q) return { suggestions: [] };
  const d = await getJson(`${API}/name/${encodeURIComponent(q)}`);

  // ספריא מחזירה is_ref כשהיא זיהתה ספר/הפניה ודאית
  if (d.is_ref && d.book) {
    return { title: d.book, heTitle: d.he || q };
  }
  // אחרת - הצעות השלמה. מסננים כותרות משנה (מכילות פסיק) כדי להציע ספרים שלמים.
  const objs = (d.completion_objects || []).filter((c) => c.type === 'ref');
  const whole = objs.filter((c) => !String(c.title).includes(','));
  const picked = (whole.length ? whole : objs).slice(0, 5);
  return { suggestions: picked.map((c) => c.title) };
}

// פתרון הפניה חופשית לצורך שליחת טקסט: ספר שלם, פרק, דף או סימן.
// מחזיר { ref, heRef, isBook } כשזוהה, או { suggestions: [...] } כשלא ברור.
export async function resolveAnyRef(q) {
  const d = await getJson(`${API}/name/${encodeURIComponent((q || '').trim())}`);
  if (d.is_ref) {
    return { ref: d.ref || d.book, heRef: d.heRef || d.he || q, isBook: !!d.is_book };
  }
  const picked = (d.completion_objects || []).filter((c) => c.type === 'ref').slice(0, 5);
  return { suggestions: picked.map((c) => c.title) };
}

// בניית מסלול לימוד מספר כלשהו: יחידה = פרק/שער.
// title = השם האנגלי שהוחזר מ-resolveBook.
// מחזיר { book, bookHe, units: [{ref, refHe}] } או null.
export async function buildBookTrack(title) {
  const shapes = await getJson(`${API}/shape/${encodeURIComponent(title)}`);
  const arr = Array.isArray(shapes) ? shapes : [shapes];
  const s = arr[0];
  if (!s) return null;

  const bookHe = s.heBook || s.heTitle || heName;
  const bookEn = s.book || s.title;
  const units = [];

  if (s.isComplex) {
    // ספר מורכב (שערים/חלקים): כל צומת הוא יחידה, ואם יש בו פרקים - פרק ליחידה.
    for (const node of s.chapters || []) {
      const nTitle = node.title;
      const nHe = node.heTitle || nTitle;
      if (!nTitle) continue;
      const len = Array.isArray(node.chapters) ? node.chapters.length : Number(node.length) || 1;
      if (len > 1) {
        for (let i = 1; i <= len; i++) {
          units.push({ ref: `${nTitle} ${i}`, refHe: `${nHe} ${toHebrewNum(i)}` });
        }
      } else {
        units.push({ ref: nTitle, refHe: nHe });
      }
    }
  } else {
    const len = Number(s.length) || (Array.isArray(s.chapters) ? s.chapters.length : 0);
    if (!len) return null;
    for (let i = 1; i <= len; i++) {
      units.push({ ref: `${bookEn} ${i}`, refHe: `${bookHe} פרק ${toHebrewNum(i)}` });
    }
  }

  if (!units.length) return null;
  return { book: bookEn, bookHe, units };
}
