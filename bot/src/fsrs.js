// מנוע חזרה מרווחת פשוט ואמין (בהשראת SM-2/FSRS):
// מרווחים גדלים והולכים, וציון החזרה קובע אם מתקדמים, נשארים או חוזרים אחורה.
import { today, addDays } from './db.js';

export const INTERVALS = [1, 3, 7, 14, 30, 90, 180, 365];

// יחידה חדשה שנלמדה היום - חזרה ראשונה מחר
export function newUnitSchedule() {
  return { intervalIdx: 0, nextReview: addDays(today(), 1), reviews: 0 };
}

// עדכון אחרי חזרה לפי ציון
export function afterReview(unit, score) {
  let idx = unit.intervalIdx ?? 0;
  if (score >= 80) idx = Math.min(idx + 1, INTERVALS.length - 1);
  else if (score < 50) idx = Math.max(idx - 1, 0);
  // 50-79: נשארים באותו מרווח
  unit.intervalIdx = idx;
  unit.reviews = (unit.reviews || 0) + 1;
  unit.nextReview = addDays(today(), score < 50 ? 1 : INTERVALS[idx]);
  return unit;
}

// הצלחה בעזרת רמז או אחרי חשיפת התשובה אינה שליפה עצמאית, ולכן אינה מקדמת
// את המרווח: התקרה 79 משאירה את היחידה באותו שלב (ולא מענישה מעבר לציון עצמו).
export function effectiveReviewScore(avg, assisted) {
  return assisted ? Math.min(avg, 79) : avg;
}

// יחידה נחשבת "בבעלות" אחרי 3 חזרות מוצלחות (מרווח 14 יום ומעלה)
export function isOwned(unit) {
  return (unit.intervalIdx ?? 0) >= 3;
}

export function dueUnits(units) {
  const t = today();
  return Object.entries(units)
    .filter(([, u]) => u.nextReview && u.nextReview <= t)
    .map(([ref, u]) => ({ ref, ...u }));
}
