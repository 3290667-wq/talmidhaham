// כל הקריאות ל-Gemini. עיקרון הברזל: תשובות רק מתוך הטקסט שסופק,
// עם ציון מקור, בלי פסיקת הלכה, ועם "איני יודע" כשאין מקור.
import { config } from './config.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// שגיאה עם סיווג: transient = שווה לנסות שוב; ungraded = לא התקבל דירוג תקין.
function aiError(message, kind) {
  const e = new Error(message);
  e.kind = kind;
  return e;
}
export function isUngraded(err) { return err?.kind === 'ungraded'; }

const RETRY_DELAYS_MS = [1500, 4000]; // עד שני ניסיונות חוזרים, רק לשגיאה זמנית
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// קריאה ל-Gemini עם ניסיון חוזר מוגבל לשגיאות זמניות בלבד (עומס/רשת/5xx).
// כשל קבוע (מפתח, הרשאה, חסימה, קרדיטים) נכשל מיד - ניסיון חוזר רק מעכב.
async function callGemini(system, userMsg, opts = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await callGeminiOnce(system, userMsg, opts);
    } catch (e) {
      lastErr = e;
      if (e.kind !== 'transient' || attempt === RETRY_DELAYS_MS.length) throw e;
      console.log(`[AI] ${opts.label || 'ai'}: ניסיון חוזר ${attempt + 1} אחרי "${e.message}"`);
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
  throw lastErr;
}

async function callGeminiOnce(system, userMsg, { maxTokens = 4000, schema = null, label = 'ai', temperature = null } = {}) {
  if (!config.geminiKey) {
    throw new Error('חסר מפתח GEMINI_API_KEY בקובץ .env - ראה README');
  }

  const generationConfig = {
    maxOutputTokens: maxTokens,
    // בלי "חשיבה": במדידה בפועל LOW חותך את זמן התגובה פי 2.5 (7.5s -> 2.9s)
    // באיכות זהה למשימות האלה. thinkingBudget:0 לא נתמך במודל הזה.
    thinkingConfig: { thinkingLevel: 'LOW' },
  };
  // temperature גבוה נדרש רק כשרוצים גיוון בין קריאות זהות (שאלות חזרה חדשות)
  if (temperature !== null) generationConfig.temperature = temperature;
  if (schema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = schema;
  }

  const t0 = Date.now();
  let res;
  try {
    res = await fetch(`${BASE}/${config.model}:generateContent?key=${config.geminiKey}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: userMsg }] }],
        generationConfig,
      }),
    });
  } catch {
    throw aiError('לא הצלחתי להתחבר ל-AI (בעיית רשת). נסה שוב.', 'transient');
  }

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 400 && /API key/i.test(body)) throw new Error('מפתח ה-GEMINI_API_KEY אינו תקין.');
    if (res.status === 403) throw new Error('אין הרשאה ל-Gemini API עם המפתח הזה.');
    // 429 עם "depleted" = נגמרו הקרדיטים בחשבון (billing), לא עומס — "נסה שוב בעוד דקה" רק מטעה
    if (res.status === 429 && /depleted/i.test(body)) {
      throw new Error('נגמרו הקרדיטים של ה-AI בחשבון — צריך לטעון יתרה ב-AI Studio. עד אז הבחנים לא יעבדו.');
    }
    if (res.status === 429) throw aiError('יש עומס רגעי על ה-AI. נסה שוב בעוד דקה.', 'transient');
    if (res.status >= 500) throw aiError(`ה-AI לא זמין כרגע (${res.status}). מנסה שוב.`, 'transient');
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const cand = data.candidates?.[0];
  if (!cand) {
    // אין מועמד בכלל - בדרך כלל הבקשה עצמה נחסמה
    const reason = data.promptFeedback?.blockReason;
    throw new Error(reason ? `ה-AI חסם את הבקשה (${reason}).` : 'ה-AI לא החזיר תשובה.');
  }
  const text = (cand.content?.parts || []).map((p) => p.text || '').join('');
  if (!text) {
    if (cand.finishReason === 'MAX_TOKENS') throw new Error('התשובה נקטעה. נסה שוב.');
    if (cand.finishReason === 'SAFETY') throw new Error('ה-AI סירב לענות על הבקשה הזו.');
    throw new Error(`ה-AI החזיר תשובה ריקה (${cand.finishReason || 'לא ידוע'}).`);
  }
  console.log(`[AI] ${label}: ${Date.now() - t0}ms`);
  return text;
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    // רשת ביטחון אם הפלט המובנה לא נאכף מסיבה כלשהי
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end < 0) throw aiError('AI לא החזיר JSON תקין', 'ungraded');
    return JSON.parse(text.slice(start, end + 1));
  }
}

const IRON_RULES = `כללי ברזל שאין לחרוג מהם:
1. הסתמך אך ורק על הטקסט המצורף. אל תוסיף מידע שאינו נמצא בו.
2. אסור להמציא מקורות או ציטוטים.
3. אם אין תשובה בטקסט - כתוב "לא מצאתי לזה מקור בטקסט שלפניי, כדאי לשאול רב או חברותא".
4. איסור מוחלט לפסוק הלכה למעשה. לשאלות מעשיות ענה רק: "לשאלות הלכה למעשה - שאל את הרב שלך".
5. כתוב בעברית ברורה ומכבדת, בסגנון בית מדרש.`;

// סכמות בתחביר של Gemini (תת-קבוצה של OpenAPI - טיפוסים באותיות גדולות, בלי additionalProperties)
const QUIZ_SCHEMA = {
  type: 'OBJECT',
  properties: {
    questions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          q: { type: 'STRING', description: 'השאלה' },
          ideal: { type: 'STRING', description: 'התשובה הנכונה בקצרה' },
          unit: { type: 'STRING', description: 'שם היחידה שהשאלה נלקחה ממנה, בדיוק כפי שמופיע בכותרת ==...== (בלי "רש"י על"/"תוספות על")' },
        },
        required: ['q', 'ideal', 'unit'],
      },
    },
  },
  required: ['questions'],
};

const GRADE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    score: { type: 'INTEGER', description: 'ציון 0-100' },
    feedback: { type: 'STRING', description: 'משוב קצר בעברית - מה נכון, מה חסר, ומה התשובה המלאה' },
  },
  required: ['score', 'feedback'],
};

// זוויות מבט מתחלפות לשאלות. כל חזרה על יחידה מקבלת את הזווית הבאה בתור,
// כדי שהשאלות לא יחזרו על עצמן מחזרה לחזרה.
const QUIZ_ANGLES = [
  'מהלך הדברים והשתלשלות הסוגיה - מה נאמר תחילה, מה הוקשה ומה נענה',
  'הדינים והפרטים המעשיים המדויקים שנאמרו',
  'המחלוקות: מי חולק על מי, ומה הנימוק של כל צד',
  'המקורות, הראיות והפסוקים שהובאו, ומה הוכיחו מהם',
  'הגדרות, מושגים וביטויים - מה פירושם לפי הטקסט',
  'מקרי הקצה והחריגים: מתי הדין משתנה ומדוע',
];

// יצירת שאלות בוחן מתוך הטקסט הנלמד.
// extras: פירושים (רש"י/תוספות) - {label, text, count}; כל פירוש מוסיף
// count שאלות (ברירת מחדל 1), מסומנות בשמו.
export async function generateQuiz(refHe, sourceText, numQuestions = 3, extras = [], { avoid = [], round = 0 } = {}) {
  const system = `אתה חברותא ותיק שמחבר שאלות חזרה על לימוד תורה. ${IRON_RULES}`;
  let user = `הטקסט הנלמד (${refHe}):
---
${sourceText}
---`;
  for (const ex of extras) {
    user += `
פירוש ${ex.label} על ${refHe}:
---
${ex.text}
---`;
  }
  user += `
חבר ${numQuestions} שאלות חזרה על עיקרי הדברים בטקסט הנלמד עצמו: מהלך הסוגיה, דינים מרכזיים, מחלוקות ונימוקים.`;
  for (const ex of extras) {
    const c = ex.count || 1;
    user += `
בנוסף להן, חבר ${c === 1 ? 'שאלה אחת' : `${c} שאלות`} על פירוש ${ex.label} - פתח כל אחת מהן במילים "לפי ${ex.label}:". שים אותן אחרי שאלות הטקסט הנלמד.`;
  }
  // גיוון בין חזרה לחזרה: כל סבב מקבל זווית מבט אחרת על אותו טקסט
  const focus = QUIZ_ANGLES[round % QUIZ_ANGLES.length];
  user += `
הפעם הדגש את הזווית הזו: ${focus}. אם אין בטקסט חומר מספיק לזווית הזו - שאל על נקודות אחרות, ובלבד שהשאלות יהיו חדשות.`;
  if (avoid.length) {
    user += `
השאלות הבאות כבר נשאלו על הטקסט הזה בסבבים קודמים. אסור לחזור עליהן, ואסור לשאול את אותה שאלה בניסוח אחר - בחר נקודות אחרות בטקסט:
${avoid.map((q) => `- ${q}`).join('\n')}`;
  }
  user += `
שאלות שליפה (לא "נכון/לא נכון"), שאדם שלמד היטב יוכל לענות עליהן מהזיכרון.
אם הטקסט מחולק לכמה יחידות (כותרות בין == ==): פזר את השאלות בין כל היחידות, ובשדה unit של כל שאלה כתוב את שם היחידה המדויק מהכותרת שממנה השאלה לקוחה. אסור לשאול על יחידה אחת ולרשום שם של יחידה אחרת.`;
  const total = numQuestions + extras.reduce((s, e) => s + (e.count || 1), 0);
  const out = await callGemini(system, user, { maxTokens: 8000, schema: QUIZ_SCHEMA, label: 'quiz', temperature: 1.0 });
  const json = parseJson(out);
  if (!Array.isArray(json.questions) || !json.questions.length) throw new Error('לא נוצרו שאלות');
  return json.questions.slice(0, total);
}

// ולידציה של תשובת הדירוג. פונקציה טהורה כדי שתהיה ניתנת לבדיקה בלי רשת.
export function validateGrade(json) {
  const raw = Number(json?.score);
  if (!Number.isFinite(raw)) throw aiError('הדירוג חזר בלי ציון תקין - התשובה לא דורגה.', 'ungraded');
  const feedback = String(json?.feedback || '').trim();
  if (!feedback) throw aiError('הדירוג חזר בלי משוב - התשובה לא דורגה.', 'ungraded');
  return { score: Math.max(0, Math.min(100, Math.round(raw))), feedback };
}

// בדיקת תשובה של הלומד מול התשובה הנכונה והטקסט
export async function gradeAnswer(refHe, sourceText, question, ideal, userAnswer) {
  const system = `אתה חברותא מעודד אך אמיתי שבודק תשובות חזרה. ${IRON_RULES}`;
  const user = `הטקסט הנלמד (${refHe}):
---
${sourceText}
---
השאלה: ${question}
התשובה הנכונה: ${ideal}
תשובת הלומד: ${userAnswer}

דרג את תשובת הלומד (0-100) ותן משוב קצר, ענייני ומעודד. אם התשובה חלקית - השלם את החסר.`;
  const out = await callGemini(system, user, { maxTokens: 4000, schema: GRADE_SCHEMA, label: 'grade' });
  const json = parseJson(out);
  // אין ברירת מחדל לציון. 0 הוא ציון לגיטימי כשהוא הגיע מדירוג אמיתי, ולכן
  // ערך חסר/לא מספרי אינו נהפך ל-0 אלא מסומן "לא דורג" - בלי ציון, בלי קידום.
  return validateGrade(json);
}

// מענה על שאלה בסוגיה - מעוגן בטקסט בלבד
export async function answerQuestion(refHe, sourceText, question) {
  const system = `אתה חברותא-עזר ללימוד תורה. אתה עוזר להבין את הסוגיה - אתה לא רב ולא פוסק. ${IRON_RULES}
בכל תשובה ציין במפורש היכן בטקסט הדברים נמצאים (${refHe}). סיים תשובות ארוכות במשפט: "כדאי לבדוק בפנים".`;
  const user = `הטקסט (${refHe}):
---
${sourceText}
---
שאלת הלומד: ${question}`;
  return callGemini(system, user, { maxTokens: 4000, label: 'qa' });
}
