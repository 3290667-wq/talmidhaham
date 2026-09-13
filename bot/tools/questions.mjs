// כלי בדיקת תוכן: רשימת שאלות, שאלות שדווחו, והשהיה/החזרה של שאלה.
//
//   node tools/questions.mjs flagged              - מה ממתין לבדיקה
//   node tools/questions.mjs list <חלק מהשם>       - שאלות של יחידה
//   node tools/questions.mjs suspend <ref> <מס'> [סיבה]
//   node tools/questions.mjs restore <ref> <מס'>
//
// כתיבה חסומה כל עוד הבוט רץ: הבוט מחזיק את המאגר בזיכרון וכותב אותו שלם,
// ולכן עריכה במקביל הייתה נדרסת. לעריכה: pm2 stop talmid-bot, לתקן, ולהפעיל.
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const DATA = process.env.TALMID_DATA_DIR || new URL('../data', import.meta.url).pathname;
const PATH = join(DATA, 'store.json');
const store = JSON.parse(readFileSync(PATH, 'utf8'));
const [cmd, arg1, arg2, ...rest] = process.argv.slice(2);

function botRunning() {
  try {
    return execSync('pm2 jlist', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .includes('"talmid-bot"') && JSON.parse(execSync('pm2 jlist', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }))
      .some((p) => p.name === 'talmid-bot' && p.pm2_env?.status === 'online');
  } catch { return false; }
}

function saveStore() {
  if (botRunning()) {
    console.error('❌ הבוט רץ - עריכה עכשיו תידרס. עצור אותו (pm2 stop talmid-bot), ערוך, והפעל שוב.');
    process.exit(1);
  }
  const tmp = `${PATH}.tmp`;
  writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
  renameSync(tmp, PATH);
  console.log('✅ נשמר.');
}

function* allUnits() {
  for (const [uid, u] of Object.entries(store.users)) {
    for (const [ref, unit] of Object.entries(u.units || {})) yield { uid, u, ref, unit };
  }
}

if (cmd === 'flagged') {
  let n = 0;
  for (const [uid, u] of Object.entries(store.users)) {
    for (const f of (u.flags || []).filter((x) => x.status === 'open')) {
      console.log(`\n[${uid.slice(0, 4)}…] ${f.refHe} (${f.at})\n  שאלה: ${f.q}\n  הערה: ${f.note || '—'}`);
      n++;
    }
  }
  for (const { ref, unit } of allUnits()) {
    (unit.questions || []).forEach((q, i) => {
      if (q.flagged) { console.log(`  מושהית: ${ref} #${i} — ${String(q.q).slice(0, 80)}`); n++; }
    });
  }
  console.log(n ? `\nסה"כ ${n} פריטים לבדיקה.` : 'אין שאלות שממתינות לבדיקה.');
} else if (cmd === 'list') {
  for (const { ref, unit } of allUnits()) {
    if (arg1 && !ref.includes(arg1) && !String(unit.refHe).includes(arg1)) continue;
    console.log(`\n== ${ref} (${unit.refHe}) · נלמד ${unit.learnedAt} · שלב ${unit.intervalIdx ?? 0} ==`);
    (unit.questions || []).forEach((q, i) => {
      console.log(`  #${i}${q.flagged ? ' [מושהית]' : ''} ${q.q}\n      תשובה: ${q.ideal}`);
    });
  }
} else if (cmd === 'suspend' || cmd === 'restore') {
  const idx = parseInt(arg2, 10);
  let done = false;
  for (const { ref, unit, u } of allUnits()) {
    if (ref !== arg1) continue;
    const q = (unit.questions || [])[idx];
    if (!q) break;
    if (cmd === 'suspend') {
      q.flagged = { at: new Date().toISOString().slice(0, 10), note: rest.join(' ') || 'בדיקת תוכן' };
      u.flags = [...(u.flags || []), { at: q.flagged.at, ref, refHe: unit.refHe, q: q.q, note: q.flagged.note, status: 'open' }];
      console.log(`השהיתי: ${ref} #${idx}`);
    } else {
      delete q.flagged;
      u.flags = (u.flags || []).map((f) => (f.ref === ref && f.q === q.q ? { ...f, status: 'resolved' } : f));
      console.log(`החזרתי לשימוש: ${ref} #${idx}`);
    }
    done = true;
  }
  if (!done) { console.error('לא נמצאה שאלה כזו. השתמש ב-list כדי לראות מזהים.'); process.exit(1); }
  saveStore();
} else {
  console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(0, 11).join('\n'));
}
