// ערוץ בדיקה מקומי: שיחה עם הבוט בטרמינל, בלי ווצאפ.
// מדמה משתתף יחיד בקבוצה (מזהה קבוע), כדי שהמאגר הרב-משתמשי יעבוד גם כאן.
import readline from 'node:readline';

const LOCAL_USER = 'console@local';
const LOCAL_NAME = 'בדיקה מקומית';

export function startConsoleChannel(onMessage) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const send = async (userId, payload) => {
    const text = typeof payload === 'string' ? payload : payload.text;
    const buttons = typeof payload === 'string' ? null : payload.buttons;
    console.log('\n[הבוט]: ' + text);
    if (buttons?.length) console.log('       [ ' + buttons.map((b) => b.text).join(' ] [ ') + ' ]');
    console.log('');
    return true; // אותו חוזה כמו הברידג': true = ההודעה נמסרה
  };
  console.log('=== מצב בדיקה מקומי - כתוב הודעה ולחץ Enter (Ctrl+C ליציאה) ===');
  console.log('טיפ: כתוב "הרשמה" כדי להתחיל את שאלון הפתיחה.\n');
  const loop = () => {
    rl.question('[אתה]: ', async (line) => {
      await onMessage(LOCAL_USER, LOCAL_NAME, line, (t) => send(LOCAL_USER, t));
      loop();
    });
  };
  loop();
  return send;
}
