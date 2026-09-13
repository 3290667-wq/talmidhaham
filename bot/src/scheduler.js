// תזמון ההודעות היזומות.
//
// הכלל מ-KETER-UPGRADE-20260913: **הודעה יזומה אחת ביום כברירת מחדל** -
// הודעת הבוקר היא התזכורת, ולא מתווספות אליה תזכורות חוזרות. עד השדרוג
// נשלחו כ-5 תזכורות ביום (כל 3 שעות) למי שלא למד, וזו הצפה ולא עידוד.
// מי שרוצה יותר יכול לבקש ("שנה תזכורות 3"), ואז נשמר מרווח של 3 שעות
// מהפעילות האחרונה של הלומד - לא מהתזכורת הקודמת.
//
// אין הודעות בשבת וביום טוב (calendar.js), ואחרי שעת השקט.
// תזכורת שנדחתה בגלל חג אינה נצברת: כל יום מתחיל מחדש.
import { listUsers, save, backupStore, hasBackupToday } from './db.js';
import { morningPayload, buildDaily, reminderPayload, dueCount } from './conversation.js';
import { isQuietTime, ilParts } from './calendar.js';
import { logEvent, internalId } from './events.js';

const REMIND_EVERY_MS = 3 * 60 * 60 * 1000;
const QUIET_HOUR = 22; // אחרי 22:00 לא מטרידים - ממשיכים מחר בבוקר
const MORNING_MAX_ATTEMPTS = 3; // כשל שליחה: עד 3 ניסיונות ביום, ואז שקט

// כמה הודעות יזומות ביום מותרות למשתמש (הודעת הבוקר נספרת בתוכן)
export function pingBudget(store) {
  const n = store.user?.remindPerDay;
  return Number.isFinite(n) ? Math.max(0, Math.min(6, n)) : 1;
}

export function startScheduler(send) {
  setInterval(async () => {
    const now = Date.now();
    if (isQuietTime()) return; // שבת / יום טוב / ערב חג מ-16:00
    const il = ilParts();

    // גיבוי יומי מאומת של המאגר (השמירה עצמה כבר אטומית ולא נגענו בה)
    if (il.hour >= 3 && !hasBackupToday()) {
      const r = backupStore('daily');
      logEvent('backup', { ok: r.ok, users: r.users, units: r.units, reason: r.reason });
      if (!r.ok) console.error('גיבוי יומי נכשל:', r.reason);
    }

    for (const store of listUsers()) {
      try {
        if (!store.user?.onboarded) continue;
        const daily = buildDaily(store);
        const budget = pingBudget(store);
        if (!budget) continue; // המשתמש ביטל תזכורות לגמרי
        if ((daily.pings || 0) >= budget) continue;

        // הודעת הבוקר בשעה שנקבעה.
        // "נשלח" נרשם רק אחרי שהשליחה הצליחה - קודם הדגל נקבע לפני השליחה,
        // וכך הודעה שנכשלה נחשבה שנשלחה ולא נשלחה שוב באותו יום.
        if (!daily.sentMorning && il.hour >= store.user.sendHour) {
          if ((daily.morningAttempts || 0) >= MORNING_MAX_ATTEMPTS) continue;
          daily.morningAttempts = (daily.morningAttempts || 0) + 1;
          save();
          const ok = await send(store.id, morningPayload(store), { kind: 'morning' });
          if (ok) {
            daily.sentMorning = true;
            daily.lastPingAt = now;
            daily.pings = (daily.pings || 0) + 1;
            logEvent('proactive', { user: internalId(store.id), kind: 'morning', due: dueCount(store) });
          } else {
            logEvent('proactive', { user: internalId(store.id), kind: 'morning', state: 'failed', attempt: daily.morningAttempts });
          }
          save();
          continue;
        }

        // תזכורת נוספת - רק למי שביקש יותר מהודעה אחת ביום.
        // התנאי כולל גם חזרות שהגיע זמנן, לא רק משימת לימוד פתוחה: עד היום
        // מי שסיים ללמוד לא נזכר בחזרות שבפיגור אפילו פעם אחת.
        const open = daily.assignments.filter((a) => !daily.completedTracks.includes(a.track));
        const due = dueCount(store);
        if (
          daily.sentMorning &&
          (open.length || due) &&
          (store.state?.mode || 'idle') === 'idle' &&
          il.hour < QUIET_HOUR &&
          now - (daily.lastPingAt || 0) >= REMIND_EVERY_MS
        ) {
          daily.lastPingAt = now;
          save();
          const ok = await send(store.id, reminderPayload(store), { kind: 'reminder' });
          if (ok) {
            daily.pings = (daily.pings || 0) + 1;
            logEvent('proactive', { user: internalId(store.id), kind: 'reminder', open: open.length, due });
          } else {
            logEvent('proactive', { user: internalId(store.id), kind: 'reminder', state: 'failed' });
          }
          save();
        }
      } catch (err) {
        console.error(`scheduler[${store.id}]:`, err.message);
      }
    }
  }, 60 * 1000);
}
