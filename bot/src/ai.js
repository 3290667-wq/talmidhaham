// כל הקריאות ל-Claude AI. עיקרון הברזל: תשובות רק מתוך הטקסט שסופק,
// עם ציון מקור, בלי פסיקת הלכה, ועם "איני יודע" כשאין מקור.
import { config } from './config.js';

const API = 'https://api.anthropic.com/v1/messages';

async function callClaude(system, userMsg, maxTokens = 1500) {
  if (!config.anthropicKey) {
    throw new Error('חסר מפתח ANTHROPIC_API_KEY בקובץ .env - ראה README');
  }
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': config.anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userMsg }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Claude API ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.content?.map((c) => c.text || '').join('') || '';
}

function extractJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error('AI לא החזיר JSON תקין');
  return JSON.parse(text.slice(start, end + 1));
}

const IRON_RULES = `כללי ברזל שאין לחרוג מהם:
1. הסתמך אך ורק על הטקסט המצורף. אל תוסיף מידע שאינו נמצא בו.
2. אסור להמציא מקורות או ציטוטים.
3. אם אין תשובה בטקסט - כתוב "לא מצאתי לזה מקור בטקסט שלפניי, כדאי לשאול רב או חברותא".
4. איסור מוחלט לפסוק הלכה למעשה. לשאלות מעשיות ענה רק: "לשאלות הלכה למעשה - שאל את הרב שלך".
5. כתוב בעברית ברורה ומכבדת, בסגנון בית מדרש.`;

// יצירת שאלות בוחן מתוך הטקסט הנלמד
export async function generateQuiz(refHe, sourceText, numQuestions = 3) {
  const system = `אתה חברותא ותיק שמחבר שאלות חזרה על לימוד תורה. ${IRON_RULES}
החזר JSON בלבד במבנה: {"questions":[{"q":"השאלה","ideal":"התשובה הנכונה בקצרה"}]}`;
  const user = `הטקסט הנלמד (${refHe}):
---
${sourceText}
---
חבר ${numQuestions} שאלות חזרה על עיקרי הדברים בטקסט הזה: מהלך הסוגיה, דינים מרכזיים, מחלוקות ונימוקים.
שאלות שליפה (לא "נכון/לא נכון"), שאדם שלמד היטב יוכל לענות עליהן מהזיכרון.`;
  const out = await callClaude(system, user, 1500);
  const json = extractJson(out);
  if (!Array.isArray(json.questions) || !json.questions.length) throw new Error('לא נוצרו שאלות');
  return json.questions.slice(0, numQuestions);
}

// בדיקת תשובה של הלומד מול התשובה הנכונה והטקסט
export async function gradeAnswer(refHe, sourceText, question, ideal, userAnswer) {
  const system = `אתה חברותא מעודד אך אמיתי שבודק תשובות חזרה. ${IRON_RULES}
החזר JSON בלבד במבנה: {"score": מספר 0-100, "feedback": "משוב קצר בעברית - מה נכון, מה חסר, ומה התשובה המלאה"}`;
  const user = `הטקסט הנלמד (${refHe}):
---
${sourceText}
---
השאלה: ${question}
התשובה הנכונה: ${ideal}
תשובת הלומד: ${userAnswer}

דרג את תשובת הלומד (0-100) ותן משוב קצר, ענייני ומעודד. אם התשובה חלקית - השלם את החסר.`;
  const out = await callClaude(system, user, 800);
  const json = extractJson(out);
  return { score: Math.max(0, Math.min(100, Number(json.score) || 0)), feedback: String(json.feedback || '') };
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
  return callClaude(system, user, 1200);
}
