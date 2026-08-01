// תזמון: הודעת בוקר עם המשימה היומית, ותזכורת ערב אם היום לא הושלם.
import { load, save } from './db.js';
import { morningMessage, buildDaily } from './conversation.js';

export function startScheduler(send) {
  setInterval(async () => {
    try {
      const store = load();
      if (!store.user?.onboarded) return;
      const now = new Date();
      const daily = buildDaily(store);

      // הודעת בוקר בשעה שנקבעה
      if (!daily.sentMorning && now.getHours() >= store.user.sendHour) {
        daily.sentMorning = true;
        save();
        await send(morningMessage(store));
      }

      // תזכורת ערב עדינה ב-21:00 אם יש משימות שלא הושלמו
      const open = daily.assignments.filter((a) => !daily.completedTracks.includes(a.track));
      if (!daily.sentEvening && now.getHours() >= 21 && open.length && daily.sentMorning) {
        daily.sentEvening = true;
        save();
        await send(`תזכורת ידידותית: עוד לא סימנת "למדתי" היום (${open.map((a) => a.track).join(', ')}). גם 10 דקות שוות עולם - ואם היום קשה, כתוב "דלג" לשמירת הרצף.`);
      }
    } catch (err) {
      console.error('scheduler:', err.message);
    }
  }, 60 * 1000);
}
