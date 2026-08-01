// שליפת טקסטים מספריא - לשימוש פנימי בלבד (חיבור בחנים ומענה על שאלות).
// הבוט לעולם לא שולח את הטקסט המלא למשתמש - הלימוד נעשה מהספרים.

const BASE = 'https://www.sefaria.org/api/texts/';

function stripHtml(s) {
  return String(s).replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
}

function flatten(x) {
  if (Array.isArray(x)) return x.map(flatten).filter(Boolean).join('\n');
  return stripHtml(x || '');
}

// מחזיר את הטקסט העברי של ref נתון (למשל "Berakhot 5a", "Mishnah Berakhot 1")
export async function getHebrewText(ref) {
  const url = `${BASE}${encodeURIComponent(ref)}?context=0&commentary=0&pad=0`;
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`Sefaria HTTP ${res.status} for ${ref}`);
  const data = await res.json();
  const he = flatten(data.he);
  if (!he) throw new Error(`אין טקסט עברי עבור ${ref}`);
  // הגבלת אורך כדי לא להעמיס על ה-AI
  return he.length > 9000 ? he.slice(0, 9000) + '\n[...קוצר...]' : he;
}
