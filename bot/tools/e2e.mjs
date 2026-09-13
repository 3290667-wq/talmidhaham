// בדיקת קצה-לקצה על נתוני בדיקה בלבד (TALMID_DATA_DIR זמני).
// שולחת ל"ערוץ" מדומה - אף הודעה לא יוצאת לווצאפ.
// מריצים בשני שלבים כדי לבדוק גם הפעלה מחדש באמצע חזרה:
//   PHASE=1 node tools/e2e.mjs   ואז   PHASE=2 node tools/e2e.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = process.env.TALMID_DATA_DIR;
if (!DIR) { console.error('חובה TALMID_DATA_DIR זמני'); process.exit(1); }
const { handleMessage } = await import('../src/conversation.js');
const U = 'e2e@local';
let out = [];
const send = async (p) => { const t = typeof p === 'string' ? p : p.text; out.push(t); return true; };
const say = async (text) => { out = []; await handleMessage(U, 'בדיקה', text, send); return out.join('\n'); };
const show = (label, text) => console.log(`\n### ${label}\n${text.slice(0, 700)}`);
const storePath = join(DIR, 'store.json');
const readStore = () => JSON.parse(readFileSync(storePath, 'utf8'));

if (process.env.PHASE === '1') {
  await say('הרשמה'); await say('2'); await say('ברכות'); await say('1'); await say('2'); await say('7');
  await say('כן');
  show('אישור תכנית', await say('אשר'));
  show('היום', await say('היום'));
  show('טקסט (ספריא)', await say('טקסט'));
  show('למדתי → בוחן', await say('למדתי'));
  show('תשובה 1: "לא יודע"', await say('לא יודע'));
  show('תשובה 2 אמיתית', await say('כל מי שאוכל פת חייב בברכה, ומברכים לפני ואחרי'));

  const s1 = readStore();
  const u = s1.users[U];
  const unitRef = Object.keys(u.units)[0];
  console.log(`\n### היחידה נרשמה: ${unitRef} · חזרה ב-${u.units[unitRef].nextReview} · ציון ${u.units[unitRef].scores}`);
  console.log(`### ימי לימוד: ${JSON.stringify(u.stats.studyDays)}`);
  // מקדימים את מועד החזרה כדי לבדוק את מסלול החזרות
  u.units[unitRef].nextReview = '2026-01-01';
  writeFileSync(storePath, JSON.stringify(s1, null, 2));
  console.log('\n(הקדמתי את מועד החזרה. הפעל שוב עם PHASE=2 - זו גם בדיקת "הפעלה מחדש")');
} else {
  show('חזרה (מנה)', await say('חזרה'));
  const mid = readStore().users[U];
  console.log(`\n### מצב שנשמר באמצע: mode=${mid.state.mode} · תור=${JSON.stringify(mid.state.review?.queue)} · שאלה ${mid.state.review?.qIdx}`);
  show('רמז', await say('רמז'));
  show('תשובה אחרי רמז', await say('מברכים ברכת המזון אחרי האוכל'));
  const after = readStore().users[U];
  const unit = Object.values(after.units)[0];
  console.log(`\n### אחרי החזרה: intervalIdx=${unit.intervalIdx} (היה 0) · reviewLog=${JSON.stringify(unit.reviewLog)}`);
  console.log(`### עזרה חסמה קידום: ${unit.intervalIdx === 0 ? 'כן ✓' : 'לא ✗'}`);
  show('מצב', await say('מצב'));
}
