// בדיקת סולם החזרות של תכנית "כתר תורה": יחידה חוזרת אחרי יום, 3 ימים, שבוע,
// שבועיים, חודש, 3 חודשים, חצי שנה ושנה — ו"חזרה" מרימה בפועל את כל היחידות
// שהגיע זמנן באותו יום (אתמול, לפני שבוע, לפני חודש — יחד).
//
// המאגר: תיקייה זמנית. חובה לקבוע TALMID_DATA_DIR לפני כל ייבוא.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
process.env.TALMID_DATA_DIR = mkdtempSync(join(tmpdir(), 'talmid-ladder-'));

const { INTERVALS, newUnitSchedule, afterReview, dueUnits } = await import('./src/fsrs.js');
const { today, addDays, loadUser, save } = await import('./src/db.js');
const { handleMessage } = await import('./src/conversation.js');

let pass = 0, fail = 0;
const check = (label, ok, got) => {
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (ok) pass++; else { fail++; if (got !== undefined) console.log(`   got: ${JSON.stringify(String(got).slice(0, 200))}`); }
};

// --- 1. הסולם עצמו: התכנית מבטיחה יום / 3 ימים / שבוע / חודש / 3 חודשים / שנה ---
const PLAN = [1, 3, 7, 30, 90, 365]; // מה שכתוב בתכנית העבודה
check('הסולם מכיל את כל מרווחי התכנית', PLAN.every((d) => INTERVALS.includes(d)), INTERVALS.join(','));

// יחידה שנלמדה היום — חזרה ראשונה מחר
const u = { refHe: 'משנה זבחים פרק א', ...newUnitSchedule() };
check('חזרה ראשונה מחר', u.nextReview === addDays(today(), 1), u.nextReview);

// כל חזרה מוצלחת מטפסת שלב אחד בסולם
const climbed = [];
for (let i = 0; i < INTERVALS.length; i++) {
  afterReview(u, 95);
  climbed.push(INTERVALS[u.intervalIdx]);
}
check('טיפוס מלא בסולם אחרי חזרות מוצלחות',
  JSON.stringify(climbed) === JSON.stringify([3, 7, 14, 30, 90, 180, 365, 365]), climbed.join(','));

// ציון בינוני מקפיא, ציון נמוך מוריד שלב ומחזיר למחר
const mid = { intervalIdx: 3, reviews: 0 };
afterReview(mid, 65);
check('ציון 50-79 נשאר באותו שלב', mid.intervalIdx === 3, mid.intervalIdx);
const low = { intervalIdx: 3, reviews: 0 };
afterReview(low, 30);
check('ציון נמוך יורד שלב וחוזר מחר',
  low.intervalIdx === 2 && low.nextReview === addDays(today(), 1), `${low.intervalIdx}/${low.nextReview}`);

// --- 2. "חזרה" מרימה יחד את אתמול + לפני שבוע + לפני חודש ---
const USER = '972500009999@c.us';
const store = loadUser(USER, 'בודק');
store.user = { onboarded: true, tracks: [{ type: 'mishnah', book: 'Mishnah Zevachim', bookHe: 'משנה זבחים', pace: 1, index: 3, total: 14, questions: 3, units: [] }], sendHour: 7, skipShabbat: true };
store.state = { mode: 'idle' };

// שלוש יחידות בשלבים שונים בסולם, שכולן הגיע זמנן היום
const mk = (ref, refHe, learnedDaysAgo, idx) => ({
  refHe, track: 'משנה זבחים', learnedAt: addDays(today(), -learnedDaysAgo),
  questions: [{ q: `שאלה על ${refHe}`, ideal: 'תשובה' }], qsOwn: true,
  scores: [90], reviews: idx, intervalIdx: idx, nextReview: today(),
});
store.units = {
  'Mishnah Zevachim 1': mk('Mishnah Zevachim 1', 'משנה זבחים פרק א', 1, 0),   // אתמול
  'Mishnah Zevachim 2': mk('Mishnah Zevachim 2', 'משנה זבחים פרק ב', 7, 2),   // לפני שבוע
  'Mishnah Zevachim 3': mk('Mishnah Zevachim 3', 'משנה זבחים פרק ג', 30, 4),  // לפני חודש
  'Mishnah Zevachim 4': { ...mk('Mishnah Zevachim 4', 'משנה זבחים פרק ד', 0, 0), nextReview: addDays(today(), 1) }, // עדיין לא
};
save();

check('dueUnits מזהה 3 מתוך 4', dueUnits(store.units).length === 3, dueUnits(store.units).length);

let out = [];
const send = (p) => { out.push(typeof p === 'string' ? p : p.text); };
out = [];
await handleMessage(USER, 'בודק', 'חזרה', send);
const reply = out.join('\n');
check('"חזרה" נכנס למצב חזרה', loadUser(USER).state.mode === 'review', loadUser(USER).state.mode);
check('התור מכיל את שלוש היחידות שהגיע זמנן', loadUser(USER).state.review?.total === 3, loadUser(USER).state.review?.total);
check('ההודעה פותחת ביחידה 1 מתוך 3', reply.includes('יחידה 1 מתוך 3'), reply);
check('ההודעה מציינת מתי נלמד', reply.includes('נלמד ב-'), reply);
const queued = [loadUser(USER).state.review.ref, ...loadUser(USER).state.review.queue];
check('היחידה שטרם הגיע זמנה לא נכנסה לתור', !queued.includes('Mishnah Zevachim 4'), queued.join(','));
check('אתמול, לפני שבוע ולפני חודש — כולן בתור',
  ['Mishnah Zevachim 1', 'Mishnah Zevachim 2', 'Mishnah Zevachim 3'].every((r) => queued.includes(r)), queued.join(','));

console.log(`\n${pass} עברו, ${fail} נכשלו`);
process.exit(fail ? 1 : 0);
