// מוח השיחה: שאלון פתיחה, משימה יומית, בחנים, חזרות ופקודות.
// הבוט עובד בקבוצה: לכל משתתף רשומה משלו (תכנית, בחנים, חזרות, רצף),
// והוא שותק על פטפוט קבוצתי שאינו מופנה אליו.
import { loadUser, save, today, addDays } from './db.js';
import { buildTrack, TRACK_TYPES, toHebrewNum, BAVLI, MISHNAH, TANACH, SHULCHAN_ARUKH, findShulchanArukhPart } from './curriculum.js';
import { resolveBook, buildBookTrack, resolveAnyRef } from './sefaria-books.js';
import { getHebrewText } from './sefaria.js';
import { generateQuiz, gradeAnswer, answerQuestion } from './ai.js';
import { newUnitSchedule, afterReview, isOwned, dueUnits, INTERVALS, effectiveReviewScore } from './fsrs.js';
import { isRestDay, isRestDateStr, ilDateStr } from './calendar.js';
import { logEvent, internalId } from './events.js';
import { isUngraded } from './ai.js';

const HELP = `📖 *חברותא דיגיטלית - כל מה שאני יודע לעשות*

*איך זה עובד*
כל בוקר אני כותב מה ללמוד היום, אתה לומד מהספר שלך (או מבקש ממני את הטקסט), ואז אני בוחן אותך - ומחזיר אותך לחומר בחזרות מרווחות (מחר, בעוד 3 ימים, שבוע, שבועיים, חודש, 3 חודשים, חצי שנה, שנה).

*הלימוד היומי*
- "היום" - מה המשימה של היום
- "למדתי" - סיימת ללמוד? אשלח בוחן קצר על החומר (לפי סדר התכנית)
- "למדתי מסילת ישרים" - בוחן על מסלול מסוים, באיזה סדר שתרצה
- "דלג" - יום עמוס? מסמן "יום חסד", מתקדם בלוח בלי בוחן והרצף נשמר

*חזרות וזיכרון*
- "חזרה" - מנה קצרה של החזרות שהגיע זמנן (עד 2 יחידות / 10 שאלות), לא הכול בבת אחת
- "המשך חזרות" - מנה נוספת · "סיימתי" - מספיק להיום
- "חזרה תנך" / "חזרה זבחים" - חזרה רק על מסלול, ספר או קטגוריה מסוימת
- "מצב" - כמה למדת, מה בבעלות מלאה, מה נזכר בחזרה מאוחרת, והרצף

*באמצע שאלה*
- "רמז" - חצי מהתשובה (נרשם כתרגול, לא כשליפה עצמאית)
- "לא יודע" - חושף את התשובה וממשיך
- "דווח" - שאלה שגויה או לא ברורה? היא תושהה עד לבדיקה
- "ביטול" - יציאה בלי ציון

*הבנה בסוגיה*
- "שאלה ..." - שאלה על מה שאתה לומד עכשיו (למשל: שאלה מה תירץ אביי?)
  אני עונה רק ממה שכתוב במקור, עם ציון מקום. הלכה למעשה - תמיד לרב.
- "שיעור" - קישורים לשיעורי שמע בקול הלשון על הלימוד של היום
- "טקסט" - הטקסט של הלימוד היומי + קישור לספריא
- "טקסט ברכות ה" / "טקסט מסילת ישרים ג" - טקסט וקישור מכל מקור בספריא

*תכנית והגדרות*
- "הגדרות" - מה מוגדר לי כרגע
- "שנה קצב" - להוסיף או להפחית את כמות הלימוד היומי
- "שנה שאלות" - כמה שאלות בבוחן היומי של כל מסלול
- "שנה רש\"י" / "שנה תוספות" - בגמרא: כמה שאלות על המפרש בבוחן (0 = בלי)
- "הוסף מסלול" - מסלול חדש לצד הקיימים, בלי לאבד כלום
- "הסר מסלול" - הסרת מסלול (הנלמד והחזרות נשמרים)
- "שנה בראשית" / "שנה 2" - עריכת מסלול: החלפת הספר לספר אחר, קצב, שאלות או הסרה (הנלמד והחזרות נשמרים)
- "שנה שעה 7" - שעת המשימה היומית
- "שנה תזכורות 1" - כמה הודעות יזומות ביום (0 = בלי; ברירת מחדל: רק הודעת הבוקר)
- "שנה שבת" - לימוד בשבת או מנוחה
- "שנה תכנית" - בנייה מחדש מאפס (אזהיר אם אתה באמצע)

*מה אפשר ללמוד*
גמרא · משנה · שולחן ערוך · תנ"ך · וכל ספר אחר שיש בספריא
(רמב"ם, מסילת ישרים, חובות הלבבות, תניא, נפש החיים ועוד)

בקבוצה לכל אחד תכנית ומעקב משלו, ואני שותק על שיחה רגילה.
להתחלה כתוב "הרשמה".`;

// עזרה הקשרית באמצע השאלון: איפה אנחנו בתהליך, מה השאלה, ואיך יוצאים.
function onboardingHelp(store) {
  const ob = store.state?.ob;
  if (!ob) return HELP;
  return `📋 אנחנו באמצע ${ob.addMode ? 'הוספת מסלול לתכנית' : 'ההרשמה - בניית תכנית לימוד אישית'}. נשארו רק כמה שאלות קצרות.

השאלה שאני מחכה לה עכשיו:
${stepQuestion(ob)}

לביטול התהליך - כתוב "ביטול".`;
}

const QUESTIONS_PROMPT = 'כמה שאלות יהיו בבוחן היומי על המסלול הזה? (מספר בין 1 ל-10, מומלץ: 3)';

function stepQuestion(ob) {
  if (ob.step === 'trackConfig') {
    const type = ob.queue?.[0];
    if (ob.sub === 'freeBook') return 'איזה ספר תרצה ללמוד? כתוב שם של ספר מספריא (למשל: מסילת ישרים).';
    if (ob.sub === 'freePace') return 'כמה יחידות ליום? (מספר, למשל: 1)';
    if (ob.sub === 'book') return bookQuestion(type);
    if (ob.sub === 'pace') return paceQuestion(type);
    if (ob.sub === 'commentary') return commentaryQuestion();
    if (ob.sub === 'commentaryCount') return `כמה שאלות על ${ob.current?.pendingComm?.[0] === 'tosafot' ? 'תוספות' : 'רש"י'} בכל בוחן? (1-5)`;
    if (ob.sub === 'questions') return QUESTIONS_PROMPT;
  }
  if (ob.step === 'hour') return 'באיזו שעה בבוקר לשלוח את המשימה היומית? (למשל: 7)';
  if (ob.step === 'shabbat') return 'האם לדלג על שבת בלוח הלימוד? (כן/לא)';
  if (ob.step === 'confirm') return 'לאישור והפעלת התכנית - כתוב "אשר". לשינוי - כתוב "שנה תכנית".';
  return tracksQuestion(ob.addMode);
}

// בקבוצה הבוט לא מגיב לכל הודעה. הוא עונה רק כשפונים אליו:
// מילת פתיחה, פקודה מוכרת, או כשהמשתמש באמצע שאלון/בוחן/חזרה.
const START_WORDS = ['הרשמה', 'התחל', 'תלמיד חכם', 'חברותא'];
const COMMANDS = ['עזרה', '?', 'שנה תכנית', 'שנה תכנית בכל זאת', 'היום', 'מצב', 'למדתי', 'חזרה', 'דלג', 'הגדרות', 'שיעור', 'שיעורים', 'טקסט', 'המשך חזרות', 'המשך', 'סיימתי', 'רמז', 'לא יודע', 'דווח'];

// כפתורי פעולה מהירה. ה-id הוא בדיוק הפקודה, כך שלחיצה זהה להקלדה.
// ווצאפ מציג עד 3 כפתורים בהודעה.
const BTN = {
  help: { id: 'עזרה', text: '❓ עזרה' },
  learned: { id: 'למדתי', text: '✅ למדתי' },
  review: { id: 'חזרה', text: '🔁 חזרה' },
  today: { id: 'היום', text: '📖 היום' },
  status: { id: 'מצב', text: '📊 מצב' },
  skip: { id: 'דלג', text: '🕊️ יום חסד' },
  shiur: { id: 'שיעור', text: '🎧 שיעור' },
  more: { id: 'המשך חזרות', text: '🔁 עוד מנה' },
  hint: { id: 'רמז', text: '💡 רמז' },
};

// send מקבל מחרוזת, או אובייקט עם כפתורים. הערוץ מחליט איך לשלוח.
function withButtons(text, buttons) {
  return { text, buttons };
}

function isForBot(store, msg) {
  if (store.state?.mode && store.state.mode !== 'idle') return true; // באמצע תהליך
  if (START_WORDS.includes(msg)) return true;
  if (COMMANDS.includes(msg)) return true;
  if (msg.startsWith('למדתי') || msg.startsWith('שאלה') || msg.startsWith('שנה שעה') || msg.startsWith('שנה שבת')) return true;
  if (msg.startsWith('חזרה ')) return true;
  if (msg.startsWith('טקסט')) return true;
  if (msg.startsWith('שנה קצב') || msg.startsWith('הוסף מסלול') || msg.startsWith('הסר מסלול')) return true;
  if (msg.startsWith('שנה שאלות') || msg.startsWith('שנה רש') || msg.startsWith('שנה תוספות')) return true;
  if (msg.startsWith('שנה תזכורות')) return true;
  if (msg === 'ערוך' || msg === 'ערוך תכנית') return true;
  // "שנה <מסלול>" - עריכת מסלול. עובר רק אם הטקסט באמת מתאים למסלול בתכנית,
  // כדי שפטפוט קבוצתי ("שנה טובה") לא יעיר את הבוט.
  if (msg.startsWith('שנה ') && matchingTracks(store.user?.tracks || [], msg.replace(/^שנה\s+/, '').trim()).length) return true;
  return false;
}

// ============ בניית המשימה היומית ============

export function buildDaily(store) {
  const t = today();
  if (store.daily?.date === t) return store.daily;
  const user = store.user;
  const assignments = [];
  if (user?.onboarded) {
    // יום מנוחה = שבת או יום טוב (עד השדרוג הוכרה רק שבת)
    const rest = isRestDay();
    if (!(user.skipShabbat && rest)) {
      for (const tr of user.tracks) {
        const refs = tr.units.slice(tr.index, tr.index + tr.pace);
        if (refs.length) assignments.push({ track: tr.bookHe, type: tr.type, refs });
      }
    }
  }
  // pings = כמה הודעות יזומות נשלחו היום (הודעת הבוקר נספרת), morningAttempts =
  // כמה ניסיונות שליחה נעשו. שניהם נדרשים כדי לא להציף ולא "לאבד" הודעה שנכשלה.
  store.daily = { date: t, sentMorning: false, morningAttempts: 0, pings: 0, lastPingAt: 0, assignments, completedTracks: [] };
  save();
  return store.daily;
}

// כמה חזרות ממתינות - למתזמן ולהודעות, בלי לחשוף את המבנה הפנימי
export function dueCount(store) {
  return dueUnits(store.units).length;
}

// איחול לפי שעון ישראל - השרת עצמו רץ על שעון אירופה (שעה אחורה)
function greeting() {
  const h = parseInt(
    new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Jerusalem' }).format(new Date()),
    10,
  );
  if (h >= 5 && h < 12) return 'בוקר טוב!';
  if (h >= 12 && h < 17) return 'צהריים טובים!';
  if (h >= 17 && h < 22) return 'ערב טוב!';
  return 'לילה טוב!';
}

// תיאור מקוצר לרצף יחידות: "ראש השנה דפים ב-ד" במקום פירוט כל עמוד בנפרד.
// היחידות מגיעות תמיד כרצף מתוך לוח המסלול, ולכן מספיק לציין ראשונה ואחרונה.
export function refsLabel(refs) {
  const names = refs.map((r) => r.refHe);
  if (names.length <= 1) return names.join(', ');
  const first = names[0], last = names[names.length - 1];
  // גמרא: "<מסכת> דף <X> עמוד <א/ב>"
  const gm = names.map((n) => n.match(/^(.+?) דף (\S+) עמוד ([אב])$/));
  if (gm.every(Boolean) && new Set(gm.map((m) => m[1])).size === 1) {
    const [book, f, l] = [gm[0][1], gm[0], gm[gm.length - 1]];
    if (f[2] === l[2]) return `${book} דף ${f[2]} עמוד ${f[3]}-${l[3]}`;
    if (f[3] === 'א' && l[3] === 'ב') return `${book} דפים ${f[2]}-${l[2]}`;
    return `${book} דף ${f[2]} עמוד ${f[3]} עד דף ${l[2]} עמוד ${l[3]}`;
  }
  // פרקים/סימנים: "<ספר> פרק <X>" / "<ספר> סימן <X>"
  const cm = names.map((n) => n.match(/^(.+?) (פרק|סימן) (\S+)$/));
  if (cm.every(Boolean) && new Set(cm.map((m) => m[1] + m[2])).size === 1) {
    return `${cm[0][1]} ${cm[0][2] === 'פרק' ? 'פרקים' : 'סימנים'} ${cm[0][3]}-${cm[cm.length - 1][3]}`;
  }
  // כללי: אותו שם ספר, רק המזהה האחרון משתנה (למשל "תהלים ג" עד "תהלים ה")
  const fParts = first.split(' '), lParts = last.split(' ');
  const prefix = fParts.slice(0, -1).join(' ');
  if (fParts.length === lParts.length && prefix && prefix === lParts.slice(0, -1).join(' ') &&
      names.every((n) => n.startsWith(prefix + ' '))) {
    return `${prefix} ${fParts[fParts.length - 1]}-${lParts[lParts.length - 1]}`;
  }
  return names.join(', ');
}

export function morningMessage(store) {
  const daily = buildDaily(store);
  const due = dueUnits(store.units).length;
  const restToday = isRestDay() && store.user?.skipShabbat;
  const finished = (store.user?.tracks || []).every((t) => t.index >= t.units.length);
  if (!daily.assignments.length) {
    // עד השדרוג כל יום בלי משימה קיבל "שבת שלום", גם באמצע השבוע
    const head = restToday ? 'שבת שלום!' : greeting();
    const body = restToday ? 'היום מנוחה בלוח.'
      : finished ? 'סיימת את כל מה שבתכנית - מזל טוב! ("הוסף מסלול" לספר הבא)'
        : 'היום אין לימוד חדש בלוח.';
    return due
      ? `${head} ${body} ממתינות ${due} חזרות - ${doseLabel(store)}. כתוב "חזרה" כשנוח לך.`
      : `${head} ${body} נתראה מחר בעז"ה.`;
  }
  let msg = `${greeting()} המשימה להיום לפי התכנית שלך:\n`;
  for (const a of daily.assignments) {
    msg += `\n- ${refsLabel(a.refs)}`;
  }
  if (due) msg += `\n\n🔁 ממתינות ${due} חזרות. "חזרה" ${doseLabel(store)} - לא הכול בבת אחת.`;
  const st = streakInfo(store);
  if (st.current > 1) msg += `\nרצף נוכחי: ${st.current} ימי לימוד - חזק!`;
  msg += '\n\nכשתסיים ללמוד מהספר - כתוב לי "למדתי" ואבחן אותך.';
  return msg;
}

// כמה באמת ייפתח ב"חזרה" - כדי שהמספר הגדול לא ירתיע
function doseLabel(store) {
  const due = dueUnits(store.units);
  if (!due.length) return '';
  const { chosen, questions } = pickDose(due, store);
  return `פותח מנה של ${chosen.length === 1 ? 'יחידה אחת' : `${chosen.length} יחידות`} · ${questions} שאלות`;
}

// תזכורת חוזרת (3 שעות אחרי הפעילות האחרונה), מותאמת להתקדמות של היום:
// מי שכבר השלים חלק מהמסלולים מקבל שבח על מה שנעשה ומה בדיוק נשאר.
export function reminderPayload(store) {
  const daily = store.daily;
  const done = daily.assignments.filter((a) => daily.completedTracks.includes(a.track));
  const open = daily.assignments.filter((a) => !daily.completedTracks.includes(a.track));
  const due = dueUnits(store.units).length;
  // אין משימת לימוד פתוחה אבל יש חזרות: עד השדרוג לא נשלחה כאן שום תזכורת,
  // ולכן 30 יחידות נשארו בפיגור בלי שאיש הזכיר אותן אפילו פעם אחת.
  if (!open.length) {
    if (!due) return withButtons('סיימת את הלימוד של היום. כל הכבוד! 👏', [BTN.status, BTN.help]);
    return withButtons(
      `סיימת את הלימוד של היום 👏\n🔁 ממתינות ${due} חזרות - ${doseLabel(store)}. כתוב "חזרה".`,
      [BTN.review, BTN.status, BTN.help],
    );
  }
  let text = done.length
    ? `כל הכבוד - השלמת היום את ${done.map((a) => a.track).join(', ')}! 👏\nנשאר עוד: ${open.map((a) => refsLabel(a.refs)).join(' · ')}\nכשתלמד - כתוב "למדתי", ואם היום עמוס - "דלג" ישלים את השאר בלי בוחן.`
    : `תזכורת ידידותית: עוד לא סימנת "למדתי" היום (${open.map((a) => a.track).join(', ')}). גם 10 דקות שוות עולם - ואם היום קשה, כתוב "דלג" לשמירת הרצף.`;
  if (due) text += `\n🔁 וממתינות ${due} חזרות - ${doseLabel(store)}.`;
  return withButtons(text, due ? [BTN.learned, BTN.review, BTN.help] : [BTN.learned, BTN.skip, BTN.help]);
}

// הודעת הבוקר עם כפתורי הפעולות שרלוונטיות עכשיו
export function morningPayload(store) {
  const text = morningMessage(store);
  const due = dueUnits(store.units).length;
  const buttons = [BTN.learned, BTN.shiur];
  if (due) buttons.push(BTN.review);
  buttons.push(BTN.help);
  return withButtons(text, buttons);
}

// ============ שיעורי קול הלשון ============
// קישור עמוק לתוצאות חיפוש באתר קול הלשון על יחידות הלימוד של היום.
// הפורמט חולץ מהראוטר של האתר עצמו: /he/regularSite/searchResults/<שאילתה>

const KHL_BASE = 'https://www.kolhalashon.com/he/regularSite/searchResults/';

// שאילתת חיפוש ליחידה: בגמרא שיעור מכסה דף שלם - מסירים את העמוד
// ומוסיפים "מסכת" לחידוד; בשאר הסוגים שם היחידה הוא שאילתה טובה כמו שהוא.
function shiurQuery(type, refHe) {
  if (type === 'gemara') return `מסכת ${refHe.replace(/ עמוד [אב]$/, '')}`;
  return refHe;
}

function shiurimMessage(store) {
  const daily = buildDaily(store);
  if (!daily.assignments.length) {
    return 'היום אין לימוד חדש בלוח, אז אין שיעורים לשלוח. נתראה מחר בעז"ה!';
  }
  let out = '🎧 שיעורי שמע מקול הלשון על הלימוד של היום:\n';
  for (const a of daily.assignments) {
    const queries = [...new Set(a.refs.map((r) => shiurQuery(a.type, r.refHe)))];
    for (const q of queries) {
      out += `\n▪️ ${q}:\n${KHL_BASE}${encodeURIComponent(q)}\n`;
    }
  }
  out += '\nהקישור פותח את תוצאות החיפוש באתר - בחר את הרב והשיעור שמתאימים לך.';
  return out;
}

// ============ טקסט המקור ("טקסט") ============
// חריג מכוון לעיקרון "לומדים מהספרים": לפי בקשה מפורשת שולחים את הטקסט
// עצמו + קישור לספריא - ללימוד היומי או לכל מקור חופשי.

const TEXT_CAP = 3000; // הודעת ווצאפ נוחה לקריאה; ההמשך תמיד בקישור

// קישור לספריא: רווחים בשם הספר -> קו תחתון, החלק המספרי מופרד בנקודה
// ("Mishnah Berakhot 3" -> "Mishnah_Berakhot.3"). ספריא ממילא מנרמלת וריאציות.
function sefariaLink(ref) {
  const parts = String(ref).trim().split(' ');
  const last = parts[parts.length - 1];
  const path = /^\d/.test(last) && parts.length > 1
    ? parts.slice(0, -1).join('_') + '.' + last
    : parts.join('_');
  return `https://www.sefaria.org.il/${encodeURIComponent(path)}?lang=he`;
}

async function sendUnitText(unit, send) {
  const link = sefariaLink(unit.ref);
  let text;
  try {
    text = await getHebrewText(unit.ref);
  } catch {
    return send(`לא הצלחתי להביא את הטקסט של ${unit.refHe} מספריא כרגע, אבל הקישור עובד:\n${link}`);
  }
  const cut = text.length > TEXT_CAP ? text.slice(0, TEXT_CAP) + '\n[...ההמשך בקישור]' : text;
  return send(`📜 *${unit.refHe}*\n\n${cut}\n\n🔗 ${link}`);
}

async function sendSourceText(store, arg, send) {
  // בלי נושא - הטקסט של הלימוד היומי
  if (!arg) {
    const daily = buildDaily(store);
    const units = daily.assignments.flatMap((a) => a.refs);
    if (!units.length) {
      return send('היום אין לימוד חדש בלוח. אפשר לבקש טקסט מכל מקור - למשל: "טקסט ברכות ה" או "טקסט מסילת ישרים ג".');
    }
    for (const u of units.slice(0, 4)) await sendUnitText(u, send);
    if (units.length > 4) await send(`(שלחתי את 4 היחידות הראשונות מתוך ${units.length} - לשאר בקש לפי שם)`);
    return;
  }
  // עם נושא - כל מקור בספריא: "טקסט ברכות ה", "טקסט תהלים כג", "טקסט תניא"
  let r;
  try {
    r = await resolveAnyRef(arg);
  } catch {
    return send('ספריא לא זמינה כרגע. נסה שוב בעוד רגע.');
  }
  if (r.suggestions?.length) {
    return send(`לא זיהיתי במדויק את "${arg}". אולי התכוונת ל:\n${r.suggestions.map((s) => `- ${s}`).join('\n')}`);
  }
  if (!r.ref) {
    return send(`לא מצאתי את "${arg}" בספריא. נסה שם מדויק יותר, למשל: "טקסט ברכות ה" או "טקסט משנה אבות ב".`);
  }
  if (r.isBook) {
    return send(`"${r.heRef}" הוא ספר שלם - הנה הקישור אליו:\n${sefariaLink(r.ref)}\n\nלטקסט של פרק מסוים כתוב גם את הפרק, למשל: "טקסט ${arg} א".`);
  }
  return sendUnitText({ ref: r.ref, refHe: r.heRef }, send);
}

// רענון משימת היום אחרי שינוי בתכנית (קצב/הוספה/הסרה) - בלי לאבד את
// מה שכבר הושלם היום ובלי לגעת בהתקדמות המסלולים.
function refreshDaily(store) {
  const d = store.daily;
  if (!d || d.date !== today()) {
    store.daily = null;
    return;
  }
  const isShabbat = new Date().getDay() === 6;
  d.assignments = [];
  if (!(store.user.skipShabbat && isShabbat)) {
    for (const tr of store.user.tracks) {
      const refs = tr.units.slice(tr.index, tr.index + tr.pace);
      if (refs.length) d.assignments.push({ track: tr.bookHe, type: tr.type, refs });
    }
  }
  d.completedTracks = d.completedTracks.filter((t) => store.user.tracks.some((x) => x.bookHe === t));
}

// איתור מסלול לפי מספר סידורי או שם (חלקי). מחזיר null אם אין התאמה חד-משמעית.
function findTrack(tracks, token) {
  if (/^\d+$/.test(token)) {
    const n = parseInt(token, 10);
    return n >= 1 && n <= tracks.length ? tracks[n - 1] : null;
  }
  const matches = tracks.filter((t) => t.bookHe.includes(token));
  return matches.length === 1 ? matches[0] : null;
}

// ============ הטיפול המרכזי בהודעה נכנסת ============

export async function handleMessage(userId, userName, text, send) {
  const store = loadUser(userId, userName);
  const msg = (text || '').trim();

  // שסתום קבוצתי: הודעה שאינה מופנית לבוט - שתיקה מוחלטת.
  if (!isForBot(store, msg)) return;

  // כל אינטראקציה עם הבוט דוחה את התזכורת הבאה: "תזכורת" פירושה 3 שעות
  // של שקט מאז הפעילות האחרונה, לא 3 שעות מהתזכורת הקודמת.
  if (store.daily?.date === today()) {
    store.daily.lastPingAt = Date.now();
    save();
  }

  try {
    // שאלון פתיחה. "עזרה" ו"ביטול" עובדים גם באמצעו - שאף אחד לא יהיה תקוע.
    if (!store.user?.onboarded || store.state.mode === 'onboarding') {
      if (msg === 'עזרה' || msg === '?') {
        return store.state.ob
          ? send(onboardingHelp(store))
          : send(withButtons(HELP, [{ id: 'הרשמה', text: '🚀 הרשמה' }]));
      }
      if (msg === 'ביטול' && store.state.ob && !store.state.ob.addMode) {
        store.state = { mode: 'idle' };
        save();
        return send('ההרשמה בוטלה. כשתרצה להתחיל - כתוב "הרשמה".');
      }
      // משתמש לא רשום ששלח פקודה רגילה - מסבירים במקום לזרוק אותו לשאלון
      if (!store.state.ob && !START_WORDS.includes(msg)) {
        return send(withButtons(
          'היי! אני חברותא דיגיטלית, אבל עוד לא נרשמת לתכנית לימוד, אז אין לי מה להציג לך.\nלהתחלה כתוב "הרשמה", ולהסבר על מה שאני יודע לעשות - "עזרה".',
          [{ id: 'הרשמה', text: '🚀 הרשמה' }, BTN.help],
        ));
      }
      return await handleOnboarding(store, msg, send);
    }
    // באמצע בוחן או חזרה - "עזרה" מסבירה איפה אנחנו, "ביטול" יוצא, וכל השאר תשובה
    if (store.state.mode === 'quiz' || store.state.mode === 'review') {
      if (msg === 'עזרה' || msg === '?') {
        if (store.state.mode === 'quiz') {
          const q = store.state.quiz;
          return send(`📝 אנחנו באמצע הבוחן היומי על ${q.track} (שאלה ${q.qIdx + 1} מתוך ${q.questions.length}). כל הודעה שתכתוב עכשיו נבדקת כתשובה לשאלה.

השאלה: ${q.questions[q.qIdx].q}

ליציאה מהבוחן בלי ציון - כתוב "ביטול".`);
        }
        const rv = store.state.review;
        const rvUnit = store.units[rv.ref];
        const rvQ = rvUnit?.questions?.[rv.qIdx];
        return send(`🔁 אנחנו באמצע חזרה על ${rvUnit?.refHe || 'החומר'} (שאלה ${rv.qIdx + 1} מתוך ${rvUnit?.questions?.length || '?'}). כל הודעה שתכתוב עכשיו נבדקת כתשובה לשאלה.

השאלה: ${rvQ?.q || ''}

ליציאה בלי ציון - כתוב "ביטול".`);
      }
      if (msg === 'ביטול' || msg === 'בטל בוחן' || msg === 'בטל חזרה') {
        store.state = { mode: 'idle' };
        save();
        return send(withButtons('יצאנו בלי ציון. אפשר לחזור מתי שתרצה.', [BTN.learned, BTN.review, BTN.help]));
      }
    }
    if (store.state.mode === 'quiz') return await handleQuizAnswer(store, msg, send);
    if (store.state.mode === 'review') return await handleReviewAnswer(store, msg, send);
    if (store.state.mode === 'editTrack') return await handleEditTrack(store, msg, send);

    // פקודות
    if (msg === 'עזרה' || msg === '?') return send(HELP);
    if (msg === 'הגדרות') return send(settingsMessage(store));
    if (msg.startsWith('שנה שעה')) return setSendHour(store, msg, send);
    if (msg.startsWith('שנה שבת')) return toggleShabbat(store, send);
    if (msg.startsWith('שנה קצב')) return paceChange(store, msg, send);
    if (msg.startsWith('שנה שאלות')) return quizCountChange(store, msg, send);
    if (msg.startsWith('שנה רש') || msg.startsWith('שנה תוספות')) return setCommentary(store, msg, send);
    if (msg === 'הוסף מסלול') return addTrackStart(store, send);
    if (msg.startsWith('הסר מסלול')) return removeTrack(store, msg, send);
    if (msg === 'שנה תכנית') return planChange(store, false, send);
    if (msg === 'שנה תכנית בכל זאת') return planChange(store, true, send);
    if (msg === 'ערוך' || msg === 'ערוך תכנית') return editList(store, send);
    if (msg.startsWith('שנה ')) return editTrackStart(store, msg.replace(/^שנה\s+/, ''), send);
    if (msg === 'היום') return send(morningPayload(store));
    if (msg === 'שיעור' || msg === 'שיעורים') return send(withButtons(shiurimMessage(store), [BTN.learned, BTN.help]));
    if (msg === 'טקסט' || msg.startsWith('טקסט ')) return await sendSourceText(store, msg.replace(/^טקסט\s*/, ''), send);
    if (msg === 'מצב') return send(statusMessage(store));
    if (msg === 'למדתי' || msg.startsWith('למדתי')) return await startQuiz(store, send, msg.replace(/^למדתי\s*/, ''));
    if (msg === 'חזרה' || msg.startsWith('חזרה ')) return await startReview(store, send, msg.replace(/^חזרה\s*/, ''));
    if (msg === 'המשך חזרות' || msg === 'המשך') return await startReview(store, send, store.lastReviewFilter || '');
    if (msg === 'סיימתי') {
      const due = dueUnits(store.units).length;
      return send(withButtons(
        `כל הכבוד על מה שלמדת היום! 👏${due ? `\nנשארו ${due} חזרות - הן ימתינו לך.` : ''}`,
        [BTN.status, BTN.help],
      ));
    }
    if (msg === 'רמז' || msg === 'לא יודע') return send('"רמז" ו"לא יודע" עובדים בתוך שאלה. "למדתי" לבוחן היומי, "חזרה" לחזרות.');
    if (msg === 'דווח' || msg.startsWith('דווח ')) return send('"דווח" מסמן שאלה בעייתית בזמן שהיא נשאלת. כתוב אותו כשאתה באמצע בוחן או חזרה.');
    if (msg.startsWith('שנה תזכורות')) return setReminders(store, msg, send);
    if (msg === 'דלג') {
      const daily = buildDaily(store);
      daily.completedTracks = daily.assignments.map((a) => a.track);
      for (const tr of store.user.tracks) tr.index += Math.min(tr.pace, tr.units.length - tr.index);
      touchStreak(store);
      save();
      return send(withButtons('סומן "יום חסד" - התקדמנו בלוח בלי בוחן. מחר חוזרים למסלול המלא!', [BTN.status, BTN.help]));
    }
    if (msg.startsWith('שאלה')) return await handleQA(store, msg.replace(/^שאלה\s*/, ''), send);
    // כבר רשום ומנסה להירשם שוב
    if (START_WORDS.includes(msg)) return send('אתה כבר רשום ובדרך!\n\n' + statusMessage(store));

    return send(withButtons('לא הבנתי מה ביקשת.', [BTN.help, BTN.today, BTN.status]));
  } catch (err) {
    console.error(err);
    return send(`אופס, משהו השתבש: ${err.message}\nנסה שוב, ואם זה חוזר - כתוב "עזרה".`);
  }
}

// ============ שאלון הפתיחה ============

function trackOptions() {
  return Object.entries(TRACK_TYPES).map(([n, t]) => `${n}. ${t.label}`).join('\n');
}

function tracksQuestion(addMode = false) {
  const opts = trackOptions();
  const head = addMode
    ? 'איזה מסלול להוסיף? (אפשר כמה, למשל: 1 2)'
    : `ברוך הבא לחברותא הדיגיטלית שלך!
נבנה יחד את תכנית הלימוד. אילו מסלולים תרצה? (אפשר כמה, למשל: 1 2 3)`;
  return `${head}

${opts}`;
}

async function handleOnboarding(store, msg, send) {
  if (!store.state.ob) store.state.ob = { step: 'tracks' };
  const ob = store.state.ob;
  store.state.mode = 'onboarding';

  // "הוסף מסלול" אפשר לבטל באמצע - התכנית הקיימת לא נפגעת
  if (ob.addMode && msg === 'ביטול') {
    store.state = { mode: 'idle' };
    save();
    return send('בוטל - התכנית נשארה כמו שהיא.');
  }

  if (ob.step === 'tracks') {
    if (!msg || START_WORDS.includes(msg)) {
      save();
      return send(tracksQuestion(ob.addMode));
    }
    const nums = [...new Set(msg.match(/[1-5]/g) || [])];
    if (!nums.length) {
      return send(`לא זיהיתי בחירת מסלול. אנחנו בשלב בניית תכנית הלימוד - בחר מסלול לפי מספר (אפשר כמה, למשל: 1 3):

${trackOptions()}

לביטול התהליך - כתוב "ביטול".`);
    }
    ob.queue = nums.map((n) => TRACK_TYPES[n].type);
    ob.tracks = [];
    ob.step = 'trackConfig';
    return askNextTrack(ob, send);
  }

  if (ob.step === 'trackConfig') {
    const type = ob.queue[0];

    // ספר חופשי: השם נפתר מול ספריא, ואם הוא לא חד-משמעי מציעים אפשרויות.
    if (ob.sub === 'freeBook') {
      await send(`מחפש את "${msg}" בספריא...`);
      let resolved;
      try {
        resolved = await resolveBook(msg);
      } catch {
        return send('ספריא לא זמינה כרגע. נסה שוב בעוד רגע.');
      }
      if (!resolved.title) {
        const s = resolved.suggestions;
        return send(s.length
          ? `לא מצאתי בדיוק "${msg}". התכוונת לאחד מאלה?\n${s.map((x) => `- ${x}`).join('\n')}`
          : `לא מצאתי ספר בשם "${msg}" בספריא. נסה שם אחר (למשל: מסילת ישרים, הלכות תשובה, תניא).`);
      }
      let built;
      try {
        built = await buildBookTrack(resolved.title);
      } catch {
        built = null;
      }
      if (!built) return send(`מצאתי את "${resolved.heTitle}" אבל לא הצלחתי לבנות ממנו לוח לימוד. נסה ספר אחר.`);
      ob.current = { type, bookNameHe: msg, built };
      ob.sub = 'freePace';
      save();
      return send(`מצוין - ${built.bookHe} (${built.units.length} יחידות).
כמה יחידות ליום? (מספר, למשל: 1)`);
    }
    if (ob.sub === 'freePace') {
      const n = parseInt(msg, 10);
      const max = ob.current.built.units.length;
      if (!n || n < 1) return send('כתוב מספר, למשל: 1');
      if (n > max) return send(`זה יותר מכל הספר (${max} יחידות). כתוב מספר קטן יותר.`);
      ob.current.pace = n;
      return askQuestionsCount(ob, send);
    }

    if (ob.sub === 'book') {
      let built = buildTrack(type, msg);
      if (!built) {
        // התאמה חלקית: "שמואל" - מועמד יחיד נבחר, כמה מועמדים מוצעים לבחירה
        const cands = structuredCandidates(msg).filter((c) => c.type === type);
        if (cands.length === 1) built = buildTrack(type, cands[0].he);
        else if (cands.length > 1) {
          return send(`יש כמה אפשרויות ל"${msg}" - כתוב את השם המלא:\n${cands.map((c) => `- ${c.he}`).join('\n')}`);
        }
      }
      if (!built) return send(`לא זיהיתי "${msg}". כתוב שם מדויק, למשל: ${type === 'tanach' ? 'בראשית' : type === 'halacha' ? 'אורח חיים' : 'ברכות'}`);
      ob.current = { type, bookNameHe: msg };
      if (type === 'tanach') {
        ob.current.pace = 1;
        return askQuestionsCount(ob, send);
      }
      ob.sub = 'pace';
      save();
      return send(paceQuestion(type));
    }
    if (ob.sub === 'pace') {
      const pace = parsePace(type, msg);
      if (!pace) return send(paceError(type));
      // גמרא: הקצב נמדד בעמודים, והתקרה היחידה היא אורך המסכת עצמה.
      const max = type === 'gemara' ? trackSize(ob) : type === 'mishnah' ? 4 : 3;
      if (pace > max) {
        return send(type === 'gemara'
          ? `זה יותר מכל המסכת (${max} עמודים). כתוב מספר קטן יותר.`
          : `כתוב מספר בין 1 ל-${max}`);
      }
      ob.current.pace = pace;
      // בגמרא: אפשרות להיבחן גם על רש"י ותוספות
      if (type === 'gemara') {
        ob.sub = 'commentary';
        save();
        return send(commentaryQuestion());
      }
      return askQuestionsCount(ob, send);
    }
    if (ob.sub === 'commentary') {
      const n = parseInt(msg, 10);
      if (!n || n < 1 || n > 4) return send(`כתוב מספר בין 1 ל-4.\n\n${commentaryQuestion()}`);
      ob.current.rashi = 0;
      ob.current.tosafot = 0;
      ob.current.pendingComm = [
        ...(n === 2 || n === 4 ? ['rashi'] : []),
        ...(n === 3 || n === 4 ? ['tosafot'] : []),
      ];
      return askNextCommentaryCount(ob, send);
    }
    if (ob.sub === 'commentaryCount') {
      const n = parseInt(msg, 10);
      const label = ob.current.pendingComm[0] === 'rashi' ? 'רש"י' : 'תוספות';
      if (!n || n < 1 || n > 5) return send(`כמה שאלות על ${label} בכל בוחן? כתוב מספר בין 1 ל-5.`);
      ob.current[ob.current.pendingComm.shift()] = n;
      return askNextCommentaryCount(ob, send);
    }
    if (ob.sub === 'questions') {
      const n = parseInt(msg, 10);
      if (!n || n < 1 || n > 10) return send(`כתוב מספר בין 1 ל-10, למשל: 3.\n(זו כמות השאלות שאשאל אותך בבוחן היומי על המסלול הזה)`);
      ob.current.questions = n;
      finishTrack(ob);
      return nextTrackOrDone(store, ob, send);
    }
  }

  if (ob.step === 'hour') {
    const h = parseInt(msg, 10);
    if (isNaN(h) || h < 4 || h > 23) return send('כתוב שעה בין 4 ל-23, למשל: 7');
    ob.sendHour = h;
    ob.step = 'shabbat';
    save();
    return send('האם לדלג על שבת בלוח הלימוד? (כן/לא)');
  }

  if (ob.step === 'shabbat') {
    if (msg !== 'כן' && msg !== 'לא') return send('כתוב "כן" או "לא"');
    ob.skipShabbat = msg === 'כן';
    ob.step = 'confirm';
    save();
    const summary = ob.tracks
      .map((t) => `- ${t.bookHe}: ${paceLabel(t)} · ${quizLabel(t)} (סה"כ ${t.units.length} יחידות)`)
      .join('\n');
    return send(`הנה התכנית שלך:
${summary}
- הודעת משימה יומית בשעה ${ob.sendHour}:00
- שבת: ${ob.skipShabbat ? 'מנוחה בלוח' : 'לימוד רגיל'}

לאישור והפעלת האוטומציה - כתוב "אשר". לשינוי - כתוב "שנה תכנית".`);
  }

  if (ob.step === 'confirm') {
    if (msg !== 'אשר') return send('כתוב "אשר" להפעלה, או "שנה תכנית" להתחלה מחדש.');
    store.user = {
      onboarded: true,
      tracks: ob.tracks,
      sendHour: ob.sendHour,
      skipShabbat: ob.skipShabbat,
      createdAt: today(),
    };
    store.state = { mode: 'idle' };
    store.daily = null;
    save();
    await send('התכנית הופעלה! מעכשיו אשלח לך כל בוקר את המשימה היומית.');
    return send(morningPayload(store));
  }

  save();
  return send(tracksQuestion(ob.addMode));
}

function bookQuestion(type) {
  if (type === 'gemara') return 'איזו מסכת גמרא נלמד? (למשל: ברכות)';
  if (type === 'mishnah') return 'איזו מסכת משנה נלמד? (למשל: ברכות)';
  if (type === 'tanach') return 'מאיזה ספר בתנ"ך להתחיל? (למשל: בראשית)';
  if (type === 'halacha') return `איזה חלק בשולחן ערוך נלמד?
${SHULCHAN_ARUKH.map(([he, , n]) => `- ${he} (${n} סימנים)`).join('\n')}
(כתוב למשל: אורח חיים)`;
  return '';
}

function paceQuestion(type) {
  if (type === 'gemara') {
    return `כמה גמרא ליום? אין הגבלה - כתוב כמה שתרצה:
- "עמוד" או "1" - עמוד ליום
- "דף" או "2" - דף שלם ליום
- "3 דפים" או "6" - שלושה דפים ליום`;
  }
  if (type === 'mishnah') return 'כמה פרקי משנה ליום? (1-4)';
  if (type === 'halacha') return 'כמה סימנים ליום בשולחן ערוך? (1-3)';
  return '';
}

// גמרא נמדדת בעמודים. מקבלים גם ניסוח בדפים ("3 דפים" = 6 עמודים) וגם
// מילה בלי מספר ("דף" = 2, "עמוד" = 1), כי ככה אנשים מדברים.
function parsePace(type, msg) {
  const txt = (msg || '').trim();
  const num = parseInt((txt.match(/\d+/) || [])[0], 10);
  if (type !== 'gemara') return num >= 1 ? num : 0;
  const isDaf = /דף|דפים/.test(txt);
  const isAmud = /עמוד|עמודים/.test(txt);
  if (isNaN(num)) {
    if (isDaf) return 2;
    if (isAmud) return 1;
    return 0;
  }
  if (num < 1) return 0;
  return isDaf ? num * 2 : num;
}

function paceError(type) {
  if (type === 'gemara') return 'לא הבנתי את הקצב. כתוב מספר, למשל: 1 · דף · 3 דפים';
  if (type === 'mishnah') return 'כתוב מספר בין 1 ל-4';
  return 'כתוב מספר בין 1 ל-3';
}

// מספר היחידות (עמודים) במסכת שנבחרה - התקרה הטבעית לקצב
function trackSize(ob) {
  const built = buildTrack(ob.current.type, ob.current.bookNameHe || '');
  return built ? built.units.length : 1;
}

// תיאור הקצב בשפה של הלומד ("2 דפים ליום" ולא "4 יחידות ביום")
function paceLabel(track) {
  const p = track.pace;
  if (track.type === 'gemara') {
    if (p === 1) return 'עמוד ליום';
    if (p === 2) return 'דף ליום';
    if (p % 2 === 0) return `${p / 2} דפים ליום`;
    return `${p} עמודים ליום`;
  }
  if (track.type === 'mishnah') return p === 1 ? 'פרק ליום' : `${p} פרקים ליום`;
  if (track.type === 'halacha') return p === 1 ? 'סימן ליום' : `${p} סימנים ליום`;
  if (track.type === 'free') return p === 1 ? 'יחידה ליום' : `${p} יחידות ליום`;
  return p === 1 ? 'פרק ליום' : `${p} פרקים ליום`;
}

// שאלת המפרשים במסלול גמרא - לכל מפרש שנבחר שואלים גם כמה שאלות עליו
function commentaryQuestion() {
  return `בגמרא אפשר להיבחן גם על המפרשים. על מה לבחון אותך?
1. רק על הגמרא
2. גם על רש"י
3. גם על תוספות
4. גם על רש"י וגם על תוספות
(מיד אחר כך תבחר כמה שאלות על כל מפרש)`;
}

// מספר שאלות על מפרש: תומך גם ברשומות ישנות שבהן השדה היה כן/לא
function commentaryCount(v) {
  return typeof v === 'number' ? v : v ? 1 : 0;
}

// שאלת "כמה שאלות" עבור המפרש הבא בתור שנבחר בשאלון
function askNextCommentaryCount(ob, send) {
  if (!ob.current.pendingComm?.length) return askQuestionsCount(ob, send);
  ob.sub = 'commentaryCount';
  save();
  const label = ob.current.pendingComm[0] === 'rashi' ? 'רש"י' : 'תוספות';
  return send(`כמה שאלות על ${label} בכל בוחן? (1-5)`);
}

function askQuestionsCount(ob, send) {
  ob.sub = 'questions';
  save();
  return send(QUESTIONS_PROMPT);
}

// תיאור הבוחן של מסלול: כמה שאלות, וכמה על כל מפרש (בגמרא)
function quizLabel(t) {
  let s = `${t.questions || 3} שאלות בבוחן`;
  for (const [field, label] of [['rashi', 'רש"י'], ['tosafot', 'תוספות']]) {
    const n = commentaryCount(t[field]);
    if (n) s += n === 1 ? ` + שאלה על ${label}` : ` + ${n} שאלות על ${label}`;
  }
  return s;
}

function finishTrack(ob) {
  // ספר חופשי כבר נבנה מול ספריא בשלב הקודם; שאר המסלולים נבנים מהלוחות.
  const c = ob.current;
  const built = c.built || buildTrack(c.type, c.bookNameHe || '');
  ob.tracks.push({
    type: c.type, ...built, pace: c.pace, index: 0,
    questions: c.questions || 3, rashi: c.rashi || 0, tosafot: c.tosafot || 0,
  });
  ob.queue.shift();
  ob.current = null;
}

// שאלת הפתיחה למסלול הבא בתור: הלכה בוחרת חלק בשולחן ערוך,
// וספר חופשי הולך לחיפוש בספריא במקום לרשימה סגורה.
function askNextTrack(ob, send) {
  const type = ob.queue[0];
  if (type === 'free') {
    ob.sub = 'freeBook';
    save();
    return send(`איזה ספר תרצה ללמוד? אפשר כל ספר שיש בספריא - כתוב את השם בעברית.

לדוגמה: מסילת ישרים · חובות הלבבות · הלכות תשובה · תניא · שמונה פרקים · אורות התשובה · נפש החיים`);
  }
  ob.sub = 'book';
  save();
  return send(bookQuestion(type));
}

function nextTrackOrDone(store, ob, send) {
  if (ob.queue.length) return askNextTrack(ob, send);

  // במצב הוספה: המסלולים החדשים מצטרפים לתכנית הקיימת, בלי שעה/שבת/אישור
  if (ob.addMode) {
    const existing = new Set(store.user.tracks.map((t) => t.bookHe));
    const fresh = ob.tracks.filter((t) => !existing.has(t.bookHe));
    const skipped = ob.tracks.filter((t) => existing.has(t.bookHe));
    store.user.tracks.push(...fresh);
    store.state = { mode: 'idle' };
    refreshDaily(store);
    save();
    let out = fresh.length
      ? `נוסף לתכנית:\n${fresh.map((t) => `- ${t.bookHe}: ${paceLabel(t)} · ${quizLabel(t)}`).join('\n')}\n\nהמסלול נכנס למשימה היומית כבר מהיום, וכל ההתקדמות הקודמת נשמרה.`
      : '';
    if (skipped.length) out += `${out ? '\n\n' : ''}${skipped.map((t) => t.bookHe).join(', ')} כבר בתכנית - לא נוסף שוב.`;
    return send(withButtons(out, [BTN.today, BTN.status, BTN.help]));
  }

  ob.step = 'hour';
  save();
  return send('מצוין! באיזו שעה בבוקר לשלוח את המשימה היומית? (למשל: 7)');
}

// ============ בוחן יומי ============

// התאמת שם מסלול חופשי ("מסילת ישרים", "גמרא") לשם בתכנית - סלחני לגרשיים, קידומות ורווחים
function trackMatcher(query) {
  const norm = (s) => s.replace(/["'״׳]/g, '').replace(/\s+/g, ' ').trim();
  const q = norm(query);
  return (name) => norm(name).includes(q) || q.includes(norm(name));
}

// התאמה לשם היחידה עצמה ("שמואל א", "בראשית ג") - חשוב במסלול תנ"ך, ששמו
// נשאר "תנ"ך (מבראשית)" גם כשהלימוד כבר הגיע לספרים הבאים. מילות מבנה
// (פרק/דף/עמוד/סימן) מוסרות משני הצדדים, כך ש"שמואל א א" תואם "שמואל א פרק א".
function refMatcher(query) {
  const norm = (s) => s.replace(/["'״׳]/g, '').split(/\s+/)
    .filter((w) => !['פרק', 'פרקים', 'דף', 'דפים', 'עמוד', 'סימן', 'סימנים'].includes(w))
    .join(' ').trim();
  const q = norm(query);
  return (name) => {
    const n = norm(name);
    return n.includes(q) || q.includes(n);
  };
}

async function startQuiz(store, send, trackQuery = '') {
  const daily = buildDaily(store);
  let pending = daily.assignments.filter((a) => !daily.completedTracks.includes(a.track));
  // "למדתי מסילת ישרים" - בוחן על המסלול שצוין, בלי תלות בסדר התכנית
  if (trackQuery) {
    const match = trackMatcher(trackQuery);
    const rmatch = refMatcher(trackQuery);
    const hit = (a) => match(a.track) || a.refs.some((r) => rmatch(r.refHe));
    const chosen = pending.filter(hit);
    if (!chosen.length) {
      const doneToday = daily.assignments.find((a) => daily.completedTracks.includes(a.track) && hit(a));
      if (doneToday) {
        return send(`את הבוחן על ${doneToday.track} כבר השלמת היום 👍` +
          (pending.length ? `\nנשאר עוד היום: ${pending.map((a) => a.track).join(', ')}.` : ''));
      }
      const inPlan = (store.user?.tracks || []).find((t) => match(t.bookHe));
      if (inPlan) {
        return send(`${inPlan.bookHe} לא נמצא במשימה של היום.` +
          (pending.length ? `\nהיום על הפרק: ${pending.map((a) => a.track).join(', ')}.` : ''));
      }
      return send(`לא זיהיתי מסלול בשם "${trackQuery.trim()}".\nהמסלולים בתכנית: ${(store.user?.tracks || []).map((t) => t.bookHe).join(', ')}.`);
    }
    pending = chosen;
  }
  if (!pending.length) {
    const due = dueUnits(store.units).length;
    return send(due ? `הבוחן היומי כבר הושלם! יש ${due} חזרות ממתינות - כתוב "חזרה".` : 'הבוחן היומי כבר הושלם. כל הכבוד!');
  }
  const a = pending[0];
  const tr = store.user.tracks.find((t) => t.bookHe === a.track);
  // הצגת העומס לפני ההתחלה - כמה שאלות מחכות, כדי שאפשר יהיה להחליט
  const planned = (tr?.questions || 3) + (commentaryCount(tr?.rashi) || 0) + (commentaryCount(tr?.tosafot) || 0);
  await send(`יפה מאוד! מכין בוחן על ${refsLabel(a.refs)} - כ-${planned} שאלות.\n(באמצע: "רמז" · "לא יודע" · "דווח" · "ביטול")`);
  const { text: fetchedText, extras } = await fetchMaterial(a.refs, tr);
  let text = fetchedText;
  if (!text.trim()) return send('לא הצלחתי לשלוף את הטקסט מספריא כרגע. נסה שוב מאוחר יותר.');
  // אם היחידות כבר נלמדו פעם - לא שואלים שוב את אותן שאלות
  const avoid = a.refs.flatMap((r) => askedQuestions(store.units[r.ref]));
  const round = Math.max(...a.refs.map((r) => store.units[r.ref]?.qRound || 0), 0);
  const questions = await generateQuiz(refsLabel(a.refs), text, tr?.questions || 3, extras, { avoid, round });
  // הטקסט של המפרשים נשמר יחד עם הסוגיה, כדי שגם בדיקת התשובות תכיר אותו
  for (const ex of extras) text += ex.text;
  store.state = {
    mode: 'quiz',
    quiz: { track: a.track, refs: a.refs, text, questions, qIdx: 0, scores: [] },
  };
  save();
  return send(`שאלה 1 מתוך ${questions.length}:\n${questions[0].q}`);
}

async function handleQuizAnswer(store, msg, send) {
  const q = store.state.quiz;
  const question = q.questions[q.qIdx];
  const refHe = refsLabel(q.refs);

  if (msg === 'רמז') {
    q.assisted = true;
    save();
    logEvent('assist', { user: internalId(store.id), kind: 'hint', where: 'quiz' });
    return send(`💡 ${hintFor(question)}\nעכשיו נסה להשלים במילים שלך.`);
  }
  if (msg === 'לא יודע') {
    q.assisted = true;
    q.scores.push(0);
    logEvent('assist', { user: internalId(store.id), kind: 'reveal', where: 'quiz' });
    await send(`התשובה: ${question.ideal}\n(נרשם כתרגול - ניפגש עם זה שוב בחזרה.)`);
    q.qIdx++;
    if (q.qIdx < q.questions.length) {
      save();
      return send(`שאלה ${q.qIdx + 1} מתוך ${q.questions.length}:\n${q.questions[q.qIdx].q}`);
    }
    return finishQuiz(store, send);
  }
  if (msg === 'דווח' || msg.startsWith('דווח ')) {
    flagQuestion(store, { refHe }, question, msg.replace(/^דווח\s*/, ''));
    save();
    return send('תודה - השאלה סומנה לבדיקה ולא תישאל שוב עד שתיבדק. כתוב "לא יודע" כדי לעבור הלאה.');
  }

  const graded = await gradeSafely(store, [refHe, q.text, question.q, question.ideal, msg], send, 'quiz');
  if (!graded) return; // לא דורג - נשארים על אותה שאלה
  const { score, feedback } = graded;
  q.scores.push(score);
  let reply = `${score >= 80 ? 'מצוין!' : score >= 50 ? 'לא רע.' : 'שווה לחזור על זה.'} (ציון: ${score})\n${feedback}`;
  if (score < 80) reply += `\n📖 המקור: ${refHe}`;
  await send(reply);
  q.qIdx++;
  if (q.qIdx < q.questions.length) {
    save();
    return send(`שאלה ${q.qIdx + 1} מתוך ${q.questions.length}:\n${q.questions[q.qIdx].q}`);
  }
  return finishQuiz(store, send);
}

// סיום הבוחן על המסלול: רישום היחידות, תזמון חזרה ראשונה וסימון יום לימוד
async function finishQuiz(store, send) {
  const q = store.state.quiz;
  const avg = q.scores.length ? Math.round(q.scores.reduce((a, b) => a + b, 0) / q.scores.length) : 0;
  const daily = buildDaily(store);
  daily.completedTracks.push(q.track);
  // רישום היחידות ותזמון חזרה ראשונה.
  // כל יחידה מקבלת רק את השאלות שנוצרו עליה (לפי שדה unit מה-AI) - אחרת
  // חזרה על פרק א עלולה לשאול שאלה על פרק ב שנלמד באותו יום.
  const normU = (s) => String(s || '').replace(/["'״׳]/g, '').replace(/\s+/g, ' ').trim();
  for (const r of q.refs) {
    const own = q.questions.filter((qq) => {
      const u = normU(qq.unit);
      return u && (u === normU(r.refHe) || u.includes(normU(r.refHe)) || normU(r.refHe).includes(u));
    });
    // יחידה יחידה בבוחן - כל השאלות שלה ממילא; אחרת יחידה בלי התאמה תקבל
    // שאלות משלה בחזרה הראשונה (ראה prepareReviewQuestions)
    const questions = own.length ? own : (q.refs.length === 1 ? q.questions : []);
    const prev = store.units[r.ref];
    store.units[r.ref] = {
      refHe: r.refHe,
      track: q.track,
      learnedAt: today(),
      questions,
      qsOwn: questions.length > 0,
      // היסטוריית השאלות נשמרת גם בלימוד חוזר של אותה יחידה
      asked: prev?.asked || [],
      qRound: prev?.qRound || 0,
      scores: [avg],
      firstAssisted: !!q.assisted,
      lastExposure: today(),
      reviewLog: prev?.reviewLog || [],
      ...newUnitSchedule(),
    };
    if (questions.length) rememberAsked(store.units[r.ref], questions);
    store.stats.totalLearned++;
  }
  // קידום המסלול בלוח
  const tr = store.user.tracks.find((t) => t.bookHe === q.track);
  if (tr) tr.index += q.refs.length;
  store.state = { mode: 'idle' };
  markStudyDay(store);
  logEvent('learn', {
    user: internalId(store.id), units: q.refs.length, questions: q.scores.length,
    score: avg, assisted: !!q.assisted,
  });

  let msg2 = `סיימנו את הבוחן על ${q.track} - ציון ממוצע ${avg}. `;
  msg2 += avg >= 80 ? 'היחידה בדרך לבעלות מלאה!' : 'ניפגש עם החומר הזה שוב בחזרות.';
  msg2 += '\nחזרה ראשונה: מחר.';

  const remaining = daily.assignments.filter((a) => !daily.completedTracks.includes(a.track));
  if (remaining.length) {
    msg2 += `\n\nנשאר עוד היום: ${remaining.map((a) => a.track).join(', ')}. כשתלמד - כתוב "למדתי" (או "למדתי ${remaining[0].track}" לבחירת מסלול).`;
  } else {
    touchStreak(store);
    msg2 += `\n\nזהו! יום הלימוד הושלם. רצף ימי לימוד: ${streakInfo(store).current}.`;
  }
  save();
  const doneButtons = remaining.length ? [BTN.learned, BTN.help] : [BTN.status, BTN.help];
  if (dueUnits(store.units).length) doneButtons.unshift(BTN.review);
  return send(withButtons(msg2, doneButtons.slice(0, 3)));
}

// שולף מספריא את הטקסט הנלמד, ואם המסלול הוא גמרא עם רש"י/תוספות - גם אותם.
// משמש גם לבוחן היומי וגם לחזרות, כדי ששניהם יעבדו על אותו חומר בדיוק.
async function fetchMaterial(refs, tr) {
  const fetched = await Promise.all(refs.map(async (r) => {
    try {
      return `\n== ${r.refHe} ==\n` + (await getHebrewText(r.ref));
    } catch (e) {
      console.error('sefaria', r.ref, e.message);
      return '';
    }
  }));
  const text = fetched.join('');
  const extras = [];
  if (text.trim() && tr?.type === 'gemara') {
    const wanted = [
      commentaryCount(tr.rashi) && ['רש"י', 'Rashi on', commentaryCount(tr.rashi)],
      commentaryCount(tr.tosafot) && ['תוספות', 'Tosafot on', commentaryCount(tr.tosafot)],
    ].filter(Boolean);
    for (const [label, prefix, count] of wanted) {
      const parts = await Promise.all(refs.map(async (r) => {
        try {
          return `\n== ${label} על ${r.refHe} ==\n` + (await getHebrewText(`${prefix} ${r.ref}`));
        } catch (e) {
          console.error('sefaria', `${prefix} ${r.ref}`, e.message);
          return '';
        }
      }));
      const joined = parts.join('');
      if (joined.trim()) extras.push({ label, text: joined, count });
    }
  }
  return { text, extras };
}

// היסטוריית השאלות שכבר נשאלו על יחידה - נשלחת ל-AI כרשימת "אסור לחזור על אלה".
// שומרים עד ASKED_MEMORY שאלות, ושולחים ל-AI רק את האחרונות שבהן.
const ASKED_MEMORY = 40;
const ASKED_SENT = 14;

function askedQuestions(unit) {
  if (!unit) return [];
  const hist = Array.isArray(unit.asked) ? unit.asked : [];
  const current = (unit.questions || []).map((q) => q.q);
  return [...new Set([...hist, ...current])].slice(-ASKED_SENT);
}

function rememberAsked(unit, questions) {
  const hist = Array.isArray(unit.asked) ? unit.asked : [];
  unit.asked = [...new Set([...hist, ...questions.map((q) => q.q)])].slice(-ASKED_MEMORY);
  unit.qRound = (unit.qRound || 0) + 1;
}


// ============ עזרה בתוך שאלה, דירוג בטוח ותיעוד חזרה ============

// רמז = החלק הראשון של התשובה הנכונה. שימוש ברמז מסומן, והיחידה לא תיחשב
// "נזכרה עצמאית" בסבב הזה - תרגול הוא לא שליפה מהזיכרון.
function hintFor(question) {
  const words = String(question?.ideal || '').split(/\s+/).filter(Boolean);
  if (!words.length) return 'אין לי רמז לשאלה הזו - נסה לענות מה שאתה זוכר.';
  return words.slice(0, Math.max(2, Math.ceil(words.length * 0.4))).join(' ') + '...';
}

function daysBetween(from, to) {
  if (!from || !to) return null;
  return Math.round((new Date(`${to}T12:00:00`) - new Date(`${from}T12:00:00`)) / 86400000);
}

// מתי הלומד נחשף לאחרונה לתשובה/למקור של היחידה - הבסיס ל"זכירה לאחר פער"
function lastExposure(unit) {
  return unit.lastExposure || unit.learnedAt || null;
}

const REVIEW_LOG_MAX = 20;
function pushReviewLog(unit, entry) {
  unit.reviewLog = [...(unit.reviewLog || []), entry].slice(-REVIEW_LOG_MAX);
}

// דירוג עם הפרדה בין "נכשל זמנית" לבין "לא דורג".
// ungraded: אין ציון, אין קידום, המצב לא מתקדם - הלומד מוזמן לנסות שוב.
async function gradeSafely(store, args, send, ctx) {
  try {
    return await gradeAnswer(...args);
  } catch (e) {
    if (isUngraded(e)) {
      logEvent('ungraded', { user: internalId(store.id), where: ctx, reason: e.message.slice(0, 60) });
      await send('לא הצלחתי לדרג את התשובה הזו, ולכן לא נתתי ציון. כתוב אותה שוב (או "רמז" / "לא יודע").');
      return null;
    }
    throw e;
  }
}

// שאלה שדווחה כבעייתית מושהית: לא תוצג שוב עד שתיבדק ידנית
function flagQuestion(store, unit, question, note = '') {
  if (!unit || !question) return false;
  question.flagged = { at: today(), note: note.slice(0, 120) };
  store.flags = [...(store.flags || []), {
    at: today(), ref: unit.ref || null, refHe: unit.refHe, q: question.q, note: note.slice(0, 120), status: 'open',
  }].slice(-100);
  logEvent('flag', { user: internalId(store.id), refHe: unit.refHe });
  return true;
}

// ============ חזרות ============

// זיהוי קטגוריה של יחידה לפי ה-ref האנגלי של ספריא - ל"חזרה תנך"/"חזרה משנה" וכו',
// כולל יחידות ישנות שנשמרו בלי שם מסלול.
function unitCategory(ref) {
  if (ref.startsWith('Mishnah ') || ref.startsWith('Pirkei Avot')) return 'mishnah';
  if (ref.startsWith('Shulchan Arukh') || ref.startsWith('Kitzur')) return 'halacha';
  if (TANACH.some(([, en]) => ref.startsWith(en + ' '))) return 'tanach';
  if (BAVLI.some(([, en]) => ref.startsWith(en + ' '))) return 'gemara';
  return 'free';
}

const CATEGORY_WORDS = {
  tanach: ['תנך', 'תנ"ך', 'תורה', 'נביא', 'נביאים', 'כתובים'],
  mishnah: ['משנה', 'משניות'],
  gemara: ['גמרא', 'תלמוד', 'דף'],
  halacha: ['הלכה', 'שולחן ערוך', 'שוע', 'קיצור שולחן ערוך', 'קיצור'],
};

// "חזרה תנך" / "חזרה זבחים" - אילו יחידות מהממתינות נכנסות לחזרה
function filterDue(due, store, query) {
  if (!query) return due;
  const clean = query.replace(/["'״׳]/g, '').trim();
  const cat = Object.keys(CATEGORY_WORDS).find((c) => CATEGORY_WORDS[c].includes(clean));
  if (cat) return due.filter((d) => unitCategory(d.ref) === cat);
  const match = trackMatcher(query);
  const rmatch = refMatcher(query);
  return due.filter((d) => rmatch(d.refHe) || (d.track && match(d.track)));
}

// המסלול שהיחידה שייכת לו (גם ליחידות ישנות שנשמרו בלי שם מסלול)
function unitTrack(store, unit) {
  const tracks = store.user?.tracks || [];
  return (unit.track && tracks.find((t) => t.bookHe === unit.track)) ||
    tracks.find((t) => trackMatcher(t.bookHe)(unit.refHe));
}

// כמה שאלות מגיעות ליחידה - כמו בבוחן הלימוד של המסלול שלה
function unitQuestionCount(store, unit) {
  const tr = unitTrack(store, unit);
  return tr?.questions || Math.max(unit.questions?.length || 0, 3);
}

// כל חזרה מקבלת שאלות חדשות על אותה יחידה: מחברים אותן מחדש מהטקסט,
// עם רשימת השאלות שכבר נשאלו כדי שלא יחזרו על עצמן, ועם זווית מבט מתחלפת.
// אם השליפה או ה-AI נופלים - חוזרים לשאלות השמורות (עדיף חזרה ישנה מכלום).
async function prepareReviewQuestions(store, ref, send) {
  const unit = store.units[ref];
  const tr = unitTrack(store, unit);
  await send(`רגע, מכין שאלות חזרה על ${unit.refHe}...`);
  let text = '';
  try {
    const material = await fetchMaterial([{ ref, refHe: unit.refHe }], tr);
    text = material.text;
    if (text.trim()) {
      const fresh = await generateQuiz(
        unit.refHe, text, unitQuestionCount(store, unit), material.extras,
        { avoid: askedQuestions(unit), round: unit.qRound || 0 },
      );
      if (fresh.length) {
        unit.questions = fresh;
        unit.qsOwn = true;
        rememberAsked(unit, fresh);
      }
      // הטקסט של המפרשים נשמר גם לבדיקת התשובות
      for (const ex of material.extras) text += ex.text;
    }
  } catch (e) {
    console.error('prepareReviewQuestions', ref, e.message);
  }
  // שאלה שדווחה כבעייתית מושהית עד לבדיקה ידנית - לא נשאלת שוב
  if (Array.isArray(unit.questions)) unit.questions = unit.questions.filter((q) => !q.flagged);
  return { unit, text };
}

// מנת חזרה: עד שתי יחידות ועד עשר שאלות, לפי המגבלה שמגיעה קודם, והישן ביותר
// קודם. יחידה אף פעם לא נחתכת באמצע - אם כבר פתחנו אותה, עוברים עליה כולה.
// בלי זה, "חזרה" עם 30 יחידות בפיגור פתחה תור של 150 שאלות ברצף.
const REVIEW_MAX_UNITS = 2;
const REVIEW_MAX_QUESTIONS = 10;

export function pickDose(due, store) {
  const sorted = [...due].sort((a, b) => String(a.nextReview || '').localeCompare(String(b.nextReview || '')));
  const chosen = [];
  let questions = 0;
  for (const d of sorted) {
    const n = unitQuestionCount(store, store.units[d.ref] || d);
    if (chosen.length && (chosen.length >= REVIEW_MAX_UNITS || questions + n > REVIEW_MAX_QUESTIONS)) break;
    chosen.push(d);
    questions += n;
  }
  return { chosen, questions };
}

async function startReview(store, send, query = '') {
  const due = dueUnits(store.units);
  if (!due.length) return send(withButtons('אין חזרות ממתינות כרגע - הזיכרון שלך מעודכן!', [BTN.learned, BTN.status]));
  const matching = filterDue(due, store, query.trim());
  if (!matching.length) {
    const byName = due.map((d) => d.refHe).join(', ');
    return send(`אין חזרות ממתינות על "${query.trim()}".\nממתינות כרגע: ${byName}.\nכתוב "חזרה" לכולן, או "חזרה <שם>" לחלק מהן.`);
  }
  const { chosen, questions } = pickDose(matching, store);
  const left = matching.length - chosen.length;
  store.lastReviewFilter = query.trim();
  store.state = {
    mode: 'review',
    review: { queue: chosen.map((d) => d.ref), total: chosen.length, ref: null, qIdx: 0, scores: [], text: '', assisted: false, left },
  };
  save();
  await send(`🔁 מנה קצרה: ${chosen.length === 1 ? 'יחידה אחת' : `${chosen.length} יחידות`} · ${questions} שאלות${left ? ` · ממתינות עוד ${left} להמשך` : ''}\n(באמצע שאלה: "רמז" · "לא יודע" · "דווח" על שאלה בעייתית · "ביטול" ליציאה)`);
  return nextReviewUnit(store, send);
}

// פותח את היחידה הבאה בתור החזרות ושולח את השאלה הראשונה שלה
async function nextReviewUnit(store, send) {
  const rv = store.state.review;
  rv.ref = rv.queue.shift();
  rv.qIdx = 0;
  rv.scores = [];
  const { unit, text } = await prepareReviewQuestions(store, rv.ref, send);
  if (!unit.questions?.length) {
    // לא הצלחנו לייצר שאלות - זו אינה חזרה מוצלחת. עד כאן היחידה קיבלה 100
    // וקודמה בסולם כאילו נזכרה מושלם, בלי שנבדקה כלל. מעכשיו: "לא דורג",
    // בלי ציון, בלי קידום מרווח, והיחידה נשארת בתור.
    unit.ungraded = { at: today(), reason: 'no_questions' };
    logEvent('ungraded', { user: internalId(store.id), reason: 'no_questions' });
    save();
    await send(`לא הצלחתי להכין שאלות על ${unit.refHe} כרגע. היחידה לא דורגה ונשארת בתור החזרות.`);
    if (rv.queue.length) return nextReviewUnit(store, send);
    store.state = { mode: 'idle' };
    save();
    return send(withButtons('סיימנו את המנה.', [BTN.review, BTN.status, BTN.help]));
  }
  rv.text = text;
  save();
  const pos = rv.total > 1 ? ` · יחידה ${rv.total - rv.queue.length} מתוך ${rv.total}` : '';
  return send(`🔁 חזרה על ${unit.refHe} (נלמד ב-${unit.learnedAt})${pos}
שאלה 1 מתוך ${unit.questions.length}:
${unit.questions[0].q}`);
}

async function handleReviewAnswer(store, msg, send) {
  const rv = store.state.review;
  const unit = store.units[rv.ref];
  const question = unit.questions[rv.qIdx];
  const text = rv.text || question.ideal;

  // עזרה בתוך השאלה: רמז וחשיפה מסומנים כתרגול, לא כשליפה עצמאית
  if (msg === 'רמז') {
    rv.assisted = true;
    save();
    logEvent('assist', { user: internalId(store.id), kind: 'hint', where: 'review' });
    return send(`💡 ${hintFor(question)}\nעכשיו נסה להשלים במילים שלך.`);
  }
  if (msg === 'לא יודע') {
    rv.assisted = true;
    rv.scores.push(0);
    logEvent('assist', { user: internalId(store.id), kind: 'reveal', where: 'review' });
    await send(`התשובה: ${question.ideal}\n(נרשם כתרגול, לא כשליפה עצמאית - ניפגש איתה שוב.)`);
    rv.qIdx++;
    if (rv.qIdx < unit.questions.length) {
      save();
      return send(`שאלה ${rv.qIdx + 1} מתוך ${unit.questions.length}:\n${unit.questions[rv.qIdx].q}`);
    }
    return finishReviewUnit(store, send);
  }
  if (msg === 'דווח' || msg.startsWith('דווח ')) {
    flagQuestion(store, { ...unit, ref: rv.ref }, question, msg.replace(/^דווח\s*/, ''));
    rv.assisted = true;
    save();
    return send('תודה - השאלה סומנה לבדיקה ולא תישאל שוב עד שתיבדק. כתוב "לא יודע" כדי לעבור הלאה.');
  }

  const graded = await gradeSafely(store, [unit.refHe, text, question.q, question.ideal, msg], send, 'review');
  if (!graded) return; // לא דורג - נשארים על אותה שאלה
  const { score, feedback } = graded;
  rv.scores.push(score);
  let reply = `${score >= 80 ? 'זכור היטב!' : score >= 50 ? 'כמעט.' : 'נשכח קצת - זה בסדר, בשביל זה חוזרים.'} (ציון: ${score})\n${feedback}`;
  if (score < 80) reply += `\n📖 המקור: ${unit.refHe}`;
  await send(reply);
  rv.qIdx++;
  if (rv.qIdx < unit.questions.length) {
    save();
    return send(`שאלה ${rv.qIdx + 1} מתוך ${unit.questions.length}:\n${unit.questions[rv.qIdx].q}`);
  }
  return finishReviewUnit(store, send);
}

// סיום יחידה בחזרה: ציון, תזמון הבא, תיעוד ראיה, והמשך המנה.
async function finishReviewUnit(store, send) {
  const rv = store.state.review;
  const unit = store.units[rv.ref];
  const avg = rv.scores.length ? Math.round(rv.scores.reduce((a, b) => a + b, 0) / rv.scores.length) : 0;
  const assisted = !!rv.assisted;
  // הצלחה בעזרת רמז/חשיפה אינה ידיעה מבוססת: היא לא מקדמת את המרווח.
  // היא גם לא מענישה מעבר לציון עצמו - ממשיכים לתרגל.
  const effective = effectiveReviewScore(avg, assisted);
  const gap = daysBetween(lastExposure(unit), today());
  afterReview(unit, effective);
  unit.scores = [...(unit.scores || []), avg];
  pushReviewLog(unit, { at: today(), score: avg, assisted, gapDays: gap });
  unit.lastExposure = today();
  delete unit.ungraded;
  markStudyDay(store); // יום שבו רק חזרת הוא יום לימוד לכל דבר
  logEvent('review', {
    user: internalId(store.id), score: avg, assisted, gapDays: gap,
    intervalIdx: unit.intervalIdx, questions: rv.scores.length,
  });

  let out = `סיימנו את החזרה על ${unit.refHe} - ציון ${avg}${assisted ? ' (עם עזרה - נרשם כתרגול)' : ''}.\nחזרה הבאה בעוד ${INTERVALS[unit.intervalIdx]} ימים.`;
  rv.assisted = false;
  if (rv.queue.length) {
    save();
    await send(out);
    return nextReviewUnit(store, send);
  }
  store.state = { mode: 'idle' };
  save();
  const stillDue = dueUnits(store.units).length;
  if (stillDue) {
    out += `\n\nסיימת את המנה 👏 ממתינות עוד ${stillDue} חזרות. "המשך חזרות" למנה נוספת, או "סיימתי" להיום.`;
    return send(withButtons(out, [BTN.more, BTN.status, BTN.help]));
  }
  out += '\n\nכל החזרות הושלמו - הזיכרון שלך מעודכן!';
  return send(withButtons(out, [BTN.status, BTN.help]));
}

// ============ שאלות על הסוגיה ============

async function handleQA(store, question, send) {
  if (!question) return send('כתוב את השאלה אחרי המילה "שאלה", למשל: שאלה מה הדין של...');
  // מעגנים בטקסט של הלימוד האחרון
  const daily = buildDaily(store);
  const target = daily.assignments[0]?.refs[0] ||
    Object.entries(store.units).map(([ref, u]) => ({ ref, refHe: u.refHe })).pop();
  if (!target) return send('עוד לא למדנו כלום יחד - השאלות נענות על הסוגיה הנוכחית.');
  await send(`בודק בטקסט של ${target.refHe}...`);
  const text = await getHebrewText(target.ref);
  const answer = await answerQuestion(target.refHe, text, question);
  return send(answer);
}

// ============ מצב והתקדמות ============

// ============ שינוי קצב ============
// שינוי כמות הלימוד היומי במסלול קיים - בלי לגעת בהתקדמות ובחזרות.

function trackList(tracks, withPace) {
  return tracks.map((t, i) => `${i + 1}. ${t.bookHe}${withPace ? ` - ${paceLabel(t)}` : ''}`).join('\n');
}

function paceChange(store, msg, send) {
  const tracks = store.user.tracks;
  const rest = msg.replace(/^שנה קצב\s*/, '').trim();
  const usage = 'כתוב: שנה קצב <מספר מסלול> <קצב חדש>\nלמשל: "שנה קצב 1 2" · ובגמרא גם "שנה קצב 1 דף"';
  if (!rest) return send(`המסלולים שלך:\n${trackList(tracks, true)}\n\n${usage}`);
  const [sel, ...paceParts] = rest.split(/\s+/);
  const tr = findTrack(tracks, sel);
  if (!tr) return send(`לא זיהיתי את המסלול "${sel}".\n${trackList(tracks, true)}\n\n${usage}`);
  const pace = parsePace(tr.type === 'gemara' ? 'gemara' : 'other', paceParts.join(' '));
  if (!pace) return send(`מה הקצב החדש ל${tr.bookHe}?\n${usage}`);
  const left = tr.units.length - tr.index;
  if (pace > left) return send(`נשארו רק ${left} יחידות ב${tr.bookHe} - כתוב מספר קטן יותר.`);
  tr.pace = pace;
  refreshDaily(store);
  save();
  return send(withButtons(`עודכן: ${tr.bookHe} - ${paceLabel(tr)}.\nהשינוי בתוקף כבר מהמשימה של היום.`, [BTN.today, BTN.status]));
}

// ============ מספר שאלות בבוחן ============
// כמות השאלות בבוחן היומי, לכל מסלול בנפרד. לא נוגע בבחנים ששמורים כבר.

function quizCountChange(store, msg, send) {
  const tracks = store.user.tracks;
  const rest = msg.replace(/^שנה שאלות\s*/, '').trim();
  const usage = 'כתוב: שנה שאלות <מספר מסלול> <כמות>\nלמשל: "שנה שאלות 1 5" - חמש שאלות בבוחן של מסלול 1';
  if (!rest) return send(`המסלולים שלך:\n${tracks.map((t, i) => `${i + 1}. ${t.bookHe} - ${quizLabel(t)}`).join('\n')}\n\n${usage}`);
  const [sel, nStr] = rest.split(/\s+/);
  const tr = findTrack(tracks, sel);
  if (!tr) return send(`לא זיהיתי את המסלול "${sel}".\n${trackList(tracks, false)}\n\n${usage}`);
  const n = parseInt(nStr, 10);
  if (!n || n < 1 || n > 10) return send(`כמה שאלות בבוחן של ${tr.bookHe}? כתוב מספר בין 1 ל-10.\n${usage}`);
  tr.questions = n;
  save();
  return send(withButtons(`עודכן: ${tr.bookHe} - ${quizLabel(tr)}.\nבתוקף מהבוחן הבא.`, [BTN.status, BTN.help]));
}

// ============ שאלות על רש"י ותוספות (גמרא) ============
// קובע כמה שאלות על המפרש בבוחן (0 = בלי), לכל מסלול גמרא בנפרד.

function setCommentary(store, msg, send) {
  const tracks = store.user.tracks;
  const isTosafot = msg.startsWith('שנה תוספות');
  const field = isTosafot ? 'tosafot' : 'rashi';
  const label = isTosafot ? 'תוספות' : 'רש"י';
  const rest = msg.replace(/^שנה (תוספות|רש["'׳״]?י)\s*/, '').trim();
  const gemaraTracks = tracks.filter((t) => t.type === 'gemara');
  const usage = `כתוב: שנה ${label} <כמות שאלות 0-5>${gemaraTracks.length > 1 ? `, ואם יש כמה מסלולי גמרא: שנה ${label} <מסלול> <כמות>` : ''}\nלמשל: "שנה ${label} 2" · לביטול: "שנה ${label} 0"`;
  if (!gemaraTracks.length) return send(`שאלות על ${label} זמינות רק במסלול גמרא, ואין לך כזה כרגע. אפשר להוסיף עם "הוסף מסלול".`);

  // פענוח: <כמות> בלבד (כשיש מסלול גמרא יחיד) או <מסלול> <כמות>
  const parts = rest ? rest.split(/\s+/) : [];
  let tr, n;
  if (parts.length >= 2) {
    tr = findTrack(tracks, parts[0]);
    n = parseInt(parts[1], 10);
  } else if (parts.length === 1 && gemaraTracks.length === 1) {
    tr = gemaraTracks[0];
    n = parseInt(parts[0], 10);
  }
  if (!tr || tr.type !== 'gemara' || isNaN(n)) {
    const current = gemaraTracks.map((t) => `- ${t.bookHe}: ${commentaryCount(t[field])} שאלות על ${label} בבוחן`).join('\n');
    return send(`${current}\n\n${usage}`);
  }
  if (n < 0 || n > 5) return send(`כתוב כמות בין 0 ל-5.\n${usage}`);
  tr[field] = n;
  save();
  return send(withButtons(n
    ? `עודכן: ${tr.bookHe} - ${quizLabel(tr)}.\nבתוקף מהבוחן הבא.`
    : `שאלות על ${label} הוסרו מהבוחן של ${tr.bookHe}.`, [BTN.status, BTN.help]));
}

// ============ הוספת מסלול ============
// שאלון מקוצר: משתמשים באותו מנגנון של שאלון הפתיחה (בחירת סוג, ספר וקצב),
// אבל בסופו המסלולים החדשים מצטרפים לתכנית הקיימת במקום להחליף אותה.

function addTrackStart(store, send) {
  store.state = { mode: 'onboarding', ob: { step: 'tracks', addMode: true } };
  save();
  return send('מוסיפים מסלול לתכנית הקיימת - כל ההתקדמות והחזרות נשמרות. (להתחרטות כתוב "ביטול")\n\n' + tracksQuestion(true));
}

// ============ הסרת מסלול ============
// מוריד רק את הלימוד העתידי מהלוח. היחידות שנלמדו והחזרות עליהן נשארות.

function removeTrack(store, msg, send) {
  const tracks = store.user.tracks;
  const confirmed = /\sאשר$/.test(msg);
  const rest = msg.replace(/^הסר מסלול\s*/, '').replace(/\s*אשר$/, '').trim();
  if (!rest) return send(`איזה מסלול להסיר?\n${trackList(tracks, false)}\n\nכתוב: הסר מסלול <מספר או שם>`);
  const tr = findTrack(tracks, rest);
  if (!tr) return send(`לא זיהיתי את המסלול "${rest}".\n${trackList(tracks, false)}`);
  if (!confirmed) {
    return send(`הסרת ${tr.bookHe} מהתכנית (הגעת ל-${tr.index}/${tr.units.length} יחידות):\n- מה שנלמד עד היום נשאר שמור, כולל כל החזרות עליו\n- רק הלימוד העתידי במסלול יורד מהלוח\n\nלאישור כתוב: הסר מסלול ${rest} אשר`);
  }
  store.user.tracks = tracks.filter((t) => t !== tr);
  refreshDaily(store);
  save();
  return send(withButtons(`${tr.bookHe} הוסר מהתכנית. החזרות על מה שכבר למדת ממשיכות כרגיל.\nלהחזרה בעתיד: "הוסף מסלול".`, [BTN.status, BTN.help]));
}

// ============ עריכת מסלול ("שנה בראשית") ============
// עריכה נקודתית של מסלול קיים: החלפת הספר לספר אחר, קצב, שאלות או הסרה.
// כמו בהסרה - היחידות שנלמדו והחזרות עליהן תמיד נשמרות; רק הלוח משתנה.

// כל המסלולים שמתאימים לטוקן: מספר סידורי או שם (גם חלקי)
function matchingTracks(tracks, token) {
  if (!token) return [];
  if (/^\d+$/.test(token)) {
    const n = parseInt(token, 10);
    return n >= 1 && n <= tracks.length ? [tracks[n - 1]] : [];
  }
  const match = trackMatcher(token);
  const rmatch = refMatcher(token);
  // גם לפי שם המסלול וגם לפי היחידות של היום ("שנה שמואל" כשהתנ"ך הגיע לשמואל)
  return tracks.filter((t) =>
    match(t.bookHe) || t.units.slice(t.index, t.index + (t.pace || 1)).some((r) => rmatch(r.refHe)));
}

// התאמה חלקית ללוחות המובנים: "שמואל" -> שמואל א/ב, "בבא" -> שלוש הבבות.
// מחזיר מועמדים מכל הלוחות; הקורא מחליט אם להשתמש (אחד) או להציע (כמה).
function structuredCandidates(name) {
  const clean = name.trim().replace(/^מסכת\s+/, '').replace(/["'׳״]/g, '');
  if (!clean) return [];
  const out = [];
  for (const [type, table] of [['gemara', BAVLI], ['mishnah', MISHNAH], ['tanach', TANACH], ['halacha', SHULCHAN_ARUKH]]) {
    for (const [he] of table) {
      const h = he.replace(/["'׳״]/g, '');
      if (h !== clean && h.includes(clean)) out.push({ type, he });
    }
  }
  return out;
}

function editList(store, send) {
  return send(`המסלולים שלך:
${trackList(store.user.tracks, true)}

לעריכת מסלול (החלפת ספר, קצב, שאלות או הסרה) - כתוב: שנה <שם או מספר>
למשל: "שנה 1" או "שנה בראשית"
להוספת מסלול חדש - "הוסף מסלול"`);
}

function editMenu(tr) {
  return `✏️ עורכים את ${tr.bookHe} (הגעת ל-${tr.index}/${tr.units.length} יחידות). מה לשנות?

- כתוב שם של ספר אחר כדי להחליף אותו (למשל: ${tr.type === 'gemara' ? 'שבת' : 'שמות'}) - מה שכבר למדת והחזרות עליו נשמרים, והספר החדש מתחיל מתחילתו
- "קצב 2"${tr.type === 'gemara' ? ' / "קצב דף"' : ''} - שינוי הקצב היומי
- "שאלות 5" - כמות השאלות בבוחן
- "הסר" - הסרת המסלול מהתכנית
- "ביטול" - יציאה בלי שינוי`;
}

function editTrackStart(store, token, send) {
  const tracks = store.user.tracks;
  const t = token.trim();
  const found = matchingTracks(tracks, t);
  if (!found.length) {
    return send(`לא זיהיתי מסלול בשם "${t}".\nהמסלולים שלך:\n${trackList(tracks, true)}\n\nלעריכה כתוב: שנה <שם או מספר מסלול>`);
  }
  if (found.length > 1) {
    return send(`"${t}" מתאים לכמה מסלולים. בחר לפי מספר:\n${trackList(tracks, false)}\n\nכתוב למשל: שנה 1`);
  }
  const tr = found[0];
  store.state = { mode: 'editTrack', edit: { bookHe: tr.bookHe } };
  save();
  return send(editMenu(tr));
}

// החלפת ספר: קודם מנסים את הלוחות המובנים (אותו סוג תחילה - "ברכות" במסלול
// משנה יישאר משנה), ואז חיפוש חופשי בספריא. חלק בשולחן ערוך ("אורח חיים",
// "שולחן ערוך יורה דעה", "חו"מ") תמיד הולך למסלול ההלכה; "שולחן ערוך" לבד - מציע חלקים.
async function resolveReplacement(tr, name) {
  if (findShulchanArukhPart(name)) return { type: 'halacha', built: buildTrack('halacha', name) };
  if (/שולחן ערוך|^שוע$/.test(name.replace(/["'׳״]/g, '').trim())) {
    return { suggestions: SHULCHAN_ARUKH.map(([he]) => `שולחן ערוך ${he}`) };
  }
  const order = [...new Set([tr.type, 'gemara', 'mishnah', 'tanach'])]
    .filter((t) => ['gemara', 'mishnah', 'tanach'].includes(t));
  for (const type of order) {
    const built = buildTrack(type, name);
    if (built) return { type, built };
  }
  // התאמה חלקית: "שמואל" - אם יש מועמד יחיד משתמשים בו, אם כמה - מציעים
  const cands = structuredCandidates(name);
  const preferred = cands.filter((c) => c.type === tr.type);
  const pool = preferred.length ? preferred : cands;
  if (pool.length === 1) return { type: pool[0].type, built: buildTrack(pool[0].type, pool[0].he) };
  if (pool.length > 1) return { suggestions: [...new Set(pool.map((c) => c.he))] };
  const resolved = await resolveBook(name);
  if (!resolved.title) return { suggestions: resolved.suggestions };
  let built = null;
  try {
    built = await buildBookTrack(resolved.title);
  } catch {
    built = null;
  }
  return built ? { type: 'free', built } : {};
}

async function handleEditTrack(store, msg, send) {
  const tracks = store.user.tracks;
  const tr = tracks.find((t) => t.bookHe === store.state.edit?.bookHe);
  if (!tr) {
    store.state = { mode: 'idle' };
    save();
    return send('המסלול שערכנו כבר לא בתכנית. כתוב "הגדרות" לרשימה המעודכנת.');
  }
  if (msg === 'ביטול') {
    store.state = { mode: 'idle' };
    save();
    return send(withButtons(`יצאנו בלי שינוי - ${tr.bookHe} נשאר כמו שהוא.`, [BTN.status, BTN.help]));
  }
  if (msg === 'עזרה' || msg === '?') return send(editMenu(tr));

  if (msg === 'אפס') {
    return send(`לאיפוס ${tr.bookHe} לתחילת הספר (הלוח חוזר ליחידה הראשונה; מה שנלמד והחזרות נשמרים) - כתוב "אפס אשר".`);
  }
  if (msg === 'אפס אשר') {
    tr.index = 0;
    store.state = { mode: 'idle' };
    refreshDaily(store);
    save();
    return send(withButtons(`${tr.bookHe} אופס לתחילת הספר. השינוי בתוקף כבר מהמשימה של היום.`, [BTN.today, BTN.status]));
  }

  if (msg === 'הסר') {
    return send(`להסרת ${tr.bookHe} מהתכנית - כתוב "הסר אשר".\nמה שכבר למדת והחזרות עליו יישמרו; רק הלימוד העתידי יורד מהלוח.`);
  }
  if (msg === 'הסר אשר') {
    store.user.tracks = tracks.filter((t) => t !== tr);
    store.state = { mode: 'idle' };
    refreshDaily(store);
    save();
    return send(withButtons(`${tr.bookHe} הוסר מהתכנית. החזרות על מה שכבר למדת ממשיכות כרגיל.\nלהחזרה בעתיד: "הוסף מסלול".`, [BTN.status, BTN.help]));
  }

  if (msg.startsWith('קצב')) {
    const pace = parsePace(tr.type === 'gemara' ? 'gemara' : 'other', msg.replace(/^קצב\s*/, ''));
    if (!pace) {
      return send(tr.type === 'gemara'
        ? 'לא הבנתי את הקצב. כתוב למשל: קצב 1 · קצב דף · קצב 3 דפים'
        : 'לא הבנתי את הקצב. כתוב למשל: קצב 2');
    }
    const left = tr.units.length - tr.index;
    if (pace > left) return send(`נשארו רק ${left} יחידות ב${tr.bookHe} - כתוב מספר קטן יותר.`);
    tr.pace = pace;
    store.state = { mode: 'idle' };
    refreshDaily(store);
    save();
    return send(withButtons(`עודכן: ${tr.bookHe} - ${paceLabel(tr)}.\nהשינוי בתוקף כבר מהמשימה של היום.`, [BTN.today, BTN.status]));
  }

  if (msg.startsWith('שאלות')) {
    const n = parseInt(msg.replace(/^שאלות\s*/, ''), 10);
    if (!n || n < 1 || n > 10) return send('כמה שאלות בבוחן? כתוב למשל: שאלות 3 (בין 1 ל-10)');
    tr.questions = n;
    store.state = { mode: 'idle' };
    save();
    return send(withButtons(`עודכן: ${tr.bookHe} - ${quizLabel(tr)}.\nבתוקף מהבוחן הבא.`, [BTN.status, BTN.help]));
  }

  // כל טקסט אחר = שם ספר להחלפה
  const name = msg.replace(/^החלף\s*/, '').trim();
  if (!name) return send(editMenu(tr));
  await send(`מחפש את "${name}"...`);
  let r;
  try {
    r = await resolveReplacement(tr, name);
  } catch {
    return send('ספריא לא זמינה כרגע. נסה שוב בעוד רגע, או כתוב "ביטול".');
  }
  if (!r.built) {
    return send(r.suggestions?.length
      ? `לא מצאתי בדיוק "${name}". התכוונת לאחד מאלה?\n${r.suggestions.map((s) => `- ${s}`).join('\n')}\n\nכתוב שם מהרשימה, או "ביטול".`
      : `לא מצאתי ספר בשם "${name}". נסה שם אחר (למשל: שמות, מסילת ישרים), או כתוב "ביטול".`);
  }
  if (r.built.bookHe === tr.bookHe) {
    return send(`${tr.bookHe} הוא כבר הספר במסלול הזה - לא שיניתי כלום.\nלהתחלת הספר מחדש מתחילתו - כתוב "אפס". לספר אחר - כתוב את שמו, או "ביטול".`);
  }
  if (tracks.some((t) => t !== tr && t.bookHe === r.built.bookHe)) {
    return send(`${r.built.bookHe} כבר קיים בתכנית כמסלול נפרד. כתוב ספר אחר, או "ביטול".`);
  }
  const old = tr.bookHe;
  tr.type = r.type;
  tr.book = r.built.book;
  tr.bookHe = r.built.bookHe;
  tr.units = r.built.units;
  tr.index = 0;
  tr.pace = Math.min(tr.pace || 1, tr.units.length);
  if (r.type !== 'gemara') {
    tr.rashi = 0;
    tr.tosafot = 0;
  }
  store.state = { mode: 'idle' };
  refreshDaily(store);
  save();
  return send(withButtons(`הוחלף: ${old} ← ${tr.bookHe}
- ${paceLabel(tr)} · ${quizLabel(tr)} (סה"כ ${tr.units.length} יחידות)
- מה שלמדת ב${old} והחזרות עליו נשמרו
- השינוי בתוקף כבר מהמשימה של היום`, [BTN.today, BTN.status]));
}

// ============ שינוי תכנית ============
// החלפת תכנית באמצע מסכת מאבדת את מקום העצירה, ולכן דורשת אישור מפורש.
// היחידות שנלמדו והחזרות עליהן נשמרות - רק הלוח מתחלף.

function planChange(store, confirmed, send) {
  const inProgress = (store.user?.tracks || []).filter((t) => t.index > 0);

  if (!confirmed && inProgress.length) {
    const learned = Object.keys(store.units).length;
    const due = dueUnits(store.units).length;
    let msg = '⚠️ רגע - יש לך תכנית באמצע:\n';
    for (const t of inProgress) {
      const left = t.units.length - t.index;
      msg += `\n- ${t.bookHe}: הגעת ל${t.units[t.index]?.refHe || 'סוף'} (נשארו ${left} יחידות)`;
    }
    msg += `\n\nלא כדאי להחליף באמצע - מסכת שנקטעת באמצע נוטה להישאר לא גמורה, והרצף (${streakInfo(store).current} ימי לימוד) נשבר.`;
    msg += `\n\n${learned} היחידות שכבר למדת והחזרות עליהן יישמרו${due ? ` (${due} ממתינות עכשיו)` : ''} - רק הלוח יתחלף, ותתחיל את הספר החדש מההתחלה.`;
    msg += '\n\nרוצה רק לשנות כמות יומית או להוסיף/להסיר מסלול? יש דרך בלי לאבד כלום: "שנה קצב" · "הוסף מסלול" · "הסר מסלול".';
    msg += '\n\nלבנייה מחדש מאפס בכל זאת - כתוב "שנה תכנית בכל זאת".\nלהמשיך כרגיל - כתוב "היום".';
    return send(msg);
  }

  store.state = { mode: 'onboarding', ob: { step: 'tracks' } };
  save();
  return send('בונים תכנית חדשה!\n\n' + tracksQuestion());
}

// ============ הגדרות ============
// שאלון הפתיחה קובע את ההגדרות; מכאן אפשר לשנות אותן בלי לבנות תכנית מחדש.

function settingsMessage(store) {
  const u = store.user;
  let msg = 'ההגדרות שלך:\n';
  for (const tr of u.tracks) msg += `\n- ${tr.bookHe}: ${paceLabel(tr)} · ${quizLabel(tr)}`;
  msg += `\n\n- שעת המשימה היומית: ${u.sendHour}:00`;
  msg += `\n- שבת ויום טוב: ${u.skipShabbat ? 'מנוחה בלוח' : 'לימוד רגיל'}`;
  const rpd = Number.isFinite(u.remindPerDay) ? u.remindPerDay : 1;
  msg += `\n- הודעות יזומות ביום: ${rpd === 0 ? 'כבוי' : rpd} ("שנה תזכורות 0-6")`;
  msg += '\n\nלעריכת מסלול (החלפת ספר, קצב, שאלות, הסרה): "שנה <שם מסלול>", למשל "שנה בראשית"';
  msg += '\nעוד: "שנה קצב" · "שנה שאלות" · "שנה רש\"י" · "שנה תוספות" · "הוסף מסלול" · "הסר מסלול" · "שנה שעה 7" · "שנה שבת" · "שנה תזכורות" · "שנה תכנית" (מאפס)';
  return msg;
}

function setSendHour(store, msg, send) {
  const h = parseInt((msg.match(/\d{1,2}/) || [])[0], 10);
  if (isNaN(h) || h < 4 || h > 23) return send('כתוב שעה בין 4 ל-23, למשל: שנה שעה 7');
  store.user.sendHour = h;
  if (store.daily) store.daily.sentMorning = false; // שינוי באמצע היום ייכנס לתוקף מיד
  save();
  return send(`מעכשיו אשלח לך את המשימה היומית ב-${h}:00.`);
}

// כמה הודעות יזומות ביום. ברירת המחדל היא אחת - הודעת הבוקר עצמה.
// עד השדרוג נשלחה תזכורת כל 3 שעות, כלומר כ-5 ביום למי שלא למד.
function setReminders(store, msg, send) {
  const m = msg.match(/\d+/);
  if (!m) {
    const cur = Number.isFinite(store.user?.remindPerDay) ? store.user.remindPerDay : 1;
    return send(`כרגע: ${cur === 0 ? 'בלי הודעות יזומות' : `${cur} הודעות יזומות ביום`}.\nלשינוי: "שנה תזכורות 1" (ברירת מחדל - רק הודעת הבוקר), "שנה תזכורות 0" לכיבוי, או עד 6.`);
  }
  const n = Math.max(0, Math.min(6, parseInt(m[0], 10)));
  store.user.remindPerDay = n;
  save();
  if (n === 0) return send('סומן: לא אשלח יותר הודעות יזומות. אני כאן בכל רגע שתכתוב "היום" או "חזרה".');
  if (n === 1) return send('סומן: הודעה יזומה אחת ביום - הודעת הבוקר, והיא כוללת גם את החזרות הממתינות.');
  return send(`סומן: עד ${n} הודעות ביום (הודעת הבוקר ועוד ${n - 1} תזכורות, לפחות 3 שעות מהפעילות האחרונה שלך).`);
}

function toggleShabbat(store, send) {
  store.user.skipShabbat = !store.user.skipShabbat;
  store.daily = null; // בנייה מחדש של משימת היום לפי ההגדרה החדשה
  save();
  return send(store.user.skipShabbat
    ? 'סומן: בשבת מנוחה בלוח הלימוד.'
    : 'סומן: לימוד רגיל גם בשבת.');
}

function statusMessage(store) {
  const owned = Object.values(store.units).filter(isOwned).length;
  const total = Object.keys(store.units).length;
  const due = dueUnits(store.units).length;
  let msg = 'המצב שלך:\n';
  for (const tr of store.user.tracks) {
    const pct = Math.round((tr.index / tr.units.length) * 100);
    msg += `\n- ${tr.bookHe}: ${tr.index}/${tr.units.length} יחידות (${pct}%)`;
    if (tr.index >= tr.units.length) msg += ' - סיום! מזל טוב!';
  }
  const st = streakInfo(store);
  const recalled = Object.values(store.units).filter(isRecalled).length;
  msg += `\n\nיחידות שנלמדו: ${total} | בבעלות מלאה (3+ חזרות): ${owned}`;
  msg += `\nנזכרו בחזרה מאוחרת (בלי עזרה, 7+ ימים): ${recalled}`;
  msg += `\nחזרות ממתינות: ${due}${due ? ` - "חזרה" ${doseLabel(store)}` : ''}`;
  msg += `\nרצף ימי לימוד: ${st.current} (שיא: ${st.longest} · סה"כ ${st.total} ימי לימוד)`;
  if (store.stats.fullDays) msg += `\nימים שבהם השלמת את כל התכנית: ${store.stats.fullDays}`;
  return msg;
}

// "נזכר בחזרה מאוחרת": שתי הצלחות עצמאיות (בלי רמז/חשיפה), ולפחות אחת מהן
// אחרי פער של שבוע ומעלה מהחשיפה הקודמת. זו ראיה שנאספה, לא הבטחה לזכירה.
export function isRecalled(unit) {
  const log = (unit.reviewLog || []).filter((r) => !r.assisted && r.score >= 80);
  return log.length >= 2 && log.some((r) => (r.gapDays ?? 0) >= 7);
}

// ============ רצף ימי לימוד ============
// עד השדרוג הרצף התקדם רק ביום שבו הושלמו *כל* מסלולי היום. עם חמישה מסלולים
// מקבילים זה כמעט לא קרה: 11 ימי לימוד בפועל הניבו רצף 1. מעכשיו הרצף נשען על
// יעד אישי קטן - יום שבו למדת משהו - ומחושב על לוח תאריכים אמיתי, עם הבחנה בין
// רצף נוכחי לשיא. שבת ויום טוב אינם שוברים רצף. ההישג הישן ("השלמת כל התכנית")
// נשמר בנפרד ולא נמחק.
const STUDY_DAYS_MAX = 400;

// השלמה למאגרים ישנים: ימי הלימוד נגזרים מהיסטוריה שכבר תועדה (learnedAt
// ויומן החזרות) - לא ממציאים אירוע שלא היה.
function ensureStudyDays(store) {
  if (!store.stats) store.stats = { streak: 0, lastCompleted: null, totalLearned: 0 };
  if (!Array.isArray(store.stats.studyDays)) {
    const days = new Set();
    for (const u of Object.values(store.units || {})) {
      if (u.learnedAt) days.add(u.learnedAt);
      for (const r of u.reviewLog || []) if (r.at) days.add(r.at);
    }
    if (store.stats.lastCompleted) days.add(store.stats.lastCompleted);
    store.stats.studyDays = [...days].sort().slice(-STUDY_DAYS_MAX);
    store.stats.studyDaysBackfilled = today();
  }
  return store.stats.studyDays;
}

export function markStudyDay(store, date = today()) {
  const days = ensureStudyDays(store);
  if (!days.includes(date)) {
    store.stats.studyDays = [...days, date].sort().slice(-STUDY_DAYS_MAX);
    logEvent('study_day', { user: internalId(store.id), date });
  }
}

// פער בין שני ימי לימוד שאינו שובר רצף: יום אחד, או רק ימי מנוחה ביניהם
function gapIsForgiven(a, b, store) {
  const diff = daysBetween(a, b);
  if (diff === null || diff <= 0) return false;
  if (diff === 1) return true;
  if (!store.user?.skipShabbat) return false;
  for (let i = 1; i < diff; i++) {
    if (!isRestDateStr(addDays(a, i))) return false;
  }
  return true;
}

export function streakInfo(store) {
  const days = ensureStudyDays(store);
  let longest = 0;
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    run = i && gapIsForgiven(days[i - 1], days[i], store) ? run + 1 : 1;
    if (run > longest) longest = run;
  }
  let current = 0;
  if (days.length) {
    const last = days[days.length - 1];
    if (last === today() || gapIsForgiven(last, today(), store)) {
      current = 1;
      for (let i = days.length - 1; i > 0; i--) {
        if (gapIsForgiven(days[i - 1], days[i], store)) current++;
        else break;
      }
    }
  }
  return { current, longest, total: days.length, last: days[days.length - 1] || null };
}

// ההישג הישן: יום שבו הושלמה כל התכנית. נשמר כפי שהיה, ולא משמש יותר כרצף.
function touchStreak(store) {
  const t = today();
  markStudyDay(store, t);
  if (store.stats.lastCompleted === t) return;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const y = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
  store.stats.streak = store.stats.lastCompleted === y ? store.stats.streak + 1 : 1;
  store.stats.lastCompleted = t;
  store.stats.fullDays = (store.stats.fullDays || 0) + 1;
}
