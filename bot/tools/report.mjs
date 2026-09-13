// דוח בעלים - קריאה בלבד. אין אתר ואין שרת חדש: הרצה בשורת הפקודה.
//   node tools/report.mjs
// מציג פעילות, חזרות, עומס תור, זכירה לאחר פער, אמינות ושאלות שדווחו.
// כלל: "חסר" אינו "אפס". מה שלא תועד - נאמר עליו שלא נמדד.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DATA = process.env.TALMID_DATA_DIR || new URL('../data', import.meta.url).pathname;
const store = JSON.parse(readFileSync(join(DATA, 'store.json'), 'utf8'));

// תאריך מקומי לפי שעון ישראל - לא UTC (בלילה זה הבדל של יום שלם)
const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());
const days = (from, to = today) => (from ? Math.round((new Date(`${to}T12:00:00`) - new Date(`${from}T12:00:00`)) / 86400000) : null);

console.log(`\n===== כתר תורה - דוח בעלים =====\nחיתוך: ${today} · שעון ישראל · מקור: store.json + events/*.jsonl\n`);

for (const [id, u] of Object.entries(store.users)) {
  const units = Object.values(u.units || {});
  const due = units.filter((x) => x.nextReview && x.nextReview <= today);
  // המאגר מקבל studyDays בהרצה הראשונה של הבוט אחרי השדרוג; עד אז נגזר כאן
  // מאותה היסטוריה בדיוק (learnedAt + יומן חזרות), בלי להמציא אירועים.
  const derived = [...new Set([
    ...units.map((x) => x.learnedAt).filter(Boolean),
    ...units.flatMap((x) => (x.reviewLog || []).map((r) => r.at)).filter(Boolean),
  ])].sort();
  const studyDays = u.stats?.studyDays?.length ? u.stats.studyDays : derived;
  const fromStore = Boolean(u.stats?.studyDays?.length);
  const last = studyDays[studyDays.length - 1] || null;
  const reviews = units.flatMap((x) => x.reviewLog || []);
  const independent = reviews.filter((r) => !r.assisted && r.score >= 80);
  const late = independent.filter((r) => (r.gapDays ?? 0) >= 7);
  const month = independent.filter((r) => (r.gapDays ?? 0) >= 27);
  const recalled = units.filter((x) => {
    const log = (x.reviewLog || []).filter((r) => !r.assisted && r.score >= 80);
    return log.length >= 2 && log.some((r) => (r.gapDays ?? 0) >= 7);
  });
  console.log(`— משתמש ${id.slice(0, 4)}… (${u.name ? 'יש שם' : 'בלי שם'})`);
  console.log(`  יחידות שנלמדו: ${units.length} · ימי לימוד מתועדים: ${studyDays.length}${fromStore ? '' : ' (נגזר מהיסטוריית הלימוד; המאגר טרם עודכן)'}`);
  console.log(`  לימוד אחרון: ${last || 'לא ידוע'}${last ? ` (לפני ${days(last)} ימים)` : ''}`);
  console.log(`  תור חזרות: ${due.length} מתוך ${units.length}${due.length ? ` · הוותיקה ביותר ממתינה ${days(due.map((x) => x.nextReview).sort()[0])} ימים` : ''}`);
  console.log(`  חזרות מתועדות ביומן החדש: ${reviews.length}${reviews.length ? '' : ' (היומן התחיל בשדרוג - ההיסטוריה הישנה לא כללה פירוט)'}`);
  console.log(`  הצלחות עצמאיות (בלי עזרה, 80+): ${independent.length} · מהן אחרי 7+ ימים: ${late.length} · אחרי 27+ ימים: ${month.length}`);
  console.log(`  יחידות במצב "נזכר בחזרה מאוחרת": ${recalled.length}`);
  const flags = (u.flags || []).filter((f) => f.status === 'open');
  console.log(`  שאלות שדווחו וממתינות לבדיקה: ${flags.length}`);
  for (const f of flags.slice(0, 5)) console.log(`    · ${f.refHe}: ${String(f.q).slice(0, 70)}…`);
  const ungraded = units.filter((x) => x.ungraded);
  if (ungraded.length) console.log(`  יחידות שסומנו "לא דורג": ${ungraded.length}`);
  console.log('');
}

// ---- אירועים ----
const evDir = join(DATA, 'events');
if (!existsSync(evDir)) {
  console.log('יומן אירועים: טרם נוצר (נוצר עם האירוע הראשון אחרי השדרוג).');
} else {
  const lines = readdirSync(evDir).filter((f) => f.endsWith('.jsonl'))
    .flatMap((f) => readFileSync(join(evDir, f), 'utf8').split('\n').filter(Boolean));
  const ev = lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const by = (t) => ev.filter((e) => e.type === t);
  const sends = by('send');
  const failed = sends.filter((e) => e.state === 'failed');
  console.log('===== אמינות (מיומן האירועים) =====');
  console.log(`  הודעות שנמסרו לספק: ${sends.length - failed.length} · נכשלו: ${failed.length}`);
  if (failed.length) console.log(`    סיבות: ${[...new Set(failed.map((f) => `${f.status} ${f.reason || ''}`.trim()))].slice(0, 3).join(' · ')}`);
  console.log(`  הודעות יזומות: ${by('proactive').length} (בוקר: ${by('proactive').filter((e) => e.kind === 'morning').length}, תזכורות: ${by('proactive').filter((e) => e.kind === 'reminder').length})`);
  console.log(`  מסירות כפולות שנחסמו: ${by('inbound_duplicate').length}`);
  console.log(`  "לא דורג": ${by('ungraded').length} · שימוש ברמז/חשיפה: ${by('assist').length} · דיווחי שאלה: ${by('flag').length}`);
  console.log(`  גיבויים: ${by('backup').filter((e) => e.ok).length} הצליחו, ${by('backup').filter((e) => !e.ok).length} נכשלו`);
  console.log('  עלות וטוקנים: חסר - הספק אינו מחזיר מדידה לבוט.');
}
console.log('\nהערה: אישור הספק אינו אישור מסירה או קריאה בווצאפ. "נמסר לספק" הוא כל מה שידוע.\n');
