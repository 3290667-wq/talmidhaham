// תזמון: הודעת בוקר עם המשימה היומית, ותזכורת כל 3 שעות מאז הפעילות האחרונה
// של הלומד (לא מאז התזכורת הקודמת - מי שלמד קצת מקבל שקט של 3 שעות מחדש).
// רץ על כל המשתתפים בקבוצה - לכל אחד השעה והלוח שלו.
// כל הזמנים לפי שעון ישראל - השרת עצמו רץ על שעון אירופה (שעה אחורה).
import { listUsers, save } from './db.js';
import { morningPayload, buildDaily, reminderPayload } from './conversation.js';

const REMIND_EVERY_MS = 3 * 60 * 60 * 1000;
const QUIET_HOUR = 22; // אחרי 22:00 לא מטרידים - ממשיכים מחר בבוקר

function ilNow() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem', weekday: 'short', hour: 'numeric', hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return { weekday: get('weekday'), hour: parseInt(get('hour'), 10) };
}

// בשבת אין הודעות בכלל. הכניסה מוחמרת ליום שישי 16:00 (לפני הדלקת נרות
// גם בחורף), והיציאה בחצות - ממילא אין הודעות בלילה, והבוקר שאחרי הוא יום חדש.
function isShabbat({ weekday, hour }) {
  return weekday === 'Sat' || (weekday === 'Fri' && hour >= 16);
}

export function startScheduler(send) {
  setInterval(async () => {
    const il = ilNow();
    if (isShabbat(il)) return; // שבת - שקט מוחלט, לא בוקר ולא תזכורות
    const now = Date.now();
    for (const store of listUsers()) {
      try {
        if (!store.user?.onboarded) continue;
        const daily = buildDaily(store);

        // הודעת בוקר בשעה שנקבעה
        if (!daily.sentMorning && il.hour >= store.user.sendHour) {
          daily.sentMorning = true;
          daily.lastPingAt = now;
          save();
          await send(store.id, morningPayload(store));
          continue;
        }

        // תזכורת: רק כשעברו 3 שעות מהפעילות האחרונה (הודעת הבוקר או כל הודעה
        // מהמשתמש), לא באמצע בוחן/חזרה/שאלון, ולא אחרי שעת השקט.
        const open = daily.assignments.filter((a) => !daily.completedTracks.includes(a.track));
        if (
          daily.sentMorning &&
          open.length &&
          (store.state?.mode || 'idle') === 'idle' &&
          il.hour < QUIET_HOUR &&
          now - (daily.lastPingAt || 0) >= REMIND_EVERY_MS
        ) {
          daily.lastPingAt = now;
          save();
          await send(store.id, reminderPayload(store));
        }
      } catch (err) {
        console.error(`scheduler[${store.id}]:`, err.message);
      }
    }
  }, 60 * 1000);
}
