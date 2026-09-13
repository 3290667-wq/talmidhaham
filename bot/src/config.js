import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(__dirname, '..');
// TALMID_DATA_DIR מיועד לבדיקות בלבד: בלעדיו test-offline כתב למאגר החי
// ודרס משתמשים אמיתיים (נצפה 16.8). ה-.env לא מגדיר אותו, ולכן הדריסה
// של .env על process.env (למטה) לא נוגעת בו.
export const DATA_DIR = process.env.TALMID_DATA_DIR || join(ROOT, 'data');

// טעינת קובץ .env בלי תלות בחבילה חיצונית.
// ה-.env של הבוט גובר על משתני סביבה חיצוניים: pm2 משמר env ישן בין
// ריסטארטים, ומפתח GEMINI_API_KEY זר שדלף מה-shell שבר את הבוט בעבר.
const envPath = join(ROOT, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2];
  }
}

export const config = {
  geminiKey: process.env.GEMINI_API_KEY || '',
  model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
  // ערוץ הווצאפ בשרת הזה: הברידג' (Evolution API) מעביר לכאן הודעות מהקבוצה,
  // והבוט שולח תשובות חזרה דרך /send-text של הברידג'.
  bridge: {
    url: process.env.BRIDGE_URL || 'http://localhost:3002',
    groupId: process.env.TALMID_GROUP_ID || '',
    port: parseInt(process.env.PORT || '3005', 10),
  },
};
