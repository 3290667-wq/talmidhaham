import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, copyFileSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR } from './config.js';
import { buildTrack } from './curriculum.js';

const STORE_PATH = join(DATA_DIR, 'store.json');

// המאגר מחזיק רשומה נפרדת לכל משתתף (מפתח = מזהה השולח בווצאפ),
// כך שלכל אחד בקבוצה תכנית, בחנים, חזרות ורצף משלו.
const EMPTY_USER = {
  name: null, // שם התצוגה בווצאפ - לפנייה אישית בקבוצה
  user: null, // { onboarded, tracks:[{type, book, bookHe, pace, index, total}], sendHour, skipShabbat }
  state: { mode: 'idle' }, // onboarding / quiz / review / idle
  units: {}, // ref -> { refHe, learnedAt, questions:[{q,ideal}], reviews, intervalIdx, nextReview, scores:[] }
  daily: null, // { date, sentMorning, lastPingAt, assignments:[{track, refs:[{ref,refHe}]}], completedTracks:[] }
  stats: { streak: 0, lastCompleted: null, totalLearned: 0 },
};

let store = null; // { users: { [userId]: <רשומת משתמש> } }

function loadAll() {
  if (store) return store;
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (existsSync(STORE_PATH)) {
    try {
      store = JSON.parse(readFileSync(STORE_PATH, 'utf8'));
    } catch {
      store = { users: {} };
    }
  } else {
    store = { users: {} };
  }
  if (!store.users) store.users = {};
  migrateKitzur(store);
  migrateStudyDays(store);
  return store;
}

// מיגרציה חד-פעמית (31.8.2026): מסלול ההלכה עבר מקיצור שולחן ערוך לשולחן ערוך.
// מסלול קיים על הקיצור מוחלף בשולחן ערוך אורח חיים מסימן א, באותו קצב ומספר
// שאלות. היחידות שכבר נלמדו מהקיצור נשארות במאגר החזרות כרגיל.
function migrateKitzur(all) {
  let changed = false;
  for (const u of Object.values(all.users)) {
    for (const tr of u.user?.tracks || []) {
      if (tr.book !== 'Kitzur Shulchan Arukh') continue;
      const oldHe = tr.bookHe;
      const built = buildTrack('halacha', 'אורח חיים');
      Object.assign(tr, { type: 'halacha', book: built.book, bookHe: built.bookHe, units: built.units, index: 0 });
      // שם המסלול בהקצאה של היום - כדי ש"סיימתי"/סינון ההשלמות ימשיכו לזהות אותו
      for (const a of u.daily?.assignments || []) if (a.track === oldHe) a.track = tr.bookHe;
      if (Array.isArray(u.daily?.completedTracks)) {
        u.daily.completedTracks = u.daily.completedTracks.map((t) => (t === oldHe ? tr.bookHe : t));
      }
      changed = true;
      console.log(`[DB] מסלול ההלכה של ${u.name || u.id} הועבר מקיצור שו"ע ל${tr.bookHe}`);
    }
  }
  if (changed) writeStore();
}

// מיגרציה (KETER-UPGRADE-20260913): ימי הלימוד עוברים להיות רשימת תאריכים
// אמיתית, כדי שהרצף יחושב על לוח שנה ולא ממונה יחיד. הרשימה נגזרת מהיסטוריה
// שכבר תועדה (learnedAt ויומן החזרות) - לא ממציאים יום לימוד שלא נרשם.
function migrateStudyDays(all) {
  let changed = false;
  for (const u of Object.values(all.users)) {
    if (!u.stats) u.stats = { streak: 0, lastCompleted: null, totalLearned: 0 };
    if (Array.isArray(u.stats.studyDays)) continue;
    const days = new Set();
    for (const unit of Object.values(u.units || {})) {
      if (unit.learnedAt) days.add(unit.learnedAt);
      for (const r of unit.reviewLog || []) if (r.at) days.add(r.at);
    }
    u.stats.studyDays = [...days].sort().slice(-400);
    u.stats.studyDaysBackfilled = today();
    changed = true;
    console.log(`[DB] ${u.stats.studyDays.length} ימי לימוד הושלמו מההיסטוריה עבור ${u.name || u.id}`);
  }
  if (changed) writeStore();
}

// רשומת המשתמש; נוצרת אוטומטית בפנייה הראשונה שלו.
export function loadUser(userId, name) {
  const all = loadAll();
  if (!all.users[userId]) all.users[userId] = structuredClone(EMPTY_USER);
  const u = all.users[userId];
  u.id = userId;
  // nameCustom = שם שנקבע ידנית; לא נדרס ע"י שם התצוגה של ווצאפ
  if (name && !u.nameCustom && u.name !== name) u.name = name;
  return u;
}

// מחזיר הפניות חיות לרשומות (לא עותקים) - שינויים בהן נשמרים ב-save().
export function listUsers() {
  const all = loadAll();
  return Object.entries(all.users).map(([id, u]) => { u.id = id; return u; });
}

export function save() {
  if (!store) return;
  writeStore();
}

function writeStore() {
  const tmp = STORE_PATH + '.tmp';
  writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
  renameSync(tmp, STORE_PATH);
}

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ============ גיבויים מחזוריים ============
// השמירה עצמה כבר אטומית (קובץ זמני + rename) ואין לשנות אותה. מה שחסר היה
// גיבוי: עד היום היו רק 8 עותקים ידניים. כאן נשמר עותק יומי, נבדק בקריאה
// מיד אחרי הכתיבה (גיבוי שלא נקרא אינו גיבוי), ונשמרים KEEP_BACKUPS עותקים.
const BACKUP_DIR = join(DATA_DIR, 'backups');
const KEEP_BACKUPS = 14;

export function backupStore(tag = 'auto') {
  try {
    if (!existsSync(STORE_PATH)) return { ok: false, reason: 'אין מאגר לגבות' };
    if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
    const path = join(BACKUP_DIR, `store-${stamp}-${tag}.json`);
    copyFileSync(STORE_PATH, path);
    // אימות: הגיבוי נקרא ומכיל את מה שהוא אמור להכיל
    const check = JSON.parse(readFileSync(path, 'utf8'));
    const users = Object.keys(check.users || {}).length;
    const units = Object.values(check.users || {}).reduce((n, u) => n + Object.keys(u.units || {}).length, 0);
    if (!check.users) throw new Error('גיבוי בלי users');
    const files = readdirSync(BACKUP_DIR).filter((f) => f.startsWith('store-')).sort();
    while (files.length > KEEP_BACKUPS) unlinkSync(join(BACKUP_DIR, files.shift()));
    return { ok: true, path, users, units };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// האם כבר יש גיבוי מהיום (כדי לגבות פעם ביום ולא בכל טיק של המתזמן)
export function hasBackupToday() {
  try {
    if (!existsSync(BACKUP_DIR)) return false;
    const d = new Date();
    const prefix = `store-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-`;
    return readdirSync(BACKUP_DIR).some((f) => f.startsWith(prefix));
  } catch {
    return false;
  }
}
