// לוחות תוכן: מסכתות הש"ס, המשנה, שולחן ערוך ותנ"ך
// המפתח האנגלי הוא שם ההפניה (ref) של ספריא.

// תלמוד בבלי: שם עברי, ref בספריא, הדף האחרון (הדפים מתחילים מדף ב)
export const BAVLI = [
  ['ברכות', 'Berakhot', 64], ['שבת', 'Shabbat', 157], ['עירובין', 'Eruvin', 105],
  ['פסחים', 'Pesachim', 121], ['יומא', 'Yoma', 88], ['סוכה', 'Sukkah', 56],
  ['ביצה', 'Beitzah', 40], ['ראש השנה', 'Rosh Hashanah', 35], ['תענית', 'Taanit', 31],
  ['מגילה', 'Megillah', 32], ['מועד קטן', 'Moed Katan', 29], ['חגיגה', 'Chagigah', 27],
  ['יבמות', 'Yevamot', 122], ['כתובות', 'Ketubot', 112], ['נדרים', 'Nedarim', 91],
  ['נזיר', 'Nazir', 66], ['סוטה', 'Sotah', 49], ['גיטין', 'Gittin', 90],
  ['קידושין', 'Kiddushin', 82], ['בבא קמא', 'Bava Kamma', 119], ['בבא מציעא', 'Bava Metzia', 119],
  ['בבא בתרא', 'Bava Batra', 176], ['סנהדרין', 'Sanhedrin', 113], ['מכות', 'Makkot', 24],
  ['שבועות', 'Shevuot', 49], ['עבודה זרה', 'Avodah Zarah', 76], ['הוריות', 'Horayot', 14],
  ['זבחים', 'Zevachim', 120], ['מנחות', 'Menachot', 110], ['חולין', 'Chullin', 142],
  ['בכורות', 'Bekhorot', 61], ['ערכין', 'Arakhin', 34], ['תמורה', 'Temurah', 34],
  ['כריתות', 'Keritot', 28], ['מעילה', 'Meilah', 22], ['נדה', 'Niddah', 73],
];

// משנה: שם עברי, ref בספריא, מספר פרקים
export const MISHNAH = [
  ['ברכות', 'Mishnah Berakhot', 9], ['פאה', 'Mishnah Peah', 8], ['דמאי', 'Mishnah Demai', 7],
  ['כלאים', 'Mishnah Kilayim', 9], ['שביעית', 'Mishnah Sheviit', 10], ['תרומות', 'Mishnah Terumot', 11],
  ['מעשרות', 'Mishnah Maasrot', 5], ['מעשר שני', 'Mishnah Maaser Sheni', 5], ['חלה', 'Mishnah Challah', 4],
  ['ערלה', 'Mishnah Orlah', 3], ['ביכורים', 'Mishnah Bikkurim', 4],
  ['שבת', 'Mishnah Shabbat', 24], ['עירובין', 'Mishnah Eruvin', 10], ['פסחים', 'Mishnah Pesachim', 10],
  ['שקלים', 'Mishnah Shekalim', 8], ['יומא', 'Mishnah Yoma', 8], ['סוכה', 'Mishnah Sukkah', 5],
  ['ביצה', 'Mishnah Beitzah', 5], ['ראש השנה', 'Mishnah Rosh Hashanah', 4], ['תענית', 'Mishnah Taanit', 4],
  ['מגילה', 'Mishnah Megillah', 4], ['מועד קטן', 'Mishnah Moed Katan', 3], ['חגיגה', 'Mishnah Chagigah', 3],
  ['יבמות', 'Mishnah Yevamot', 16], ['כתובות', 'Mishnah Ketubot', 13], ['נדרים', 'Mishnah Nedarim', 11],
  ['נזיר', 'Mishnah Nazir', 9], ['סוטה', 'Mishnah Sotah', 9], ['גיטין', 'Mishnah Gittin', 9],
  ['קידושין', 'Mishnah Kiddushin', 4],
  ['בבא קמא', 'Mishnah Bava Kamma', 10], ['בבא מציעא', 'Mishnah Bava Metzia', 10], ['בבא בתרא', 'Mishnah Bava Batra', 10],
  ['סנהדרין', 'Mishnah Sanhedrin', 11], ['מכות', 'Mishnah Makkot', 3], ['שבועות', 'Mishnah Shevuot', 8],
  ['עדויות', 'Mishnah Eduyot', 8], ['עבודה זרה', 'Mishnah Avodah Zarah', 5], ['אבות', 'Pirkei Avot', 6],
  ['הוריות', 'Mishnah Horayot', 3],
  ['זבחים', 'Mishnah Zevachim', 14], ['מנחות', 'Mishnah Menachot', 13], ['חולין', 'Mishnah Chullin', 12],
  ['בכורות', 'Mishnah Bekhorot', 9], ['ערכין', 'Mishnah Arakhin', 9], ['תמורה', 'Mishnah Temurah', 7],
  ['כריתות', 'Mishnah Keritot', 6], ['מעילה', 'Mishnah Meilah', 6], ['תמיד', 'Mishnah Tamid', 7],
  ['מדות', 'Mishnah Middot', 5], ['קינים', 'Mishnah Kinnim', 3],
  ['כלים', 'Mishnah Kelim', 30], ['אהלות', 'Mishnah Oholot', 18], ['נגעים', 'Mishnah Negaim', 14],
  ['פרה', 'Mishnah Parah', 12], ['טהרות', 'Mishnah Tahorot', 10], ['מקוואות', 'Mishnah Mikvaot', 10],
  ['נדה', 'Mishnah Niddah', 10], ['מכשירין', 'Mishnah Makhshirin', 6], ['זבים', 'Mishnah Zavim', 5],
  ['טבול יום', 'Mishnah Tevul Yom', 4], ['ידים', 'Mishnah Yadayim', 4], ['עוקצין', 'Mishnah Oktzin', 3],
];

// תנ"ך: שם עברי, ref בספריא, מספר פרקים
export const TANACH = [
  ['בראשית', 'Genesis', 50], ['שמות', 'Exodus', 40], ['ויקרא', 'Leviticus', 27],
  ['במדבר', 'Numbers', 36], ['דברים', 'Deuteronomy', 34],
  ['יהושע', 'Joshua', 24], ['שופטים', 'Judges', 21], ['שמואל א', 'I Samuel', 31],
  ['שמואל ב', 'II Samuel', 24], ['מלכים א', 'I Kings', 22], ['מלכים ב', 'II Kings', 25],
  ['ישעיהו', 'Isaiah', 66], ['ירמיהו', 'Jeremiah', 52], ['יחזקאל', 'Ezekiel', 48],
  ['הושע', 'Hosea', 14], ['יואל', 'Joel', 4], ['עמוס', 'Amos', 9], ['עובדיה', 'Obadiah', 1],
  ['יונה', 'Jonah', 4], ['מיכה', 'Micah', 7], ['נחום', 'Nahum', 3], ['חבקוק', 'Habakkuk', 3],
  ['צפניה', 'Zephaniah', 3], ['חגי', 'Haggai', 2], ['זכריה', 'Zechariah', 14], ['מלאכי', 'Malachi', 3],
  ['תהלים', 'Psalms', 150], ['משלי', 'Proverbs', 31], ['איוב', 'Job', 42],
  ['שיר השירים', 'Song of Songs', 8], ['רות', 'Ruth', 4], ['איכה', 'Lamentations', 5],
  ['קהלת', 'Ecclesiastes', 12], ['אסתר', 'Esther', 10], ['דניאל', 'Daniel', 12],
  ['עזרא', 'Ezra', 10], ['נחמיה', 'Nehemiah', 13], ['דברי הימים א', 'I Chronicles', 29],
  ['דברי הימים ב', 'II Chronicles', 36],
];

// שולחן ערוך: ארבעת החלקים - שם עברי, ref בספריא, מספר סימנים, וכינויים מקובלים
export const SHULCHAN_ARUKH = [
  ['אורח חיים', 'Shulchan Arukh, Orach Chayim', 697, ['אוח', 'או"ח', 'אורח']],
  ['יורה דעה', "Shulchan Arukh, Yoreh De'ah", 403, ['יוד', 'יו"ד', 'יורה']],
  ['אבן העזר', 'Shulchan Arukh, Even HaEzer', 178, ['אהע', 'אה"ע', 'אבן עזר']],
  ['חושן משפט', 'Shulchan Arukh, Choshen Mishpat', 427, ['חומ', 'חו"מ', 'חושן']],
];
export const SHULCHAN_ARUKH_HE = 'שולחן ערוך';

// זיהוי חלק בשולחן ערוך: "אורח חיים", "שולחן ערוך אורח חיים", "או"ח", "יו"ד"...
export function findShulchanArukhPart(name) {
  const clean = (name || '').trim()
    .replace(/["'׳״]/g, '')
    .replace(/^(שולחן ערוך|שוע|שע)\s*[,-]?\s*/, '')
    .replace(/^חלק\s+/, '')
    .trim();
  if (!clean) return null;
  return SHULCHAN_ARUKH.find(([he, , , aliases]) =>
    he === clean || aliases.map((a) => a.replace(/["'׳״]/g, '')).includes(clean)) || null;
}

// המרת מספר לאותיות עבריות (גימטריה) לתצוגת דף/פרק/סימן
export function toHebrewNum(n) {
  const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
  const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
  const hundreds = ['', 'ק', 'ר', 'ש', 'ת'];
  let s = '', x = n;
  while (x >= 400) { s += 'ת'; x -= 400; }
  s += hundreds[Math.floor(x / 100)]; x %= 100;
  if (x === 15) return s + 'טו';
  if (x === 16) return s + 'טז';
  s += tens[Math.floor(x / 10)];
  s += ones[x % 10];
  return s || '?';
}

function findByHebrew(table, name) {
  const clean = name.trim().replace(/^מסכת\s+/, '').replace(/["'׳״]/g, '');
  return table.find(([he]) => he.replace(/["'׳״]/g, '') === clean);
}

// בניית רשימת יחידות לימוד (refs) לכל סוג מסלול
export function buildTrack(type, bookNameHe) {
  if (type === 'gemara') {
    const row = findByHebrew(BAVLI, bookNameHe);
    if (!row) return null;
    const [he, ref, lastDaf] = row;
    const units = [];
    for (let daf = 2; daf <= lastDaf; daf++) {
      units.push({ ref: `${ref} ${daf}a`, refHe: `${he} דף ${toHebrewNum(daf)} עמוד א` });
      units.push({ ref: `${ref} ${daf}b`, refHe: `${he} דף ${toHebrewNum(daf)} עמוד ב` });
    }
    return { book: ref, bookHe: `גמרא ${he}`, units };
  }
  if (type === 'mishnah') {
    const row = findByHebrew(MISHNAH, bookNameHe);
    if (!row) return null;
    const [he, ref, perakim] = row;
    const units = [];
    for (let p = 1; p <= perakim; p++) {
      units.push({ ref: `${ref} ${p}`, refHe: `משנה ${he} פרק ${toHebrewNum(p)}` });
    }
    return { book: ref, bookHe: `משנה ${he}`, units };
  }
  if (type === 'halacha') {
    // שולחן ערוך נלמד לפי חלק (אורח חיים / יורה דעה / אבן העזר / חושן משפט); סימן = יחידה
    const row = findShulchanArukhPart(bookNameHe);
    if (!row) return null;
    const [he, ref, simanim] = row;
    const bookHe = `${SHULCHAN_ARUKH_HE} ${he}`;
    const units = [];
    for (let s = 1; s <= simanim; s++) {
      units.push({ ref: `${ref} ${s}`, refHe: `${bookHe} סימן ${toHebrewNum(s)}` });
    }
    return { book: ref, bookHe, units };
  }
  if (type === 'tanach') {
    // שם שלא נמצא חייב להחזיר null (ולא ליפול בשקט לבראשית) - אחרת
    // "שמואל" בשאלון או בהחלפת ספר הופך בלי אזהרה לתנ"ך מבראשית.
    const row = bookNameHe ? findByHebrew(TANACH, bookNameHe) : TANACH[0];
    if (!row) return null;
    const from = TANACH.findIndex(([he]) => he === row[0]);
    const units = [];
    for (let i = from; i < TANACH.length; i++) {
      const [he, ref, chapters] = TANACH[i];
      for (let c = 1; c <= chapters; c++) {
        units.push({ ref: `${ref} ${c}`, refHe: `${he} פרק ${toHebrewNum(c)}` });
      }
    }
    return { book: 'Tanach', bookHe: `תנ"ך (מ${row[0]})`, units };
  }
  return null;
}

export const TRACK_TYPES = {
  1: { type: 'gemara', label: 'גמרא (עמוד או דף ליום)' },
  2: { type: 'mishnah', label: 'משנה (פרקים ליום)' },
  3: { type: 'halacha', label: 'הלכה - שולחן ערוך (סימנים ליום, לפי חלק)' },
  4: { type: 'tanach', label: 'תנ"ך (פרק ליום)' },
  5: { type: 'free', label: 'ספר אחר - כל ספר מספריא (רמב"ם, מסילת ישרים, חובות הלבבות, תניא...)' },
};
