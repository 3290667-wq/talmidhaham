// לוח שנה עברי בלי תלות חיצונית: Node מספק את הלוח העברי דרך Intl,
// ומכאן נגזרים שבת ויום טוב. המטרה כפולה -
// (1) לא לשלוח הודעות בשבת וביום טוב, (2) לא לשבור רצף לימוד בגללם.
//
// רקע: ב-13.9.2026 (ב' דראש השנה) נשלחו תזכורות, כי הקוד הכיר רק שבת.
//
// ימים טובים כמנהג ארץ ישראל (יום אחד): א'-ב' תשרי, י' תשרי, ט"ו וכ"ב תשרי,
// ט"ו וכ"א ניסן, ו' סיוון. חול המועד אינו יום טוב ואינו משתיק הודעות.

const HEB = new Intl.DateTimeFormat('en-u-ca-hebrew', {
  day: 'numeric', month: 'long', timeZone: 'Asia/Jerusalem',
});

const YOM_TOV = {
  Tishri: [1, 2, 10, 15, 22],
  Nisan: [15, 21],
  Sivan: [6],
};

export function hebrewDate(date = new Date()) {
  const parts = HEB.formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return { day: parseInt(get('day'), 10), month: get('month') };
}

export function isYomTov(date = new Date()) {
  const { day, month } = hebrewDate(date);
  return (YOM_TOV[month] || []).includes(day);
}

const DAY_MS = 24 * 60 * 60 * 1000;

// ערב יום טוב - כדי להשתיק כבר מהצהריים, כמו ביום שישי
export function isErevYomTov(date = new Date()) {
  return isYomTov(new Date(date.getTime() + DAY_MS));
}

// שעה ויום בשבוע לפי שעון ישראל (השרת רץ על שעון אירופה)
export function ilParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem', weekday: 'short', hour: 'numeric', hourCycle: 'h23',
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return { weekday: get('weekday'), hour: parseInt(get('hour'), 10) };
}

// יום מנוחה מלא: שבת או יום טוב. משמש גם לחישוב רצף (יום כזה אינו שובר רצף).
export function isRestDay(date = new Date()) {
  return ilParts(date).weekday === 'Sat' || isYomTov(date);
}

// זמן שקט: אין לשלוח שום הודעה יזומה.
// הכניסה מוחמרת לשעה 16:00 בערב שבת/יום טוב (לפני הדלקת נרות גם בחורף),
// והיציאה בחצות - ממילא אין הודעות בלילה, והבוקר שאחרי הוא יום חדש.
export function isQuietTime(date = new Date()) {
  const { weekday, hour } = ilParts(date);
  if (weekday === 'Sat' || isYomTov(date)) return true;
  if (hour >= 16 && (weekday === 'Fri' || isErevYomTov(date))) return true;
  return false;
}

// תאריך מקומי בפורמט YYYY-MM-DD לפי שעון ישראל
export function ilDateStr(date = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
  return p;
}

// יום מנוחה לפי מחרוזת תאריך (לחישוב רצפים על לוח תאריכים אמיתי)
export function isRestDateStr(dateStr) {
  return isRestDay(new Date(`${dateStr}T12:00:00+03:00`));
}
