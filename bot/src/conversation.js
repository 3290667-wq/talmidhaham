// מוח השיחה: שאלון פתיחה, משימה יומית, בחנים, חזרות ופקודות.
import { load, save, today } from './db.js';
import { buildTrack, TRACK_TYPES, toHebrewNum } from './curriculum.js';
import { getHebrewText } from './sefaria.js';
import { generateQuiz, gradeAnswer, answerQuestion } from './ai.js';
import { newUnitSchedule, afterReview, isOwned, dueUnits, INTERVALS } from './fsrs.js';

const HELP = `הפקודות שלי:
- "למדתי" - סיימת את הלימוד היומי? אשלח בוחן קצר
- "חזרה" - הפעלת חזרות שמגיע זמנן
- "מצב" - סיכום התקדמות
- "היום" - מה המשימה של היום
- "שאלה ..." - שאלה על הסוגיה הנוכחית (למשל: שאלה מה תירץ אביי?)
- "דלג" - סימון היום כ"יום חסד" בלי בוחן
- "שנה תכנית" - בניית תכנית לימוד מחדש
- "עזרה" - ההודעה הזו`;

// ============ בניית המשימה היומית ============

export function buildDaily(store) {
  const t = today();
  if (store.daily?.date === t) return store.daily;
  const user = store.user;
  const assignments = [];
  if (user?.onboarded) {
    const isShabbat = new Date().getDay() === 6;
    if (!(user.skipShabbat && isShabbat)) {
      for (const tr of user.tracks) {
        const refs = tr.units.slice(tr.index, tr.index + tr.pace);
        if (refs.length) assignments.push({ track: tr.bookHe, type: tr.type, refs });
      }
    }
  }
  store.daily = { date: t, sentMorning: false, sentEvening: false, assignments, completedTracks: [] };
  save();
  return store.daily;
}

export function morningMessage(store) {
  const daily = buildDaily(store);
  const due = dueUnits(store.units).length;
  if (!daily.assignments.length) {
    return due
      ? `שבת שלום! היום אין לימוד חדש בלוח, אבל ממתינות ${due} חזרות. כתוב "חזרה" כשנוח לך.`
      : 'שבת שלום! היום מנוחה בלוח. נתראה מחר בעז"ה.';
  }
  let msg = 'בוקר טוב! המשימה להיום לפי התכנית שלך:\n';
  for (const a of daily.assignments) {
    msg += `\n- ${a.refs.map((r) => r.refHe).join(', ')}`;
  }
  if (due) msg += `\n\nממתינות גם ${due} חזרות (כתוב "חזרה").`;
  if (store.stats.streak > 1) msg += `\nרצף נוכחי: ${store.stats.streak} ימים - חזק!`;
  msg += '\n\nכשתסיים ללמוד מהספר - כתוב לי "למדתי" ואבחן אותך.';
  return msg;
}

// ============ הטיפול המרכזי בהודעה נכנסת ============

export async function handleMessage(text, send) {
  const store = load();
  const msg = (text || '').trim();

  try {
    // שאלון פתיחה
    if (!store.user?.onboarded || store.state.mode === 'onboarding') {
      return await handleOnboarding(store, msg, send);
    }
    // באמצע בוחן או חזרה - כל הודעה היא תשובה
    if (store.state.mode === 'quiz') return await handleQuizAnswer(store, msg, send);
    if (store.state.mode === 'review') return await handleReviewAnswer(store, msg, send);

    // פקודות
    if (msg === 'עזרה' || msg === '?') return send(HELP);
    if (msg === 'שנה תכנית') {
      store.state = { mode: 'onboarding', ob: { step: 'tracks' } };
      save();
      return send('בונים תכנית חדשה!\n\n' + tracksQuestion());
    }
    if (msg === 'היום') return send(morningMessage(store));
    if (msg === 'מצב') return send(statusMessage(store));
    if (msg === 'למדתי' || msg.startsWith('למדתי')) return await startQuiz(store, send);
    if (msg === 'חזרה') return await startReview(store, send);
    if (msg === 'דלג') {
      const daily = buildDaily(store);
      daily.completedTracks = daily.assignments.map((a) => a.track);
      for (const tr of store.user.tracks) tr.index += Math.min(tr.pace, tr.units.length - tr.index);
      touchStreak(store);
      save();
      return send('סומן "יום חסד" - התקדמנו בלוח בלי בוחן. מחר חוזרים למסלול המלא!');
    }
    if (msg.startsWith('שאלה')) return await handleQA(store, msg.replace(/^שאלה\s*/, ''), send);

    return send('לא הבנתי. ' + HELP);
  } catch (err) {
    console.error(err);
    return send(`אופס, משהו השתבש: ${err.message}\nנסה שוב, ואם זה חוזר - כתוב "עזרה".`);
  }
}

// ============ שאלון הפתיחה ============

function tracksQuestion() {
  const opts = Object.entries(TRACK_TYPES).map(([n, t]) => `${n}. ${t.label}`).join('\n');
  return `ברוך הבא לחברותא הדיגיטלית שלך!
נבנה יחד את תכנית הלימוד. אילו מסלולים תרצה? (אפשר כמה, למשל: 1 2 3)

${opts}`;
}

async function handleOnboarding(store, msg, send) {
  if (!store.state.ob) store.state.ob = { step: 'tracks' };
  const ob = store.state.ob;
  store.state.mode = 'onboarding';

  if (ob.step === 'tracks') {
    if (!msg || msg === 'התחל' || msg === 'שלום') {
      save();
      return send(tracksQuestion());
    }
    const nums = [...new Set(msg.match(/[1-4]/g) || [])];
    if (!nums.length) return send('כתוב מספרים בין 1 ל-4, למשל: 1 3');
    ob.queue = nums.map((n) => TRACK_TYPES[n].type);
    ob.tracks = [];
    ob.step = 'trackConfig';
    return askNextTrack(ob, send);
  }

  if (ob.step === 'trackConfig') {
    const type = ob.queue[0];
    if (ob.sub === 'book') {
      const built = buildTrack(type, msg);
      if (!built) return send(`לא זיהיתי "${msg}". כתוב שם מדויק, למשל: ${type === 'tanach' ? 'בראשית' : 'ברכות'}`);
      ob.current = { type, bookNameHe: msg };
      if (type === 'tanach') {
        finishTrack(ob, 1);
        return nextTrackOrDone(store, ob, send);
      }
      ob.sub = 'pace';
      save();
      return send(paceQuestion(type));
    }
    if (ob.sub === 'pace') {
      const n = parseInt(msg, 10);
      const max = type === 'gemara' ? 2 : type === 'mishnah' ? 4 : 3;
      if (!n || n < 1 || n > max) return send(`כתוב מספר בין 1 ל-${max}`);
      const pace = type === 'gemara' ? n : n; // גמרא: 1=עמוד, 2=דף (שני עמודים)
      finishTrack(ob, pace);
      return nextTrackOrDone(store, ob, send);
    }
  }

  if (ob.step === 'hour') {
    const h = parseInt(msg, 10);
    if (isNaN(h) || h < 4 || h > 23) return send('כתוב שעה בין 4 ל-23, למשל: 7');
    ob.sendHour = h;
    ob.step = 'shabbat';
    save();
    return send('האם לדלג על שבת בלוח הלימוד? (כן/לא)');
  }

  if (ob.step === 'shabbat') {
    if (msg !== 'כן' && msg !== 'לא') return send('כתוב "כן" או "לא"');
    ob.skipShabbat = msg === 'כן';
    ob.step = 'confirm';
    save();
    const summary = ob.tracks
      .map((t) => `- ${t.bookHe}: ${t.pace} יחידות ביום (סה"כ ${t.units.length} יחידות)`)
      .join('\n');
    return send(`הנה התכנית שלך:
${summary}
- הודעת משימה יומית בשעה ${ob.sendHour}:00
- שבת: ${ob.skipShabbat ? 'מנוחה בלוח' : 'לימוד רגיל'}

לאישור והפעלת האוטומציה - כתוב "אשר". לשינוי - כתוב "שנה תכנית".`);
  }

  if (ob.step === 'confirm') {
    if (msg !== 'אשר') return send('כתוב "אשר" להפעלה, או "שנה תכנית" להתחלה מחדש.');
    store.user = {
      onboarded: true,
      tracks: ob.tracks,
      sendHour: ob.sendHour,
      skipShabbat: ob.skipShabbat,
      createdAt: today(),
    };
    store.state = { mode: 'idle' };
    store.daily = null;
    save();
    await send('התכנית הופעלה! מעכשיו אשלח לך כל בוקר את המשימה היומית.');
    return send(morningMessage(store));
  }

  save();
  return send(tracksQuestion());
}

function bookQuestion(type) {
  if (type === 'gemara') return 'איזו מסכת גמרא נלמד? (למשל: ברכות)';
  if (type === 'mishnah') return 'איזו מסכת משנה נלמד? (למשל: ברכות)';
  if (type === 'tanach') return 'מאיזה ספר בתנ"ך להתחיל? (למשל: בראשית)';
  return '';
}

function paceQuestion(type) {
  if (type === 'gemara') return 'כמה ליום? 1 = עמוד ליום, 2 = דף שלם ליום';
  if (type === 'mishnah') return 'כמה פרקי משנה ליום? (1-4)';
  if (type === 'halacha') return 'כמה סימנים ליום בקיצור שולחן ערוך? (1-3)';
  return '';
}

function finishTrack(ob, pace) {
  const built = buildTrack(ob.current.type, ob.current.bookNameHe || '');
  ob.tracks.push({ type: ob.current.type, ...built, pace, index: 0 });
  ob.queue.shift();
  ob.current = null;
}

// שאלת הפתיחה למסלול הבא בתור: הלכה מדלגת על בחירת ספר
function askNextTrack(ob, send) {
  const type = ob.queue[0];
  if (type === 'halacha') {
    ob.current = { type, bookNameHe: null };
    ob.sub = 'pace';
    save();
    return send(paceQuestion(type));
  }
  ob.sub = 'book';
  save();
  return send(bookQuestion(type));
}

function nextTrackOrDone(store, ob, send) {
  if (ob.queue.length) return askNextTrack(ob, send);
  ob.step = 'hour';
  save();
  return send('מצוין! באיזו שעה בבוקר לשלוח את המשימה היומית? (למשל: 7)');
}

// ============ בוחן יומי ============

async function startQuiz(store, send) {
  const daily = buildDaily(store);
  const pending = daily.assignments.filter((a) => !daily.completedTracks.includes(a.track));
  if (!pending.length) {
    const due = dueUnits(store.units).length;
    return send(due ? `הבוחן היומי כבר הושלם! יש ${due} חזרות ממתינות - כתוב "חזרה".` : 'הבוחן היומי כבר הושלם. כל הכבוד!');
  }
  const a = pending[0];
  await send(`יפה מאוד! מכין בוחן קצר על ${a.refs.map((r) => r.refHe).join(', ')}...`);
  // מביאים את הטקסט של כל יחידות היום במסלול הזה
  let text = '';
  for (const r of a.refs) {
    try {
      text += `\n== ${r.refHe} ==\n` + (await getHebrewText(r.ref));
    } catch (e) {
      console.error('sefaria', r.ref, e.message);
    }
  }
  if (!text.trim()) return send('לא הצלחתי לשלוף את הטקסט מספריא כרגע. נסה שוב מאוחר יותר.');
  const questions = await generateQuiz(a.refs.map((r) => r.refHe).join(', '), text, 3);
  store.state = {
    mode: 'quiz',
    quiz: { track: a.track, refs: a.refs, text, questions, qIdx: 0, scores: [] },
  };
  save();
  return send(`שאלה 1 מתוך ${questions.length}:\n${questions[0].q}`);
}

async function handleQuizAnswer(store, msg, send) {
  const q = store.state.quiz;
  const question = q.questions[q.qIdx];
  const refHe = q.refs.map((r) => r.refHe).join(', ');
  const { score, feedback } = await gradeAnswer(refHe, q.text, question.q, question.ideal, msg);
  q.scores.push(score);
  await send(`${score >= 80 ? 'מצוין!' : score >= 50 ? 'לא רע.' : 'שווה לחזור על זה.'} (ציון: ${score})\n${feedback}`);
  q.qIdx++;
  if (q.qIdx < q.questions.length) {
    save();
    return send(`שאלה ${q.qIdx + 1} מתוך ${q.questions.length}:\n${q.questions[q.qIdx].q}`);
  }
  // סיום הבוחן על המסלול
  const avg = Math.round(q.scores.reduce((a, b) => a + b, 0) / q.scores.length);
  const daily = store.daily;
  daily.completedTracks.push(q.track);
  // רישום היחידות ותזמון חזרה ראשונה
  for (const r of q.refs) {
    store.units[r.ref] = {
      refHe: r.refHe,
      learnedAt: today(),
      questions: q.questions,
      scores: [avg],
      ...newUnitSchedule(),
    };
    store.stats.totalLearned++;
  }
  // קידום המסלול בלוח
  const tr = store.user.tracks.find((t) => t.bookHe === q.track);
  if (tr) tr.index += q.refs.length;
  store.state = { mode: 'idle' };

  let msg2 = `סיימנו את הבוחן על ${q.track} - ציון ממוצע ${avg}. `;
  msg2 += avg >= 80 ? 'היחידה בדרך לבעלות מלאה!' : 'ניפגש עם החומר הזה שוב בחזרות.';
  msg2 += '\nחזרה ראשונה: מחר.';

  const remaining = daily.assignments.filter((a) => !daily.completedTracks.includes(a.track));
  if (remaining.length) {
    msg2 += `\n\nנשאר עוד היום: ${remaining.map((a) => a.track).join(', ')}. כשתלמד - כתוב שוב "למדתי".`;
  } else {
    touchStreak(store);
    msg2 += `\n\nזהו! יום הלימוד הושלם. רצף: ${store.stats.streak} ימים.`;
  }
  save();
  return send(msg2);
}

// ============ חזרות ============

async function startReview(store, send) {
  const due = dueUnits(store.units);
  if (!due.length) return send('אין חזרות ממתינות כרגע - הזיכרון שלך מעודכן!');
  const item = due[0];
  const unit = store.units[item.ref];
  const qs = unit.questions || [];
  if (!qs.length) {
    // אין שאלות שמורות - מדלגים קדימה
    afterReview(unit, 100);
    save();
    return startReview(store, send);
  }
  const q = qs[(unit.reviews || 0) % qs.length];
  store.state = { mode: 'review', review: { ref: item.ref, question: q, remaining: due.length - 1 } };
  save();
  return send(`חזרה (${unit.refHe}, נלמד ב-${unit.learnedAt}):\n${q.q}`);
}

async function handleReviewAnswer(store, msg, send) {
  const rv = store.state.review;
  const unit = store.units[rv.ref];
  let text = '';
  try {
    text = await getHebrewText(rv.ref);
  } catch {
    text = rv.question.ideal;
  }
  const { score, feedback } = await gradeAnswer(unit.refHe, text, rv.question.q, rv.question.ideal, msg);
  afterReview(unit, score);
  unit.scores = [...(unit.scores || []), score];
  store.state = { mode: 'idle' };
  save();
  let out = `${score >= 80 ? 'זכור היטב!' : score >= 50 ? 'כמעט.' : 'נשכח קצת - זה בסדר, בשביל זה חוזרים.'} (ציון: ${score})\n${feedback}\nחזרה הבאה בעוד ${INTERVALS[unit.intervalIdx]} ימים.`;
  if (rv.remaining > 0) {
    out += `\n\nנשארו ${rv.remaining} חזרות - כתוב "חזרה" להמשיך.`;
  } else {
    out += '\n\nכל החזרות הושלמו להיום!';
  }
  return send(out);
}

// ============ שאלות על הסוגיה ============

async function handleQA(store, question, send) {
  if (!question) return send('כתוב את השאלה אחרי המילה "שאלה", למשל: שאלה מה הדין של...');
  // מעגנים בטקסט של הלימוד האחרון
  const daily = buildDaily(store);
  const target = daily.assignments[0]?.refs[0] ||
    Object.entries(store.units).map(([ref, u]) => ({ ref, refHe: u.refHe })).pop();
  if (!target) return send('עוד לא למדנו כלום יחד - השאלות נענות על הסוגיה הנוכחית.');
  await send(`בודק בטקסט של ${target.refHe}...`);
  const text = await getHebrewText(target.ref);
  const answer = await answerQuestion(target.refHe, text, question);
  return send(answer);
}

// ============ מצב והתקדמות ============

function statusMessage(store) {
  const owned = Object.values(store.units).filter(isOwned).length;
  const total = Object.keys(store.units).length;
  const due = dueUnits(store.units).length;
  let msg = 'המצב שלך:\n';
  for (const tr of store.user.tracks) {
    const pct = Math.round((tr.index / tr.units.length) * 100);
    msg += `\n- ${tr.bookHe}: ${tr.index}/${tr.units.length} יחידות (${pct}%)`;
    if (tr.index >= tr.units.length) msg += ' - סיום! מזל טוב!';
  }
  msg += `\n\nיחידות שנלמדו: ${total} | בבעלות מלאה (3+ חזרות): ${owned}`;
  msg += `\nחזרות ממתינות: ${due}`;
  msg += `\nרצף ימים: ${store.stats.streak}`;
  return msg;
}

function touchStreak(store) {
  const t = today();
  if (store.stats.lastCompleted === t) return;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const y = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
  store.stats.streak = store.stats.lastCompleted === y ? store.stats.streak + 1 : 1;
  store.stats.lastCompleted = t;
}
