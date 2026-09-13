// בדיקות התנהגות ממוקדות לסיכונים של KETER-UPGRADE-20260913.
// בלי רשת, בלי AI, בלי שליחת הודעות - רק הכללים שהשתנו.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
process.env.TALMID_DATA_DIR = mkdtempSync(join(tmpdir(), 'talmid-upg-'));

const { today, addDays } = await import('./src/db.js');
const { pickDose, morningMessage, reminderPayload, streakInfo, isRecalled, buildDaily } = await import('./src/conversation.js');
const { effectiveReviewScore, afterReview, INTERVALS } = await import('./src/fsrs.js');
const { validateGrade } = await import('./src/ai.js');
const { pingBudget } = await import('./src/scheduler.js');
const { seenRecently } = await import('./src/channels/bridge.js');
const { isQuietTime, isRestDateStr } = await import('./src/calendar.js');

let pass = 0, fail = 0;
function check(label, actual, expect) {
  const ok = typeof expect === 'function' ? expect(actual) : String(actual).includes(String(expect));
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (!ok) { console.log(`   got: ${JSON.stringify(String(actual).slice(0, 200))}`); fail++; } else pass++;
}

// ---------- מנת חזרה: לא 150 שאלות בבת אחת ----------
function storeWith(unitCount, qPer, { pace = 1 } = {}) {
  const units = {};
  for (let i = 0; i < unitCount; i++) {
    units[`Ref ${i}`] = {
      refHe: `יחידה ${i}`, learnedAt: '2026-08-20', nextReview: addDays('2026-08-21', i),
      questions: Array.from({ length: qPer }, (_, k) => ({ q: `ש${k}`, ideal: 'ת' })),
      intervalIdx: 0, reviews: 0, scores: [80],
    };
  }
  return {
    id: 'test@local', name: 'בדיקה', units,
    user: { onboarded: true, sendHour: 6, skipShabbat: true, tracks: [{ bookHe: 'משנה זבחים', type: 'mishnah', book: 'Mishnah Zevachim', units: [{ ref: 'Mishnah Zevachim 1', refHe: 'זבחים א' }], index: 0, pace, questions: qPer }] },
    state: { mode: 'idle' }, stats: { streak: 0, lastCompleted: null, totalLearned: unitCount }, daily: null,
  };
}

const big = storeWith(30, 5);
const due30 = Object.entries(big.units).map(([ref, u]) => ({ ref, ...u }));
const dose = pickDose(due30, big);
check('מנה: עד 2 יחידות', dose.chosen.length, (n) => n === 2);
check('מנה: עד 10 שאלות', dose.questions, (n) => n === 10);
check('מנה: הישן ביותר קודם', dose.chosen[0].ref, 'Ref 0');
check('מנה: 28 יחידות נשארו לתור', due30.length - dose.chosen.length, (n) => n === 28);

const heavy = storeWith(3, 12);
const doseHeavy = pickDose(Object.entries(heavy.units).map(([ref, u]) => ({ ref, ...u })), heavy);
check('יחידה ארוכה אינה נחתכת באמצע', doseHeavy.chosen.length, (n) => n === 1);
check('יחידה ארוכה נפתחת במלואה', doseHeavy.questions, (n) => n === 12);

// ---------- הודעת בוקר ותזכורת ----------
const msg = morningMessage(big);
check('הודעת בוקר מזכירה חזרות', msg, 'חזרות');
check('הודעת בוקר מציגה את גודל המנה', msg, 'מנה של');
if (!isRestDateStr(today())) check('אין "שבת שלום" ביום חול', msg, (r) => !r.includes('שבת שלום'));

const noLearn = storeWith(4, 3);
buildDaily(noLearn);
noLearn.daily.assignments = [];
const rem = reminderPayload(noLearn);
check('תזכורת בלי משימת לימוד פתוחה מזכירה חזרות', rem.text, 'חזרות');
check('ויש כפתור חזרה', (rem.buttons || []).map((b) => b.id).join(','), 'חזרה');

// ---------- רצף על לוח תאריכים אמיתי ----------
const mk = (days, skipShabbat = true) => ({
  units: {}, user: { skipShabbat }, stats: { studyDays: days, streak: 0, lastCompleted: null, totalLearned: 0 },
});
// 11.9.2026 ו', 12.9 שבת, 13.9 ב' דר"ה, 14.9 ב'
check('יום טוב אינו שובר רצף', streakInfo(mk(['2026-09-11', '2026-09-14'])).longest, (n) => n === 2);
check('שבת אינה שוברת רצף', streakInfo(mk(['2026-08-28', '2026-08-30', '2026-08-31'])).longest, (n) => n === 3);
check('פער אמיתי שובר רצף', streakInfo(mk(['2026-08-16', '2026-08-20'])).longest, (n) => n === 1);
const real = ['2026-08-16', '2026-08-17', '2026-08-19', '2026-08-20', '2026-08-25', '2026-08-26', '2026-08-28', '2026-08-30', '2026-08-31', '2026-09-06', '2026-09-08'];
check('11 ימי לימוד אמיתיים → שיא 3', streakInfo(mk(real)).longest, (n) => n === 3);
check('11 ימי לימוד אמיתיים → רצף נוכחי 0 (היעדרות)', streakInfo(mk(real)).current, (n) => n === 0);
check('למד היום → רצף נוכחי 1', streakInfo(mk([today()])).current, (n) => n === 1);
check('למד אתמול והיום → רצף 2', streakInfo(mk([addDays(today(), -1), today()])).current, (n) => n === 2);
check('סה"כ ימי לימוד נשמר', streakInfo(mk(real)).total, (n) => n === 11);
check('בלי skipShabbat פער שבת שובר', streakInfo(mk(['2026-08-28', '2026-08-30'], false)).longest, (n) => n === 1);

// ---------- "נזכר בחזרה מאוחרת" ----------
check('בלי חזרות - לא נזכר', isRecalled({ reviewLog: [] }), (v) => v === false);
check('שתי הצלחות אבל בלי פער - לא נזכר', isRecalled({ reviewLog: [{ score: 90, gapDays: 1 }, { score: 95, gapDays: 3 }] }), (v) => v === false);
check('שתי הצלחות ואחת אחרי 8 ימים - נזכר', isRecalled({ reviewLog: [{ score: 90, gapDays: 1 }, { score: 95, gapDays: 8 }] }), (v) => v === true);
check('הצלחה עם עזרה לא נספרת', isRecalled({ reviewLog: [{ score: 90, gapDays: 9, assisted: true }, { score: 95, gapDays: 8 }] }), (v) => v === false);

// ---------- עזרה אינה ידיעה ----------
check('ציון עם עזרה לא מקדם מרווח', effectiveReviewScore(95, true), (n) => n === 79);
check('ציון בלי עזרה נשמר', effectiveReviewScore(95, false), (n) => n === 95);
const u1 = { intervalIdx: 1, reviews: 0 };
afterReview(u1, effectiveReviewScore(95, true));
check('חזרה בעזרת רמז נשארת באותו שלב', u1.intervalIdx, (n) => n === 1);
const u2 = { intervalIdx: 1, reviews: 0 };
afterReview(u2, effectiveReviewScore(95, false));
check('חזרה עצמאית מקדמת שלב', u2.intervalIdx, (n) => n === 2);

// ---------- דירוג: "לא דורג" במקום 0 ----------
check('ציון 0 אמיתי מתקבל', validateGrade({ score: 0, feedback: 'לא נכון' }).score, (n) => n === 0);
check('ציון חסר → לא דורג', (() => { try { validateGrade({ feedback: 'x' }); return 'לא נזרק'; } catch (e) { return e.kind; } })(), 'ungraded');
check('ציון לא מספרי → לא דורג', (() => { try { validateGrade({ score: 'טוב', feedback: 'x' }); return 'לא נזרק'; } catch (e) { return e.kind; } })(), 'ungraded');
check('משוב חסר → לא דורג', (() => { try { validateGrade({ score: 90 }); return 'לא נזרק'; } catch (e) { return e.kind; } })(), 'ungraded');
check('ציון מעל 100 נחתך', validateGrade({ score: 140, feedback: 'x' }).score, (n) => n === 100);

// ---------- מכסת הודעות יזומות ----------
check('ברירת מחדל: הודעה אחת ביום', pingBudget({ user: {} }), (n) => n === 1);
check('0 = כיבוי מוחלט', pingBudget({ user: { remindPerDay: 0 } }), (n) => n === 0);
check('תקרה 6', pingBudget({ user: { remindPerDay: 99 } }), (n) => n === 6);

// ---------- מסירה כפולה ----------
check('הודעה חדשה מטופלת', seenRecently('MSG1'), (v) => v === false);
check('אותה הודעה שוב - מדולגת', seenRecently('MSG1'), (v) => v === true);
check('הודעה אחרת מטופלת', seenRecently('MSG2'), (v) => v === false);

// ---------- לוח שנה ----------
const at = (s) => new Date(s);
check('ב\' דראש השנה = שקט', isQuietTime(at('2026-09-13T09:00:00+03:00')), (v) => v === true);
check('צום גדליה = יום רגיל', isQuietTime(at('2026-09-14T09:00:00+03:00')), (v) => v === false);
check('ערב חג מ-16:00 = שקט', isQuietTime(at('2026-09-11T17:00:00+03:00')), (v) => v === true);
check('ערב חג בבוקר = מותר', isQuietTime(at('2026-09-11T09:00:00+03:00')), (v) => v === false);
check('פסח = שקט', isQuietTime(at('2026-04-02T09:00:00+03:00')), (v) => v === true);
check('חול המועד = יום רגיל', isQuietTime(at('2026-04-05T09:00:00+03:00')), (v) => v === false);

console.log(`\n${pass} עברו, ${fail} נכשלו`);
process.exit(fail ? 1 : 0);
