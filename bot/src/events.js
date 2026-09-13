// יומן אירועים מצטבר (JSONL) - הבסיס למדידה שמבדילה בין שימוש לבין ידע.
// עיקרון: שורה אחת לאירוע, בלי תוכן שיחות, בלי תשובות חופשיות ובלי מזהי ווצאפ.
// המשתמש מיוצג במזהה פנימי גזור (hash) כדי שהיומן יהיה ניתן לניתוח בלי לזהות אדם.
// כשל ביומן לעולם לא יפיל את הבוט - כל הכתיבה עטופה.
import { appendFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { DATA_DIR } from './config.js';

const LOG_DIR = join(DATA_DIR, 'events');
const MAX_BYTES = 4 * 1024 * 1024; // קובץ חודשי מתגלגל כשהוא גדול מדי
const KEEP_FILES = 12;

const idCache = new Map();

// מזהה פנימי קצר ויציב. לא ניתן להיפוך לטלפון בלי המקור, ומספיק לחיבור אירועים.
export function internalId(userId) {
  if (!userId) return 'anon';
  if (idCache.has(userId)) return idCache.get(userId);
  const h = 'u' + createHash('sha256').update(String(userId)).digest('hex').slice(0, 10);
  idCache.set(userId, h);
  return h;
}

function currentFile() {
  if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
  const d = new Date();
  const base = `events-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  let path = join(LOG_DIR, `${base}.jsonl`);
  if (existsSync(path) && statSync(path).size > MAX_BYTES) {
    let n = 1;
    while (existsSync(join(LOG_DIR, `${base}.${n}.jsonl`))) n++;
    path = join(LOG_DIR, `${base}.${n}.jsonl`);
  }
  return path;
}

function rotate() {
  try {
    const files = readdirSync(LOG_DIR).filter((f) => f.endsWith('.jsonl')).sort();
    while (files.length > KEEP_FILES) unlinkSync(join(LOG_DIR, files.shift()));
  } catch { /* ניקוי הוא best-effort */ }
}

let counter = 0;

// type: sample | send | learn | review | ungraded | ai_error | assist | flag
// fields: שדות עובדתיים בלבד. אין להעביר לכאן טקסט תשובה או שאלה מלאה.
export function logEvent(type, fields = {}) {
  try {
    const ev = {
      id: `${Date.now().toString(36)}-${(counter++).toString(36)}`,
      ts: new Date().toISOString(),
      type,
      ...fields,
    };
    appendFileSync(currentFile(), JSON.stringify(ev) + '\n', 'utf8');
    rotate();
  } catch { /* היומן לעולם לא שובר את הבוט */ }
}
